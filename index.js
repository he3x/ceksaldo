/**
 * WhatsApp Bot - Unified Monitoring System
 * 
 * Bot WhatsApp untuk monitoring saldo Lapakgaming dan Vexaagen
 * dengan auto-deposit otomatis.
 * 
 * Fitur:
 * - Monitoring berkala (interval dari .env)
 * - Parallel execution untuk kedua platform
 * - Independent error handling per platform
 * - WhatsApp notifications dengan format berbeda per status
 * - LocalAuth (sesi tersimpan)
 * - QR Code di terminal
 */

require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const readline = require('readline');

// Import services
const { runLapakAutoDeposit } = require('./services/lapakgaming');
const { runVexaAutoDeposit } = require('./services/vexaagen');

// ==================== KONFIGURASI ====================

const CONFIG = {
  // WhatsApp
  waGroupId: process.env.WA_GROUP_ID,
  
  // Monitoring
  checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 10,
  
  // Feature flags
  lapakEnabled: process.env.LAPAK_MONITORING_ENABLED === 'true',
  vexaEnabled: process.env.VEXA_MONITORING_ENABLED === 'true',
};

const CONFIG_FILE = 'bot-unified-config.json';

// ==================== HELPER FUNCTIONS ====================

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

// ==================== WHATSAPP MESSAGE FORMATTING ====================

/**
 * Format pesan WhatsApp untuk Lapakgaming berdasarkan status
 */
function formatLapakMessage(result) {
  const timestamp = new Date().toLocaleString('id-ID');
  
  if (result.status === 'SUCCESS' && result.data && !result.data.needsDeposit) {
    // Saldo aman
    return `✅ *LAPAKGAMING - SALDO AMAN*

💰 *Saldo:* ${result.data.saldoFormatted}
📊 Status: Saldo masih di atas threshold

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${timestamp}_`;
  }
  
  if (result.status === 'SUCCESS' && result.data && result.data.depositData) {
    // Deposit berhasil
    const data = result.data.depositData;
    return `✅ *LAPAKGAMING - AUTO-DEPOSIT BERHASIL*

Deposit otomatis telah berhasil diproses!

💳 *Detail Tagihan Pembayaran:*
▪️ *No. Faktur* : ${data.faktur}
▪️ *Metode*     : ${data.metode}
▪️ *Nominal*    : ${data.nominal}
▪️ *No. VA*     : ${data.nomorVA}

📊 *Saldo Sebelumnya:* ${result.data.saldoFormatted}

💡 *Silakan lakukan transfer sesuai nominal ke nomor VA di atas.*

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${timestamp}_`;
  }
  
  if (result.status === 'PENDING' && result.data && result.data.pendingData) {
    // Tagihan pending
    const data = result.data.pendingData;
    return `⏳ *LAPAKGAMING - TAGIHAN PENDING*

*Detail Pembayaran Deposit:*
▪️ *No. Faktur* : ${data.faktur}
▪️ *Metode*     : ${data.metode}
▪️ *Nominal*    : ${data.nominal}
▪️ *No. VA*     : ${data.nomorVA}
▪️ *Status*     : ${data.status}

📊 *Saldo Saat Ini:* ${result.data.saldoFormatted}

⚠️ *Auto-Deposit gagal dibuat karena ada tagihan yang belum dibayar!*

Silakan lakukan transfer sesuai dengan nominal dan VA di atas.

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${timestamp}_`;
  }
  
  // Error atau kondisi lainnya
  return `❌ *LAPAKGAMING - ${result.status}*

${result.message}

${result.data ? `📊 *Saldo:* ${result.data.saldoFormatted}` : ''}

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${timestamp}_`;
}

/**
 * Format pesan WhatsApp untuk Vexaagen berdasarkan status
 */
function formatVexaMessage(result) {
  const timestamp = new Date().toLocaleString('id-ID');
  
  if (result.status === 'SUCCESS' && result.data && !result.data.needsDeposit) {
    // Saldo aman
    return `✅ *VEXAAGEN - SALDO AMAN*

💰 *Saldo:* ${result.data.saldoFormatted}
📊 Status: Saldo masih di atas threshold

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${timestamp}_`;
  }
  
  if (result.status === 'SUCCESS' && result.data && result.data.depositData) {
    // Deposit berhasil
    const data = result.data.depositData;
    return `✅ *VEXAAGEN - AUTO-DEPOSIT BERHASIL*

Deposit otomatis telah berhasil diproses!

💳 *Detail Tagihan Pembayaran:*
▪️ *Kode Tiket* : ${data.code}
▪️ *Metode*     : ${data.payment_method.account_name}
▪️ *No. Rek*    : ${data.payment_method.account_number}
▪️ *A/N*        : ${data.payment_method.account_holder_name}
▪️ *NOMINAL*    : *${data.total_amount}* (Harus sesuai sampai angka terakhir!)

📊 *Saldo Sebelumnya:* ${result.data.saldoFormatted}

💡 *Silakan lakukan transfer sesuai nominal.*

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${timestamp}_`;
  }
  
  if (result.status === 'PENDING' && result.data && result.data.pendingData) {
    // Tagihan pending
    const data = result.data.pendingData;
    let expiredInfo = '';
    if (data.expired_at) {
      expiredInfo = `\n▪️ *Batas Waktu*: ${data.expired_at}`;
    }
    
    return `⏳ *VEXAAGEN - TAGIHAN PENDING*

Anda masih memiliki permintaan setoran yang belum diselesaikan.

💳 *Detail Pembayaran Pending:*
▪️ *Kode Tiket* : ${data.code}
▪️ *Metode*     : ${data.payment_method.account_name}
▪️ *No. Rek*    : ${data.payment_method.account_number}
▪️ *A/N*        : ${data.payment_method.account_holder_name}
▪️ *NOMINAL*    : *${data.total_amount}*${expiredInfo}

📊 *Saldo Saat Ini:* ${result.data.saldoFormatted}

⚠️ *Silakan selesaikan pembayaran sebelum membuat deposit baru.*

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${timestamp}_`;
  }
  
  // Error atau kondisi lainnya
  return `❌ *VEXAAGEN - ${result.status}*

${result.message}

${result.data ? `📊 *Saldo:* ${result.data.saldoFormatted}` : ''}

_Pesan otomatis dari Bot Monitor Saldo_
_Waktu: ${timestamp}_`;
}

