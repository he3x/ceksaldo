# Bot WhatsApp - Monitor Saldo Lapak Gaming

Bot WhatsApp untuk monitoring saldo Lapak Gaming secara otomatis dengan fitur **Auto-Deposit**.

## 🎯 Fitur

- ✅ **QR Code di Terminal** - Scan sekali, login otomatis selamanya
- ✅ **Auto-Detect Grup** - Pilih grup monitoring saat pertama kali
- ✅ **Scraping Saldo Otomatis** - Cek saldo real-time dari dashboard
- ✅ **Notifikasi WhatsApp** - Alert otomatis jika saldo < threshold
- ✅ **Auto-Deposit** - Deposit otomatis jika saldo menipis (NEW!)
- ✅ **Monitoring Berkala** - Opsional, cek saldo setiap X jam

---

## 📦 Instalasi

```bash
npm install
```

**Dependencies:**
- `whatsapp-web.js` - WhatsApp bot library
- `qrcode-terminal` - QR code di terminal
- `axios` - HTTP client untuk scraping
- `cheerio` - HTML parser

---

## 🚀 Cara Menggunakan

### 1. Update Cookie

Dapatkan cookie dari browser:

```bash
# Jalankan helper untuk convert cookie
node convert-cookies.js
```

Atau manual:
1. Buka https://www.lapakgaming.com/reseller/
2. Login ke akun Anda
3. Buka Developer Tools (F12) > Application > Cookies
4. Copy semua cookies
5. Paste ke `cookis-lapak.txt`
6. Jalankan `node convert-cookies.js`

### 2. Konfigurasi Bot

Edit `bot-whatsapp-web.js` baris 21-28:

```javascript
const THRESHOLD_SALDO = 1000000; // Batas minimum saldo (1 juta)

// Konfigurasi Auto-Deposit
const AUTO_DEPOSIT_ENABLED = true; // true = aktif, false = nonaktif
const DEPOSIT_METHOD = 'VA_BCA'; // Metode deposit
const DEPOSIT_AMOUNT = 10000000; // Jumlah deposit (minimal 10 juta)
```

**Metode Deposit yang Tersedia:**
- `VA_BCA` - Virtual Account BCA
- `VA_MANDIRI_XE` - Virtual Account Mandiri
- `TF_BCA_B2B` - Transfer BCA
- Dan metode lain sesuai Lapak Gaming

### 3. Jalankan Bot

```bash
node bot-whatsapp-web.js
```

**Proses Pertama Kali:**
1. QR code muncul di terminal
2. Scan dengan WhatsApp di HP
3. Bot menampilkan daftar grup
4. Pilih nomor grup untuk monitoring
5. Bot menyimpan konfigurasi
6. Bot langsung cek saldo

**Run Berikutnya:**
- Bot auto-login (tidak perlu scan QR)
- Langsung pakai grup tersimpan
- Langsung monitoring saldo

---

## ⚙️ Konfigurasi

### Threshold Saldo

Ubah batas minimum saldo:

```javascript
const THRESHOLD_SALDO = 500000; // 500 ribu
```

### Auto-Deposit

**Aktifkan/Nonaktifkan:**
```javascript
const AUTO_DEPOSIT_ENABLED = true; // atau false
```

**Ubah Metode Deposit:**
```javascript
const DEPOSIT_METHOD = 'VA_MANDIRI_XE'; // Ganti sesuai kebutuhan
```

**Ubah Jumlah Deposit:**
```javascript
const DEPOSIT_AMOUNT = 20000000; // 20 juta (minimal 10 juta)
```

### Monitoring Berkala

Uncomment baris 467-469 di `bot-whatsapp-web.js`:

```javascript
setInterval(() => {
  cekDanNotifikasi(client, groupId);
}, 60 * 60 * 1000); // Setiap 1 jam
```

Ubah interval sesuai kebutuhan:
- `60 * 60 * 1000` = 1 jam
- `30 * 60 * 1000` = 30 menit
- `6 * 60 * 60 * 1000` = 6 jam

### Ganti Grup Monitoring

```bash
# Hapus konfigurasi lama
Remove-Item bot-config.json -Force

# Jalankan ulang bot
node bot-whatsapp-web.js

# Pilih grup baru
```

---

## 🔄 Alur Kerja Bot

### Skenario 1: Saldo Aman (≥ Threshold)

```
1. Bot cek saldo → Rp2.500.000
2. Saldo ≥ Rp1.000.000 (threshold)
3. ✅ Tidak ada notifikasi
4. ✅ Tidak ada deposit
```

### Skenario 2: Saldo Menipis + Auto-Deposit OFF

```
1. Bot cek saldo → Rp67.518
2. Saldo < Rp1.000.000 (threshold)
3. ⚠️ Kirim notifikasi peringatan ke grup
4. ⚠️ Auto-deposit tidak aktif
5. ⏸️ Menunggu top-up manual
```

### Skenario 3: Saldo Menipis + Auto-Deposit ON

