# WhatsApp Bot - Unified Monitoring System

Bot WhatsApp untuk monitoring saldo **Lapakgaming** dan **Vexaagen** dengan auto-deposit otomatis.

## 🎯 Fitur Utama

- ✅ **Monitoring Berkala** - Cek saldo otomatis setiap X menit (konfigurasi via .env)
- ✅ **Dual Platform** - Lapakgaming (web scraping) + Vexaagen (JSON API)
- ✅ **Parallel Execution** - Kedua platform berjalan bersamaan dengan error handling independen
- ✅ **Auto-Deposit** - Deposit otomatis jika saldo < threshold
- ✅ **Pending Detection** - Deteksi tagihan pending sebelum membuat deposit baru
- ✅ **WhatsApp Notifications** - Notifikasi ke grup dengan format berbeda per status
- ✅ **Persistent Session** - LocalAuth (tidak perlu scan QR setiap kali)
- ✅ **Modular Architecture** - Service-based design untuk maintainability

## 📁 Struktur Proyek

```
.
├── index.js                      # Controller utama (WhatsApp bot)
├── services/
│   ├── lapakgaming.js           # Service Lapakgaming (TODO: implementasi)
│   └── vexaagen.js              # Service Vexaagen (lengkap)
├── .env                         # Konfigurasi (copy dari .env.template)
├── .env.template                # Template konfigurasi
├── package.json                 # Dependencies
└── README-UNIFIED.md            # Dokumentasi ini
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Konfigurasi Environment

Copy `.env.template` ke `.env` dan isi semua kredensial:

```bash
cp .env.template .env
```

Edit `.env` dan isi:
- Kredensial Lapakgaming (user, pass, 2FA secret, SolveCaptcha API key)
- Kredensial Vexaagen (user, pass)
- WhatsApp Group ID (akan dipilih saat pertama kali run)
- Threshold saldo dan nominal deposit
- Feature flags (enable/disable per platform)

### 3. Implementasi Logic Lapakgaming

**PENTING**: File `services/lapakgaming.js` masih berupa skeleton. Anda perlu:

1. Copy logic dari `auto-login.js` ke fungsi `autoLogin()`:
   - `getCsrfToken()`
   - `bypassRecaptcha()` (submitCaptcha + pollCaptchaResult)
   - `submitLogin()`
   - `generate2FACode()`
   - `submit2FA()`

2. Copy logic dari `bot-whatsapp-web.js` ke fungsi `autoDeposit()`:
   - `autoDeposit()` - buat deposit baru
   - `getLatestDepositHistory()` - ambil data deposit terbaru

### 4. Jalankan Bot

```bash
node index.js
```

Saat pertama kali:
1. Scan QR Code dengan WhatsApp
2. Pilih grup untuk notifikasi
3. Bot akan mulai monitoring

## 📊 Return Format Services

Setiap service (`runLapakAutoDeposit()` dan `runVexaAutoDeposit()`) mengembalikan object dengan format standar:

```javascript
{
  status: 'SUCCESS' | 'PENDING' | 'ERROR',
  platform: 'LAPAKGAMING' | 'VEXAAGEN',
  data: {
    saldo: number,
    saldoFormatted: string,
    needsDeposit: boolean,
    depositData: object,    // jika deposit berhasil
    pendingData: object     // jika ada tagihan pending
  },
  message: string
}
```

### Status Types

- **SUCCESS**: Operasi berhasil (saldo aman atau deposit berhasil)
- **PENDING**: Ada tagihan pending yang belum dibayar
- **ERROR**: Terjadi error (saldo menipis tapi auto-deposit disabled, atau error lainnya)

## 🔧 Konfigurasi .env

### WhatsApp
```env
WA_GROUP_ID=                    # ID grup (auto-detect saat pertama run)
```

### Monitoring
```env
CHECK_INTERVAL_MINUTES=10       # Interval pengecekan (menit)
MIN_SALDO_THRESHOLD=1000000     # Threshold saldo minimum (Rp)
DEPOSIT_AMOUNT=10000000         # Nominal deposit otomatis (Rp)
```

### Feature Flags
```env
LAPAK_AUTO_DEPOSIT_ENABLED=true
VEXA_AUTO_DEPOSIT_ENABLED=true
LAPAK_MONITORING_ENABLED=true
VEXA_MONITORING_ENABLED=true
```

### Lapakgaming
```env
LAPAK_USER=your_email@example.com
LAPAK_PASS=your_password
LAPAK_2FA_SECRET=your_2fa_secret_key
LAPAK_PAYMENT_METHOD=VA_BCA
SOLVECAPTCHA_KEY=your_api_key
```

### Vexaagen
```env
VEXA_USER=your_email@example.com
VEXA_PASS=your_password
VEXA_PAYMENT_METHOD_ID=5        # 5 = BCA Manual
```

## 📱 Format Notifikasi WhatsApp

### Saldo Aman
```
✅ LAPAKGAMING - SALDO AMAN

💰 Saldo: Rp 5.000.000
📊 Status: Saldo masih di atas threshold
```

### Deposit Berhasil
```
✅ LAPAKGAMING - AUTO-DEPOSIT BERHASIL

💳 Detail Tagihan Pembayaran:
▪️ No. Faktur : 12345
▪️ Metode     : BCA Virtual Account
▪️ Nominal    : Rp 10.000.123
▪️ No. VA     : 1234567890

📊 Saldo Sebelumnya: Rp 500.000
```

### Tagihan Pending
```
⏳ LAPAKGAMING - TAGIHAN PENDING

Detail Pembayaran Deposit:
▪️ No. Faktur : 12345
▪️ Status     : PENDING / MENUNGGU PEMBAYARAN

⚠️ Auto-Deposit gagal dibuat karena ada tagihan yang belum dibayar!
```

## 🛠️ Troubleshooting

### Bot tidak bisa connect
```bash
# Hapus session lama
rm -rf .wwebjs_auth

# Jalankan ulang
node index.js
```

### Service error
- Cek log console untuk detail error
- Pastikan kredensial di .env benar
- Pastikan API key SolveCaptcha masih aktif (untuk Lapakgaming)

### Monitoring tidak jalan
- Cek feature flags di .env (harus `true`)
- Cek interval monitoring (minimal 1 menit)

## 📝 TODO

- [ ] Implementasi logic Lapakgaming di `services/lapakgaming.js`
- [ ] Testing end-to-end untuk kedua platform
- [ ] Error handling improvement
- [ ] Logging ke file
- [ ] Dashboard web (optional)

## 🔐 Security Notes

- **JANGAN** commit file `.env` ke git
- Simpan kredensial dengan aman
- Gunakan `.env.template` sebagai referensi
- Rotate API keys secara berkala

## 📄 License

Private project - All rights reserved