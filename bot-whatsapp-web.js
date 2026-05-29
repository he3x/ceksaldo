/**
 * WhatsApp Bot - Monitor Saldo Lapak Gaming
 * Menggunakan whatsapp-web.js
 * 
 * Fitur:
 * - QR Code di terminal (qrcode-terminal)
 * - LocalAuth (sesi tersimpan, tidak perlu scan ulang)
 * - Auto-detect grup (pilih grup saat pertama kali)
 * - Scraping saldo otomatis
 * - Notifikasi ke grup WhatsApp jika saldo < 1 juta
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs');
const fs = require('fs');
const readline = require('readline');

// ==================== KONFIGURASI ====================

const CONFIG_FILE = 'bot-config.json';
const THRESHOLD_SALDO = 1000000; // 1 juta

// Konfigurasi Auto-Deposit
const AUTO_DEPOSIT_ENABLED = true; // Set false untuk disable auto-deposit
const DEPOSIT_METHOD = 'VA_BCA'; // VA_BCA, TF_BCA_B2B, VA_MANDIRI_XE, dll
const DEPOSIT_AMOUNT = 10000000; // Minimal 10 juta IDR

// Cookie untuk autentikasi scraping
const COOKIE = 'lg_lang_country=id-id; AMP_MKTG_28011834e0=JTdCJTdE; _gcl_au=1.1.226248371.1779954155; _gid=GA1.2.1658832994.1779954155; _clck=r0laew%5E2%5Eg6f%5E0%5E2339; _tt_enable_cookie=1; _ttp=01KSPRJ010GB4A6ZXEJ3JXK47B_.tt.1; _ga=GA1.2.1868646753.1779954155; _rdt_uuid=1779954155142.f034a2f7-4801-4d0a-a623-9fe587909a71; _clsk=1lb75da%5E1779959867338%5E1%5E1%5El.clarity.ms%2Fcollect; ttcsid_CRGFSORC77UD2MA16PRG=1779959838022::ewCSXlUi1l5RNvsR-Dgw.2.1779959867466.1; AMP_28011834e0=JTdCJTIyZGV2aWNlSWQlMjIlM0ElMjIxNWNkODMxMC04Y2JlLTQ5ZjgtYWRjMC04OTE0NDc3ZmQ5MDclMjIlMkMlMjJzZXNzaW9uSWQlMjIlM0ExNzc5OTU5ODM4MDI2JTJDJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJsYXN0RXZlbnRUaW1lJTIyJTNBMTc3OTk1OTg4NDIwNCUyQyUyMmxhc3RFdmVudElkJTIyJTNBMjAlMkMlMjJwYWdlQ291bnRlciUyMiUzQTElN0Q=; ttcsid=1779959838013::QdzhYLvQkNi_2usTSyIS.2.1779959867466.0::1.27499.29207::5360.4.333.6232::167072.29.6012; _ga_N0BQ2Y58SP=GS2.1.s1779959867$o2$g1$t1779961600$j60$l0$h0; _ga_ZETVVQ1SL2=GS2.1.s1779959867$o2$g1$t1779961600$j60$l0$h0; PHPSESSID=j5r02j14onkosn32r181rp822n';

// ==================== FUNGSI CONFIG ====================

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading config:', error.message);
  }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('✅ Konfigurasi tersimpan');
  } catch (error) {
    console.error('❌ Error saving config:', error.message);
  }
}

// ==================== FUNGSI SCRAPING ====================

async function scrapeSaldo() {
  try {
    console.log('🔍 Memulai scraping saldo...');
    
    const response = await axios.get('https://www.lapakgaming.com/reseller/', {
      headers: {
        'Cookie': COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const saldo = $('span b.font-20').text().trim();

    if (!saldo) {
      throw new Error('Saldo tidak ditemukan. Cookie mungkin sudah expired.');
    }

    console.log('✅ Saldo berhasil diambil:', saldo);
    return saldo;

  } catch (error) {
    console.error('❌ Error saat scraping:', error.message);
    throw error;
  }
}

function parseSaldoToNumber(saldoString) {
  const angka = saldoString
    .replace(/Rp/g, '')
    .replace(/\./g, '')
    .replace(/\s/g, '')
    .trim();
  
  const hasil = parseInt(angka, 10);
  console.log(`💰 Parsing: "${saldoString}" -> ${hasil}`);
  return hasil;
}

function formatRupiah(angka) {
  return 'Rp' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ==================== FUNGSI AUTO-DEPOSIT ====================

/**
 * Fungsi untuk melakukan auto-deposit jika saldo menipis
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
async function autoDeposit() {
  try {
    console.log('\n💳 Memulai proses Auto-Deposit...');
    console.log(`   Method: ${DEPOSIT_METHOD}`);
    console.log(`   Amount: ${formatRupiah(DEPOSIT_AMOUNT)}`);
    
    // Step 1: GET - Ambil csrf_token dari form
    console.log('\n🔍 Step 1: Mengambil CSRF token...');
    const getResponse = await axios.get('https://www.lapakgaming.com/reseller/deposit/new_international', {
      headers: {
        'Cookie': COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(getResponse.data);
    const csrfToken = $('#csrf_token').val();
    
    if (!csrfToken) {
      throw new Error('CSRF token tidak ditemukan. Cookie mungkin expired.');
    }
    
    console.log('✅ CSRF token berhasil diambil');
    
    // Step 2: POST - Submit form deposit
    console.log('\n📤 Step 2: Mengirim request deposit...');
    
    // Prepare form data (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('csrf_token', csrfToken);
    formData.append('lang_code', 'id');
    formData.append('currency', 'IDR');
    formData.append('method', DEPOSIT_METHOD);
    formData.append('quantity', DEPOSIT_AMOUNT.toString());
    formData.append('deposit_international', '');
    
    try {
      const postResponse = await axios.post(
        'https://www.lapakgaming.com/reseller/deposit/new_international',
        formData.toString(),
        {
          headers: {
            'Cookie': COOKIE,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://www.lapakgaming.com/reseller/deposit/new_international'
          },
          maxRedirects: 0, // Jangan follow redirect otomatis
          validateStatus: (status) => status >= 200 && status < 400 // Accept 2xx dan 3xx
        }
      );
      
      // Jika dapat response 200-299, cek apakah ada error di halaman
      if (postResponse.status >= 200 && postResponse.status < 300) {
        const $result = cheerio.load(postResponse.data);
        const pageText = postResponse.data;
        
        // Cek apakah ada tagihan pending
        if (pageText.includes('permintaan setoran yang tertunda')) {
          console.log('⚠️  Terdeteksi tagihan pending!');
          console.log('   Mengambil data tagihan yang belum dibayar...');
          
          // Ambil data tagihan pending dari riwayat
          const historyData = await getLatestDepositHistory();
          
          return {
            success: false,
            isPending: true,
            pendingData: historyData.data,
            message: 'Gagal membuat deposit baru karena masih ada tagihan pending.'
          };
        }
        
        // Cek error lainnya
        const errorMsg = $result('.alert-danger').text().trim();
        if (errorMsg) {
          throw new Error(`Deposit gagal: ${errorMsg}`);
        }
      }
      
      // Status 302 atau 200 tanpa error = sukses
      console.log('✅ Deposit berhasil diproses!');
      console.log('⏳ Menunggu 3 detik agar database ter-update...');
      
      // Tunggu 3 detik agar database Lapakgaming sempat update
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Ambil data deposit terbaru untuk detail notifikasi
      console.log('📋 Mengambil detail deposit terbaru...');
      const historyData = await getLatestDepositHistory();
      
      if (historyData.success) {
        return {
          success: true,
          isPending: false,
          depositData: historyData.data,
          message: `Deposit ${formatRupiah(DEPOSIT_AMOUNT)} via ${DEPOSIT_METHOD} berhasil diproses.`
        };
      } else {
        // Jika gagal ambil history, tetap return success tapi tanpa detail
        return {
          success: true,
          isPending: false,
          message: `Deposit ${formatRupiah(DEPOSIT_AMOUNT)} via ${DEPOSIT_METHOD} berhasil diproses.`
        };
      }
      
    } catch (error) {
      // Axios throw error untuk 3xx jika maxRedirects: 0
      // Tapi 302 redirect adalah tanda sukses untuk form submit
      if (error.response && error.response.status === 302) {
        console.log('✅ Deposit berhasil (redirect detected)');
        console.log('⏳ Menunggu 3 detik agar database ter-update...');
        
        // Tunggu 3 detik agar database Lapakgaming sempat update
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Ambil data deposit terbaru untuk detail notifikasi
        console.log('📋 Mengambil detail deposit terbaru...');
        const historyData = await getLatestDepositHistory();
        
        if (historyData.success) {
          return {
            success: true,
            isPending: false,
            depositData: historyData.data,
            message: `Deposit ${formatRupiah(DEPOSIT_AMOUNT)} via ${DEPOSIT_METHOD} berhasil diproses.`
          };
        } else {
          // Jika gagal ambil history, tetap return success tapi tanpa detail
          return {
            success: true,
            isPending: false,
            message: `Deposit ${formatRupiah(DEPOSIT_AMOUNT)} via ${DEPOSIT_METHOD} berhasil diproses.`
          };
        }
      }
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error saat auto-deposit:', error.message);
    return {
      success: false,
      message: `Deposit gagal: ${error.message}`
    };
  }
}

// ==================== FUNGSI GET LATEST DEPOSIT HISTORY ====================

/**
 * Helper function untuk delay/sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fungsi untuk mengambil data riwayat deposit terbaru via API DataTables
 * @returns {Promise<Object>} { success: boolean, data: object, message: string }
 */