```
1. Bot cek saldo → Rp67.518
2. Saldo < Rp1.000.000 (threshold)
3. ⚠️ Kirim notifikasi peringatan ke grup
4. 💳 Auto-deposit aktif, mulai proses:
   a. GET csrf_token dari form deposit
   b. POST form deposit (method: VA_BCA, amount: 10 juta)
   c. Handle response (302 redirect = sukses)
5. ✅ Kirim notifikasi hasil deposit ke grup
6. 💰 Saldo akan bertambah setelah pembayaran
```

---

## 📱 Contoh Notifikasi WhatsApp

### Notifikasi Saldo Menipis

```
⚠️ PERINGATAN SALDO MENIPIS ⚠️

Saldo Lapakgaming kamu saat ini menipis!

💰 Sisa Saldo: Rp67.518
📊 Threshold: Rp1.000.000

Segera lakukan top-up agar transaksi tidak terganggu.

Pesan otomatis dari Bot Monitor Saldo
Waktu: 29/5/2026, 14:07:00
```

### Notifikasi Deposit Berhasil

```
✅ AUTO-DEPOSIT BERHASIL ✅

Deposit otomatis telah berhasil diproses!

💳 Method: VA_BCA
💰 Jumlah: Rp10.000.000
📊 Saldo Sebelumnya: Rp67.518

Deposit Rp10.000.000 via VA_BCA berhasil diproses.

Saldo akan bertambah setelah pembayaran dikonfirmasi.

Pesan otomatis dari Bot Monitor Saldo
Waktu: 29/5/2026, 14:07:30
```

### Notifikasi Deposit Gagal

```
❌ AUTO-DEPOSIT GAGAL ❌

Deposit otomatis gagal diproses!

💳 Method: VA_BCA
💰 Jumlah: Rp10.000.000
📊 Saldo Saat Ini: Rp67.518

⚠️ Error: CSRF token tidak ditemukan. Cookie mungkin expired.

Silakan lakukan deposit manual atau periksa konfigurasi bot.

Pesan otomatis dari Bot Monitor Saldo
Waktu: 29/5/2026, 14:07:30
```

---

## 🛠️ Troubleshooting

### Cookie Expired

**Gejala:**
- Error: "Saldo tidak ditemukan"
- Error: "CSRF token tidak ditemukan"

**Solusi:**
```bash
node convert-cookies.js
```
Update cookie di `cookis-lapak.txt` dengan cookie baru dari browser.

### QR Code Tidak Muncul

**Solusi:**
```bash
# Hapus session lama
Remove-Item .wwebjs_auth -Recurse -Force

# Jalankan ulang
node bot-whatsapp-web.js
```

### Bot Disconnect

**Solusi:**
- Pastikan koneksi internet stabil
- Jangan logout WhatsApp di HP
- Jangan hapus "Linked Devices" di WhatsApp

### Deposit Gagal

**Kemungkinan Penyebab:**
1. Cookie expired → Update cookie
2. Method tidak valid → Cek metode deposit yang tersedia
3. Amount < 10 juta → Minimal deposit 10 juta IDR
4. Server Lapak Gaming down → Coba lagi nanti

---

## 📁 Struktur File

```
cek-saldo/
├── bot-whatsapp-web.js      # Bot utama (all-in-one)
├── scrape-saldo-clean.js    # Scraping standalone
├── convert-cookies.js       # Helper update cookie
├── cookis-lapak.txt         # Cookie storage
├── bot-config.json          # Konfigurasi grup (auto-generated)
├── package.json             # Dependencies
├── README.md                # Dokumentasi
├── .wwebjs_auth/            # WhatsApp session
├── .wwebjs_cache/           # WhatsApp cache
└── node_modules/            # Dependencies
```

---

## 💡 Tips & Best Practices

1. **Monitoring Berkala:** Aktifkan setInterval untuk auto-check setiap jam
2. **Backup Cookie:** Simpan cookie di tempat aman untuk recovery
3. **Test Mode:** Set `AUTO_DEPOSIT_ENABLED = false` saat testing
4. **Multiple Bots:** Copy folder untuk monitoring grup berbeda
5. **Threshold Realistis:** Set threshold sesuai volume transaksi harian
6. **Deposit Amount:** Set amount yang cukup untuk beberapa hari

---

## 🔒 Keamanan

- ⚠️ **Jangan share cookie** ke orang lain
- ⚠️ **Jangan commit cookie** ke Git (sudah di .gitignore)
- ⚠️ **Update cookie berkala** untuk keamanan
- ⚠️ **Monitor aktivitas deposit** untuk deteksi anomali

---

## 📊 Status

**Project:** ✅ Production Ready  
**Dependencies:** ✅ 255 packages, 0 vulnerabilities  
**Bot Library:** ✅ whatsapp-web.js (stable)  
**Auto-Deposit:** ✅ Fully Functional  

---

## 🆘 Support

Jika ada masalah:
1. Cek troubleshooting di atas
2. Pastikan cookie up-to-date
3. Pastikan koneksi internet stabil
4. Restart bot jika perlu

---

**Happy Monitoring! 🎉**