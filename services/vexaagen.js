/**
 * Vexaagen Service Module
 * 
 * Modul untuk menangani semua operasi Vexaagen:
 * - Auto-login via JSON API
 * - Cek saldo via API
 * - Auto-deposit dengan deteksi tagihan pending
 * 
 * Return format standar:
 * {
 *   status: 'SUCCESS' | 'PENDING' | 'ERROR',
 *   platform: 'VEXAAGEN',
 *   data: {
 *     saldo: number,
 *     saldoFormatted: string,
 *     depositData: object (jika ada),
 *     pendingData: object (jika ada)
 *   },
 *   message: string
 * }
 */

const axios = require('axios');

// ==================== KONFIGURASI ====================

const CONFIG = {
  // Kredensial (dari .env)
  username: process.env.VEXA_USER,
  password: process.env.VEXA_PASS,
  
  // API Base URL
  baseUrl: process.env.VEXA_API_BASE_URL || 'https://api.vexaagen.com',
  
  // Deposit
  paymentMethodId: parseInt(process.env.VEXA_PAYMENT_METHOD_ID) || 5,
  depositAmount: parseInt(process.env.DEPOSIT_AMOUNT) || 10000000,
  
  // Thresholds
  minSaldoThreshold: parseInt(process.env.MIN_SALDO_THRESHOLD) || 1000000,
  
  // Feature flags
  autoDepositEnabled: process.env.VEXA_AUTO_DEPOSIT_ENABLED === 'true',
};

// Token management
let AUTH_TOKEN = null;

// ==================== HELPER FUNCTIONS ====================