// ==================== MONITORING FUNCTION ====================

/**
 * Fungsi utama monitoring - jalankan kedua platform secara paralel
 */
async function startMonitoring(client, groupId) {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║          MEMULAI MONITORING CYCLE                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`Waktu: ${new Date().toLocaleString('id-ID')}\n`);
    
    // Array untuk menyimpan promises
    const promises = [];
    
    // Jalankan Lapakgaming jika enabled
    if (CONFIG.lapakEnabled) {
      console.log('🔵 Lapakgaming monitoring: ENABLED');
      promises.push(
        runLapakAutoDeposit()
          .then(result => ({ platform: 'LAPAKGAMING', result }))
          .catch(error => ({
            platform: 'LAPAKGAMING',
            result: {
              status: 'ERROR',
              platform: 'LAPAKGAMING',
              data: null,
              message: `Unhandled error: ${error.message}`
            }
          }))
      );
    } else {
      console.log('⚪ Lapakgaming monitoring: DISABLED');
    }
    
    // Jalankan Vexaagen jika enabled
    if (CONFIG.vexaEnabled) {
      console.log('🔵 Vexaagen monitoring: ENABLED');
      promises.push(
        runVexaAutoDeposit()
          .then(result => ({ platform: 'VEXAAGEN', result }))
          .catch(error => ({
            platform: 'VEXAAGEN',
            result: {
              status: 'ERROR',
              platform: 'VEXAAGEN',
              data: null,
              message: `Unhandled error: ${error.message}`
            }
          }))
      );
    } else {
      console.log('⚪ Vexaagen monitoring: DISABLED');
    }
    
    if (promises.length === 0) {
      console.log('\n⚠️  Tidak ada platform yang diaktifkan!');
      console.log('   Set LAPAK_MONITORING_ENABLED atau VEXA_MONITORING_ENABLED ke true di .env\n');
      return;
    }
    
    console.log('\n⏳ Menjalankan monitoring untuk semua platform...\n');
    
    // Jalankan semua promises secara paralel
    const results = await Promise.all(promises);
    
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║          MONITORING CYCLE SELESAI                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    // Kirim notifikasi untuk setiap platform
    for (const { platform, result } of results) {
      try {
        console.log(`📤 Mengirim notifikasi ${platform}...`);
        
        let message;
        if (platform === 'LAPAKGAMING') {
          message = formatLapakMessage(result);
        } else if (platform === 'VEXAAGEN') {
          message = formatVexaMessage(result);
        }
        
        if (message) {
          await client.sendMessage(groupId, message);
          console.log(`✅ Notifikasi ${platform} terkirim\n`);
        }
        
      } catch (error) {
        console.error(`❌ Error mengirim notifikasi ${platform}:`, error.message);
      }
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Error dalam monitoring cycle:', error.message);
    console.error('═══════════════════════════════════════════════════════════\n');
  }
}

// ==================== GRUP SELECTION ====================

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

// ==================== WHATSAPP CLIENT INITIALIZATION ====================

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   WhatsApp Bot - Unified Monitoring System              ║');
console.log('║   Lapakgaming + Vexaagen                                 ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'unified-monitor'
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
  console.log('💾 Sesi tersimpan, tidak perlu scan QR lagi.');
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
  let groupId = config.groupId || CONFIG.waGroupId;
  
  if (!groupId) {
    console.log('⚙️  Konfigurasi pertama kali...');
    groupId = await pilihGrup(client);
  } else {
    console.log('✅ Menggunakan grup tersimpan:', config.groupName || groupId);
    console.log('');
  }
  
  // Jalankan monitoring pertama kali
  console.log('🚀 Menjalankan monitoring pertama kali...');
  await startMonitoring(client, groupId);
  
  // Setup monitoring berkala
  const intervalMs = CONFIG.checkIntervalMinutes * 60 * 1000;
  console.log(`\n⏰ Monitoring berkala diaktifkan: setiap ${CONFIG.checkIntervalMinutes} menit`);
  console.log('   (Tekan Ctrl+C untuk menghentikan bot)\n');
  
  setInterval(() => {
    startMonitoring(client, groupId);
  }, intervalMs);
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
  console.log('3. Coba jalankan ulang: node index.js\n');
});