async function getLatestDepositHistory() {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 3000; // 3 detik
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n🔍 Mengambil data riwayat deposit via API (Percobaan ${attempt}/${MAX_RETRIES})...`);
      
      // Menggunakan GET dengan query string lengkap DataTables
      // Server membutuhkan parameter columns lengkap agar mau mengurutkan DESC
      const apiUrl = 'https://www.lapakgaming.com/reseller/deposit/list?draw=1&columns%5B0%5D%5Bdata%5D=0&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=true&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=1&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=2&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=3&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=4&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=5&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=true&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=6&columns%5B6%5D%5Bname%5D=&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=true&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B7%5D%5Bdata%5D=7&columns%5B7%5D%5Bname%5D=&columns%5B7%5D%5Bsearchable%5D=true&columns%5B7%5D%5Borderable%5D=true&columns%5B7%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B7%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B8%5D%5Bdata%5D=8&columns%5B8%5D%5Bname%5D=&columns%5B8%5D%5Bsearchable%5D=true&columns%5B8%5D%5Borderable%5D=true&columns%5B8%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B8%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=desc&start=0&length=1&search%5Bvalue%5D=&search%5Bregex%5D=false';
      
      console.log('📡 URL:', apiUrl.substring(0, 100) + '...');
      console.log('📋 Method: GET');
      console.log('📋 Sort: Column 0 (RID) DESC');
      
      const response = await axios.get(apiUrl, {
        headers: {
          'Cookie': COOKIE,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.lapakgaming.com/reseller/deposit/history'
        }
      });
      
      console.log('✅ Response diterima, status:', response.status);
      
      // DEBUG: Cek tipe data response
      console.log('\n🔍 DEBUG - Tipe Data Response:', typeof response.data);
      
      if (typeof response.data === 'string') {
        if (response.data.trim().startsWith('<')) {
          console.log('⚠️  Menerima HTML, bukan JSON!');
          console.log('📄 Potongan HTML (300 karakter pertama):');
          console.log(response.data.substring(0, 300));
          console.log('...\n');
          throw new Error('Server mengembalikan HTML, bukan JSON. Cookie mungkin expired atau perlu login ulang.');
        }
      }
      
      // Validasi response JSON
      if (!response.data || typeof response.data !== 'object') {
        console.log('⚠️  Response bukan object JSON!');
        console.log('📄 Response mentah:', JSON.stringify(response.data).substring(0, 300));
        throw new Error('Format response tidak valid (bukan JSON object).');
      }
      
      if (!response.data.data || !Array.isArray(response.data.data)) {
        console.log('⚠️  Property data.data tidak ditemukan atau bukan array!');
        console.log('📄 Response structure:', JSON.stringify(Object.keys(response.data)));
        throw new Error('Format response JSON tidak valid (data.data tidak ditemukan).');
      }
      
      if (response.data.data.length === 0) {
        throw new Error('Tidak ada data transaksi ditemukan.');
      }
      
      // Ambil baris pertama (transaksi terbaru)
      const row = response.data.data[0];
      
      console.log('\n📊 Parsing data dari API response...');
      console.log('   Raw data:', JSON.stringify(row));
      
      // Parse data dari array
      // Index 0: RID (database ID)
      // Index 1: Faktur (dengan #)
      // Index 2: Metode
      // Index 3: Catatan (VA details)
      // Index 4: Transfer
      // Index 5: Saldo
      // Index 6: Tanggal
      // Index 7: Status (HTML)
      // Index 8: Action
      
      const fakturRaw = row[1] || '';
      const faktur = fakturRaw.replace('#', '').trim();
      
      const metode = (row[2] || '').trim();
      
      const catatanRaw = (row[3] || '').trim();
      let va = catatanRaw;
      if (catatanRaw.includes(' A/N ')) {
        va = catatanRaw.split(' A/N ')[0].trim();
      }
      
      const transfer = (row[4] || '').trim();
      
      // Parse status dari HTML string
      const statusHtml = row[7] || '';
      let status = 'UNKNOWN';
      let statusEmoji = '❓';
      
      if (statusHtml.includes('fa-clock')) {
        status = 'PENDING / MENUNGGU PEMBAYARAN';
        statusEmoji = '⏳';
      } else if (statusHtml.includes('fa-check')) {
        status = 'BERHASIL / SUKSES';
        statusEmoji = '✅';
      } else if (statusHtml.includes('fa-times')) {
        status = 'GAGAL / DILEWATI';
        statusEmoji = '❌';
      }
      
      console.log('   Faktur:', faktur);
      console.log('   Metode:', metode);
      console.log('   Catatan:', catatanRaw);
      console.log('   VA:', va);
      console.log('   Transfer:', transfer);
      console.log('   Status HTML:', statusHtml.substring(0, 100) + '...');
      console.log('   Status:', status);
      
      // Validasi data
      if (!faktur || !metode || !va || !transfer) {
        console.error('❌ Data tidak lengkap!');
        console.error('   Faktur:', faktur || 'KOSONG');
        console.error('   Metode:', metode || 'KOSONG');
        console.error('   VA:', va || 'KOSONG');
        console.error('   Transfer:', transfer || 'KOSONG');
        throw new Error('Data riwayat tidak lengkap.');
      }
      
      console.log('\n✅ Data riwayat deposit berhasil diambil dari API');
      
      return {
        success: true,
        data: {
          faktur,
          metode,
          nomorVA: va,
          nominal: transfer,
          status,
          statusEmoji
        },
        message: 'Data riwayat deposit berhasil diambil'
      };
    
    } catch (error) {
      // Jika ini percobaan terakhir, return error
      if (attempt === MAX_RETRIES) {
        console.error('\n❌ Error setelah semua percobaan gagal:', error.message);
        console.error('💡 Troubleshooting:');
        console.error('   1. Pastikan cookie masih valid');
        console.error('   2. Cek apakah halaman history memerlukan login');
        console.error('   3. Cek Network tab di browser untuk endpoint API');
        
        return {
          success: false,
          data: null,
          message: `Gagal mengambil data setelah ${MAX_RETRIES} percobaan: ${error.message}`
        };
      }
      
      // Jika bukan percobaan terakhir, tunggu dan coba lagi
      console.log(`\n⚠️  Percobaan ${attempt} gagal: ${error.message}`);
      console.log(`⏳ Menunggu ${RETRY_DELAY/1000} detik sebelum mencoba lagi...`);
      await sleep(RETRY_DELAY);
    }
  }
  
  // Fallback (seharusnya tidak pernah sampai sini)
  return {
    success: false,
    data: null,
    message: 'Gagal mengambil data setelah semua percobaan'
  };
}

// ==================== FUNGSI NOTIFIKASI ====================

async function kirimNotifikasi(client, groupId, saldoString) {
  try {
    const pesan = `⚠️ *PERINGATAN SALDO MENIPIS* ⚠️

Saldo Lapakgaming kamu saat ini menipis!

💰 *Sisa Saldo:* ${saldoString}
📊 *Threshold:* ${formatRupiah(THRESHOLD_SALDO)}

Segera lakukan top-up agar transaksi tidak terganggu.

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${new Date().toLocaleString('id-ID')}_`;

    await client.sendMessage(groupId, pesan);
    console.log('✅ Notifikasi berhasil dikirim ke grup WhatsApp');
    
  } catch (error) {
    console.error('❌ Error saat mengirim notifikasi:', error.message);
    throw error;
  }
}

async function kirimNotifikasiDeposit(client, groupId, depositResult, saldoString) {
  try {
    let pesan;
    
    if (depositResult.success) {
      // Jika ada data deposit dari history, tampilkan detail lengkap
      if (depositResult.depositData) {
        const data = depositResult.depositData;
        pesan = `✅ *AUTO-DEPOSIT BERHASIL* ✅

Deposit otomatis telah berhasil diproses!

💳 *Detail Tagihan Pembayaran:*
▪️ *No. Faktur* : ${data.faktur}
▪️ *Metode*     : ${data.metode}
▪️ *Nominal*    : ${data.nominal}
▪️ *No. VA*     : ${data.nomorVA}

📊 *Saldo Sebelumnya:* ${saldoString}

💡 *Silakan lakukan transfer sesuai nominal ke nomor VA di atas.* Saldo akan otomatis bertambah setelah pembayaran dikonfirmasi.

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${new Date().toLocaleString('id-ID')}_`;
      } else {
        // Fallback jika data deposit tidak tersedia
        pesan = `✅ *AUTO-DEPOSIT BERHASIL* ✅

Deposit otomatis telah berhasil diproses!

💳 *Method:* ${DEPOSIT_METHOD}
💰 *Jumlah:* ${formatRupiah(DEPOSIT_AMOUNT)}
📊 *Saldo Sebelumnya:* ${saldoString}

${depositResult.message}

Saldo akan bertambah setelah pembayaran dikonfirmasi.

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${new Date().toLocaleString('id-ID')}_`;
      }
    } else if (depositResult.isPending && depositResult.pendingData) {
      // Notifikasi khusus untuk tagihan pending dengan format baru
      const data = depositResult.pendingData;
      pesan = `🔔 *${data.statusEmoji} ${data.status}*

*Detail Pembayaran Deposit:*
▪️ *No. Faktur* : ${data.faktur}
▪️ *Metode*     : ${data.metode}
▪️ *Nominal*    : ${data.nominal}
▪️ *No. VA*     : ${data.nomorVA}

📊 *Saldo Saat Ini:* ${saldoString}

⚠️ *Auto-Deposit gagal dibuat karena ada tagihan yang belum dibayar!*

Silakan lakukan transfer sesuai dengan nominal dan VA di atas.

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${new Date().toLocaleString('id-ID')}_`;
    } else {
      pesan = `❌ *AUTO-DEPOSIT GAGAL* ❌

Deposit otomatis gagal diproses!

💳 *Method:* ${DEPOSIT_METHOD}
💰 *Jumlah:* ${formatRupiah(DEPOSIT_AMOUNT)}
📊 *Saldo Saat Ini:* ${saldoString}

⚠️ *Error:* ${depositResult.message}

Silakan lakukan deposit manual atau periksa konfigurasi bot.

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${new Date().toLocaleString('id-ID')}_`;
    }

    await client.sendMessage(groupId, pesan);
    console.log('✅ Notifikasi deposit berhasil dikirim ke grup WhatsApp');
    
  } catch (error) {
    console.error('❌ Error saat mengirim notifikasi deposit:', error.message);
    throw error;
  }
}

// ==================== FUNGSI CEK SALDO ====================

async function cekDanNotifikasi(client, groupId) {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 Memulai pengecekan saldo...');
    console.log('='.repeat(60) + '\n');

    const saldoString = await scrapeSaldo();
    const saldoAngka = parseSaldoToNumber(saldoString);
    
    console.log(`\n📊 Perbandingan:`);
    console.log(`   Saldo saat ini: ${formatRupiah(saldoAngka)}`);
    console.log(`   Threshold: ${formatRupiah(THRESHOLD_SALDO)}`);
    console.log(`   Auto-Deposit: ${AUTO_DEPOSIT_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    
    if (saldoAngka < THRESHOLD_SALDO) {
      console.log(`\n⚠️  SALDO DI BAWAH THRESHOLD!`);
      console.log(`   Mengirim notifikasi ke grup WhatsApp...`);
      await kirimNotifikasi(client, groupId, saldoString);
      
      // Auto-Deposit jika diaktifkan
      if (AUTO_DEPOSIT_ENABLED) {
        console.log(`\n💳 Auto-Deposit diaktifkan, memulai proses deposit...`);
        const depositResult = await autoDeposit();
        
        // Kirim notifikasi hasil deposit
        await kirimNotifikasiDeposit(client, groupId, depositResult, saldoString);
        
        if (depositResult.success) {
          console.log(`\n✅ Auto-Deposit berhasil!`);
        } else {
          console.log(`\n❌ Auto-Deposit gagal: ${depositResult.message}`);
        }
      } else {
        console.log(`\n⚠️  Auto-Deposit tidak diaktifkan.`);
        console.log(`   Set AUTO_DEPOSIT_ENABLED = true untuk mengaktifkan.`);
      }
    } else {
      console.log(`\n✅ Saldo masih aman (di atas threshold)`);
      console.log(`   Tidak perlu mengirim notifikasi atau deposit.`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Pengecekan selesai');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error saat cek saldo:', error.message);
  }
}

// ==================== FUNGSI PILIH GRUP ====================

async function pilihGrup(client) {
  return new Promise(async (resolve) => {
    try {
      const chats = await client.getChats();
      const groups = chats.filter(chat => chat.isGroup);
      
      if (groups.length === 0) {
        console.log('\n❌ Tidak ada grup ditemukan.');
        console.log('   Pastikan Anda sudah bergabung dengan grup WhatsApp.\n');
        process.exit(1);
      }
      
      console.log('\n' + '='.repeat(70));
      console.log('📋 DAFTAR GRUP WHATSAPP');
      console.log('='.repeat(70) + '\n');
      console.log(`Ditemukan ${groups.length} grup:\n`);
      
      groups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name}`);
        console.log(`   Anggota: ${group.participants ? group.participants.length : 'N/A'}`);
        console.log('');
      });
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('Pilih nomor grup untuk monitoring (1-' + groups.length + '): ', (answer) => {
        const index = parseInt(answer) - 1;
        
        if (index >= 0 && index < groups.length) {
          const selectedGroup = groups[index];
          console.log(`\n✅ Grup dipilih: ${selectedGroup.name}`);
          console.log(`   ID: ${selectedGroup.id._serialized}\n`);
          
          const config = {
            groupId: selectedGroup.id._serialized,
            groupName: selectedGroup.name,
            configuredAt: new Date().toISOString()
          };
          
          saveConfig(config);
          rl.close();
          resolve(selectedGroup.id._serialized);
        } else {
          console.log('\n❌ Pilihan tidak valid!\n');
          rl.close();
          process.exit(1);
        }
      });
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });
}

// ==================== INISIALISASI WHATSAPP CLIENT ====================

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   WhatsApp Bot - Monitor Saldo Lapak Gaming             ║');
console.log('║   Powered by whatsapp-web.js                             ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'saldo-monitor'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

client.on('qr', (qr) => {
  console.log('📱 QR CODE DITERIMA');
  console.log('⏳ Scan QR Code di bawah ini dengan WhatsApp Anda:\n');
  qrcode.generate(qr, { small: true });
  console.log('\n💡 Tips: Buka WhatsApp > Linked Devices > Link a Device');
  console.log('');
});

client.on('authenticated', () => {
  console.log('✅ Autentikasi berhasil!');
  console.log('💾 Sesi tersimpan, tidak perlu scan QR lagi next time.');
  console.log('');
});

client.on('loading_screen', (percent, message) => {
  console.log(`⏳ Loading: ${percent}% - ${message}`);
});

client.on('ready', async () => {
  console.log('\n🎉 Bot WhatsApp berhasil terhubung!');
  console.log('📱 Nomor:', client.info.wid.user);
  console.log('👤 Nama:', client.info.pushname);
  console.log('');
  
  // Load atau pilih grup
  let config = loadConfig();
  let groupId = config.groupId;
  
  if (!groupId) {
    console.log('⚙️  Konfigurasi pertama kali...');
    groupId = await pilihGrup(client);
  } else {
    console.log('✅ Menggunakan grup tersimpan:', config.groupName);
    console.log('   ID:', groupId);
    console.log('');
  }
  
  // Jalankan pengecekan saldo
  await cekDanNotifikasi(client, groupId);
  
  // Optional: Monitoring berkala
  // Uncomment untuk monitoring otomatis setiap 1 jam
  // setInterval(() => {
  //   cekDanNotifikasi(client, groupId);
  // }, 60 * 60 * 1000);
});

client.on('disconnected', (reason) => {
  console.log('❌ Bot terputus:', reason);
  console.log('🔄 Mencoba reconnect...');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Autentikasi gagal:', msg);
  console.log('💡 Hapus folder .wwebjs_auth dan coba lagi.');
});

console.log('🚀 Memulai WhatsApp Bot...');
console.log('⏳ Mohon tunggu...\n');

client.initialize().catch(error => {
  console.error('❌ Error saat inisialisasi:', error.message);
  console.log('\n💡 Troubleshooting:');
  console.log('1. Pastikan koneksi internet stabil');
  console.log('2. Hapus folder .wwebjs_auth jika ada masalah');
  console.log('3. Coba jalankan ulang: node bot-whatsapp-web.js\n');
});