function formatRupiah(angka) {
  return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ==================== API FUNCTIONS ====================

/**
 * Login ke Vexaagen API
 * @returns {Promise<string>} Auth token
 */
async function loginVexaagen() {
  try {
    console.log('[VEXA] 🔐 Login ke Vexaagen API...');
    
    const response = await axios.post(
      `${CONFIG.baseUrl}/auth/login`,
      {
        username: CONFIG.username,
        password: CONFIG.password
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (response.status !== 200) {
      throw new Error(`Login gagal dengan status ${response.status}`);
    }
    
    // Ambil token dari response
    let token = null;
    
    if (response.data && response.data.token) {
      token = response.data.token;
    } else if (response.data && response.data.payload && response.data.payload.token) {
      token = response.data.payload.token;
    } else if (response.headers['set-cookie']) {
      const cookies = response.headers['set-cookie'];
      token = cookies.join('; ');
    }
    
    if (!token) {
      throw new Error('Token autentikasi tidak ditemukan dalam response');
    }
    
    console.log('[VEXA] ✅ Login berhasil');
    AUTH_TOKEN = token;
    return token;
    
  } catch (error) {
    console.error('[VEXA] ❌ Error login:', error.message);
    throw error;
  }
}

/**
 * Cek saldo Vexaagen
 * @returns {Promise<Object>} { saldo: number, saldoFormatted: string }
 */
async function cekSaldo() {
  try {
    console.log('[VEXA] 🔍 Mengecek saldo...');
    
    // Pastikan sudah login
    if (!AUTH_TOKEN) {
      await loginVexaagen();
    }
    
    const response = await axios.get(
      `${CONFIG.baseUrl}/deposit/balance-stats`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Cookie': AUTH_TOKEN,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    // Validasi response
    if (response.status !== 200) {
      throw new Error(`Gagal cek saldo dengan status ${response.status}`);
    }
    
    if (!response.data || response.data.code !== 200) {
      throw new Error('Response tidak valid atau error dari server');
    }
    
    if (!response.data.payload || typeof response.data.payload.current_saldo === 'undefined') {
      throw new Error('Struktur response tidak sesuai');
    }
    
    const saldo = response.data.payload.current_saldo;
    console.log('[VEXA] ✅ Saldo:', formatRupiah(saldo));
    
    return {
      saldo,
      saldoFormatted: formatRupiah(saldo)
    };
    
  } catch (error) {
    // Jika error 401/403, token expired, coba login ulang
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log('[VEXA] ⚠️  Token expired, login ulang...');
      AUTH_TOKEN = null;
      await loginVexaagen();
      return await cekSaldo(); // Retry
    }
    
    console.error('[VEXA] ❌ Error cek saldo:', error.message);
    throw error;
  }
}

/**
 * Cek apakah ada deposit pending
 * @returns {Promise<Object|null>} Data deposit pending atau null
 */
async function cekDepositPending() {
  try {
    console.log('[VEXA] 🔍 Mengecek deposit pending...');
    
    if (!AUTH_TOKEN) {
      await loginVexaagen();
    }
    
    const response = await axios.get(
      `${CONFIG.baseUrl}/deposit`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Cookie': AUTH_TOKEN,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (response.status !== 200 || !response.data) {
      throw new Error('Gagal mengambil riwayat deposit');
    }
    
    // Cari deposit dengan status pending
    let deposits = [];
    
    if (Array.isArray(response.data)) {
      deposits = response.data;
    } else if (response.data.payload && response.data.payload.data && Array.isArray(response.data.payload.data)) {
      deposits = response.data.payload.data;
    } else if (response.data.payload && Array.isArray(response.data.payload)) {
      deposits = response.data.payload;
    } else if (response.data.data && Array.isArray(response.data.data)) {
      deposits = response.data.data;
    }
    
    const pendingDeposits = deposits.filter(deposit => 
      deposit.latest_status === 'Menunggu Pembayaran' ||
      deposit.status === 'Menunggu Pembayaran' ||
      deposit.latest_status === 'pending' ||
      deposit.status === 'pending'
    );
    
    if (pendingDeposits.length > 0) {
      const latestPending = pendingDeposits.sort((a, b) => b.id - a.id)[0];
      console.log('[VEXA] ⚠️  Ditemukan tagihan pending:', latestPending.code);
      return latestPending;
    }
    
    console.log('[VEXA] ✅ Tidak ada tagihan pending');
    return null;
    
  } catch (error) {
    console.error('[VEXA] ❌ Error cek pending:', error.message);
    return null; // Fail-safe
  }
}

/**
 * Buat request deposit baru
 * @returns {Promise<Object>} { success: boolean, isPending: boolean, data: object, message: string }
 */
async function buatDeposit() {
  try {
    // Step 1: Cek tagihan pending
    const pendingDeposit = await cekDepositPending();
    
    if (pendingDeposit) {
      console.log('[VEXA] ⚠️  Abort: Ada tagihan pending');
      
      return {
        success: false,
        isPending: true,
        pendingData: pendingDeposit,
        message: 'Ada tagihan pending yang belum dibayar'
      };
    }
    
    // Step 2: Buat deposit baru
    console.log('[VEXA] 💳 Membuat request deposit...');
    console.log(`[VEXA]    Amount: ${formatRupiah(CONFIG.depositAmount)}`);
    console.log(`[VEXA]    Payment Method ID: ${CONFIG.paymentMethodId}`);
    
    if (!AUTH_TOKEN) {
      await loginVexaagen();
    }
    
    const payload = {
      amount: CONFIG.depositAmount,
      payment_method_id: CONFIG.paymentMethodId
    };
    
    const response = await axios.post(
      `${CONFIG.baseUrl}/deposit`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Cookie': AUTH_TOKEN,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (response.status !== 200) {
      throw new Error(`Gagal buat deposit dengan status ${response.status}`);
    }
    
    if (!response.data || response.data.code !== 200) {
      const errorMsg = response.data && response.data.message ? response.data.message : 'Unknown error';
      throw new Error(`Deposit gagal: ${errorMsg}`);
    }
    
    if (!response.data.payload) {
      throw new Error('Struktur response tidak sesuai');
    }
    
    const depositData = response.data.payload;
    console.log('[VEXA] ✅ Deposit berhasil dibuat:', depositData.code);
    
    return {
      success: true,
      isPending: false,
      data: depositData,
      message: 'Deposit berhasil dibuat'
    };
    
  } catch (error) {
    console.error('[VEXA] ❌ Error buat deposit:', error.message);
    
    // Jika error 401/403, token expired
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log('[VEXA] ⚠️  Token expired, login ulang...');
      AUTH_TOKEN = null;
      await loginVexaagen();
      return await buatDeposit(); // Retry
    }
    
    return {
      success: false,
      isPending: false,
      message: error.message
    };
  }
}

// ==================== MAIN FUNCTION ====================

/**
 * Fungsi utama untuk monitoring dan auto-deposit Vexaagen
 * @returns {Promise<Object>} Status object dengan format standar
 */
async function runVexaAutoDeposit() {
  try {
    console.log('\n[VEXA] ═══════════════════════════════════════════');
    console.log('[VEXA] 🚀 Memulai monitoring Vexaagen...');
    console.log('[VEXA] ═══════════════════════════════════════════\n');
    
    // Step 1: Login
    await loginVexaagen();
    
    // Step 2: Cek saldo
    const { saldo, saldoFormatted } = await cekSaldo();
    
    console.log(`[VEXA] 📊 Saldo: ${formatRupiah(saldo)}`);
    console.log(`[VEXA] 📊 Threshold: ${formatRupiah(CONFIG.minSaldoThreshold)}`);
    console.log(`[VEXA] 📊 Auto-Deposit: ${CONFIG.autoDepositEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    // Step 3: Cek apakah perlu deposit
    if (saldo >= CONFIG.minSaldoThreshold) {
      console.log('[VEXA] ✅ Saldo aman, tidak perlu deposit\n');
      
      return {
        status: 'SUCCESS',
        platform: 'VEXAAGEN',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: false
        },
        message: `Saldo aman: ${formatRupiah(saldo)}`
      };
    }
    
    // Saldo di bawah threshold
    console.log('[VEXA] ⚠️  Saldo di bawah threshold!');
    
    if (!CONFIG.autoDepositEnabled) {
      console.log('[VEXA] ⚠️  Auto-deposit tidak diaktifkan\n');
      
      return {
        status: 'ERROR',
        platform: 'VEXAAGEN',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: true
        },
        message: `Saldo menipis (${formatRupiah(saldo)}) tapi auto-deposit tidak aktif`
      };
    }
    
    // Step 4: Jalankan auto-deposit
    console.log('[VEXA] 💳 Menjalankan auto-deposit...');
    const depositResult = await buatDeposit();
    
    if (depositResult.success) {
      console.log('[VEXA] ✅ Auto-deposit berhasil!\n');
      
      return {
        status: 'SUCCESS',
        platform: 'VEXAAGEN',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: true,
          depositData: depositResult.data
        },
        message: `Deposit berhasil: ${formatRupiah(CONFIG.depositAmount)}`
      };
    } else if (depositResult.isPending) {
      console.log('[VEXA] ⚠️  Tagihan pending ditemukan\n');
      
      return {
        status: 'PENDING',
        platform: 'VEXAAGEN',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: true,
          pendingData: depositResult.pendingData
        },
        message: 'Ada tagihan pending yang belum dibayar'
      };
    } else {
      console.log('[VEXA] ❌ Auto-deposit gagal\n');
      
      return {
        status: 'ERROR',
        platform: 'VEXAAGEN',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: true
        },
        message: `Deposit gagal: ${depositResult.message}`
      };
    }
    
  } catch (error) {
    console.error('[VEXA] ❌ Error:', error.message);
    console.error('[VEXA] ═══════════════════════════════════════════\n');
    
    return {
      status: 'ERROR',
      platform: 'VEXAAGEN',
      data: null,
      message: `Error: ${error.message}`
    };
  }
}

// ==================== EXPORTS ====================

module.exports = {
  runVexaAutoDeposit,
  loginVexaagen,
  cekSaldo,
  cekDepositPending,
  buatDeposit,
  CONFIG
};