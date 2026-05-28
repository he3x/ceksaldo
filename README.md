# Cookie Loader - Lapakgaming

Program Node.js untuk load dan manage cookies dari file cookies-lapakgaming.txt. Mendukung integrasi dengan Puppeteer dan Axios untuk web scraping dan automation.

## 🚀 Features

- ✅ Load cookies dari file JSON
- ✅ Convert cookies ke format Cookie header string
- ✅ Integrasi dengan Puppeteer untuk browser automation
- ✅ Integrasi dengan Axios untuk HTTP requests
- ✅ Filter cookies berdasarkan domain
- ✅ Check expiration status cookies
- ✅ Save/backup cookies ke file baru
- ✅ Display informasi cookies yang detail

## 📋 Requirements

- Node.js v14 atau lebih baru
- npm atau yarn

## 📦 Installation

1. Clone repository ini:
```bash
git clone https://github.com/he3x/ceksaldo.git
cd ceksaldo
```

2. Install dependencies:
```bash
npm install
```

## 🎯 Usage

### Basic Usage

Jalankan program utama untuk melihat informasi cookies:

```bash
node index.js
```

### Run Examples

Jalankan file example untuk melihat berbagai contoh penggunaan:

```bash
node example.js
```

atau

```bash
npm test
```

### Menggunakan sebagai Module

```javascript
const CookieLoader = require('./index.js');

// Inisialisasi
const loader = new CookieLoader('cookies-lapakgaming.txt');

// Load cookies
const cookies = loader.loadCookies();

// Get cookie string untuk HTTP headers
const cookieString = loader.toCookieString();

// Get specific cookie value
const sessionId = loader.getCookieValue('PHPSESSID');

// Check expiration
const status = loader.checkExpiration();
console.log(`Valid cookies: ${status.valid}/${status.total}`);
```

### Dengan Puppeteer

```javascript
const puppeteer = require('puppeteer');
const CookieLoader = require('./index.js');

async function scrapeWithCookies() {
  const loader = new CookieLoader('cookies-lapakgaming.txt');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set cookies sebelum navigate
  await loader.setPuppeteerCookies(page);
  
  // Navigate ke website
  await page.goto('https://www.lapakgaming.com');
  
  // Your scraping code here...
  
  await browser.close();
}
```

### Dengan Axios

```javascript
const axios = require('axios');
const CookieLoader = require('./index.js');

async function fetchWithCookies() {
  const loader = new CookieLoader('cookies-lapakgaming.txt');
  
  // Get axios config dengan cookies
  const config = loader.getAxiosConfig();
  
  // Make request
  const response = await axios.get('https://www.lapakgaming.com', config);
  console.log(response.data);
}
```

## 📚 API Documentation

### Class: CookieLoader

#### Constructor

```javascript
new CookieLoader(cookieFilePath = 'cookies-lapakgaming.txt')
```

#### Methods

##### `loadCookies()`
Load cookies dari file dan return array of cookie objects.

##### `getCookies()`
Get cookies yang sudah di-load (auto-load jika belum).

##### `toCookieString()`
Convert cookies ke format Cookie header string untuk HTTP requests.

##### `getCookiesByDomain(domain)`
Filter cookies berdasarkan domain tertentu.

##### `getCookieValue(name)`
Get value dari cookie berdasarkan name.

##### `checkExpiration()`
Check status expiration cookies. Return object dengan info:
- `total`: Total cookies
- `valid`: Jumlah cookies yang masih valid
- `expired`: Jumlah cookies yang expired
- `expiredCookies`: Array nama cookies yang expired

##### `setPuppeteerCookies(page)`
Set cookies ke Puppeteer page object (async).

##### `getAxiosConfig(additionalConfig = {})`
Get axios config object dengan cookies dan headers.

##### `saveCookies(filePath, cookies = null)`
Save cookies ke file baru.

##### `displayInfo()`
Display informasi lengkap tentang cookies ke console.

## 📁 File Structure

```
ceksaldo/
├── index.js                    # Main program (CookieLoader class)
├── example.js                  # Contoh penggunaan
├── package.json                # NPM package configuration
├── cookies-lapakgaming.txt     # File cookies (JSON format)
└── README.md                   # Dokumentasi
```

## 🔧 Cookie File Format

File cookies harus dalam format JSON array dengan struktur:

```json
[
  {
    "domain": ".lapakgaming.com",
    "expirationDate": 1814519866.394509,
    "hostOnly": false,
    "httpOnly": false,
    "name": "cookie_name",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "cookie_value"
  }
]
```

Format ini kompatibel dengan Chrome DevTools, Puppeteer, dan browser automation tools lainnya.

## 🛠️ Development

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
npm test
```

## ⚠️ Important Notes

- Pastikan file `cookies-lapakgaming.txt` ada di root directory
- Cookies mungkin expired seiring waktu, perlu di-update secara berkala
- Jangan share cookies file ke public karena berisi session information
- Gunakan cookies dengan bijak dan sesuai terms of service website

## 📝 License

MIT License

## 👤 Author

sidiq aminnudin (sidiqaminnudin@gmail.com)

## 🤝 Contributing

Contributions, issues, dan feature requests are welcome!

## 📞 Support

Jika ada pertanyaan atau masalah, silakan buat issue di repository ini.
