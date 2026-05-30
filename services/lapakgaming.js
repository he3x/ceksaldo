/**
 * Lapakgaming Service Module
 * 
 * Modul untuk menangani semua operasi Lapakgaming:
 * - Auto-login dengan bypass reCAPTCHA dan 2FA
 * - Cek saldo via web scraping
 * - Auto-deposit dengan deteksi tagihan pending
 * 
 * Return format standar:
 * {
 *   status: 'SUCCESS' | 'PENDING' | 'ERROR',
 *   platform: 'LAPAKGAMING',
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
const cheerio = require('cheerio');
const qs = require('qs');
const fs = require('fs');
const { TOTP, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');

// ==================== KONFIGURASI ====================

const CONFIG = {
  // Kredensial (dari .env)
  username: process.env.LAPAK_USER,
  password: process.env.LAPAK_PASS,
  totpSecret: process.env.LAPAK_2FA_SECRET,
  
  // URLs
  loginUrl: process.env.LAPAK_LOGIN_URL || 'https://www.lapakgaming.com/auth/login',
  dashboardUrl: process.env.LAPAK_DASHBOARD_URL || 'https://www.lapakgaming.com/reseller/',
  depositUrl: process.env.LAPAK_DEPOSIT_URL || 'https://www.lapakgaming.com/reseller/deposit/new_international',
  
  // reCAPTCHA
  siteKey: process.env.LAPAK_SITEKEY || '6LfpQvMgAAAAAG8jTpjLTrJ0AHAYZf8AW6te3mDA',
  solveCaptchaApiKey: process.env.SOLVECAPTCHA_KEY,
  captchaInUrl: process.env.SOLVECAPTCHA_IN_URL || 'http://api.solvecaptcha.com/in.php',
  captchaResUrl: process.env.SOLVECAPTCHA_RES_URL || 'http://api.solvecaptcha.com/res.php',
  
  // Deposit
  paymentMethod: process.env.LAPAK_PAYMENT_METHOD || 'VA_BCA',
  depositAmount: parseInt(process.env.DEPOSIT_AMOUNT) || 10000000,
  
  // Thresholds
  minSaldoThreshold: process.env.MIN_SALDO_THRESHOLD ? parseInt(process.env.MIN_SALDO_THRESHOLD) : 1000000,
  
  // Feature flags
  autoDepositEnabled: process.env.LAPAK_AUTO_DEPOSIT_ENABLED === 'true',
  
  // Timing
  captchaPollInterval: parseInt(process.env.CAPTCHA_POLL_INTERVAL) || 5000,
  captchaMaxAttempts: parseInt(process.env.CAPTCHA_MAX_ATTEMPTS) || 24,
};

// Cookie management
let COOKIE_CACHE = null;
const COOKIE_FILE = 'cookis-lapak.txt';

// ==================== HELPER FUNCTIONS ====================

function formatRupiah(angka) {
  return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseSaldoToNumber(saldoString) {
  const angka = saldoString
    .replace(/Rp/g, '')
    .replace(/\./g, '')
    .replace(/\s/g, '')
    .trim();
  return parseInt(angka, 10);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== COOKIE MANAGEMENT ====================

/**
 * Parse cookies dari response headers
 */
function parseCookies(headers) {
  const cookies = {};
  const setCookieHeader = headers['set-cookie'];
  
  if (setCookieHeader) {
    setCookieHeader.forEach(cookie => {
      const parts = cookie.split(';')[0].split('=');
      const name = parts[0].trim();
      const value = parts[1] ? parts[1].trim() : '';
      cookies[name] = value;
    });
  }
  
  return cookies;
}

/**
 * Convert cookie object ke string
 */
function cookiesToString(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Merge cookies
 */
function mergeCookies(existingCookies, newCookies) {
  return { ...existingCookies, ...newCookies };
}

/**
 * Save cookie to file
 */
function saveCookie(cookieString) {
  try {
    fs.writeFileSync(COOKIE_FILE, cookieString, 'utf8');
    console.log('[LAPAK] 💾 Cookie tersimpan ke file');
  } catch (error) {
    console.error('[LAPAK] ⚠️  Gagal simpan cookie:', error.message);
  }
}

/**
 * Load cookie from file
 */
function loadCookie() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const cookie = fs.readFileSync(COOKIE_FILE, 'utf8').trim();
      if (cookie) {
        console.log('[LAPAK] 📂 Cookie dimuat dari file');
        return cookie;
      }
    }
  } catch (error) {
    console.error('[LAPAK] ⚠️  Gagal load cookie:', error.message);
  }
  return null;
}

/**
 * Get cookie with auto-refresh
 */
async function getCookie() {
  // Coba load dari cache memory
  if (COOKIE_CACHE) {
    return COOKIE_CACHE;
  }
  
  // Coba load dari file
  const savedCookie = loadCookie();
  if (savedCookie) {
    COOKIE_CACHE = savedCookie;
    return COOKIE_CACHE;
  }
  
  // Jika tidak ada, login baru
  console.log('[LAPAK] 🔄 Tidak ada cookie, melakukan auto-login...');
  COOKIE_CACHE = await autoLogin();
  saveCookie(COOKIE_CACHE);
  return COOKIE_CACHE;
}

// ==================== AUTO-LOGIN FUNCTIONS ====================

/**
 * Ambil CSRF token dari halaman login
 */
async function getCsrfToken() {
  try {
    console.log('[LAPAK] 🔐 Mengambil CSRF token...');
    
    const response = await axios.get(CONFIG.loginUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const csrfToken = $('#csrf_token').val();
    
    if (!csrfToken) {
      throw new Error('CSRF token tidak ditemukan');
    }
    
    const cookies = parseCookies(response.headers);
    console.log('[LAPAK] ✅ CSRF token berhasil diambil');
    
    return { csrfToken, cookies };
  } catch (error) {
    console.error('[LAPAK] ❌ Error getCsrfToken:', error.message);
    throw error;
  }
}

/**
 * Submit captcha ke SolveCaptcha API
 */
async function submitCaptcha() {
  try {
    console.log('[LAPAK] 🤖 Mengirim reCAPTCHA ke SolveCaptcha...');
    
    const params = {
      key: CONFIG.solveCaptchaApiKey,
      method: 'userrecaptcha',
      googlekey: CONFIG.siteKey,
      pageurl: CONFIG.loginUrl,
      json: 1
    };
    
    const response = await axios.get(CONFIG.captchaInUrl, { params });
    
    if (response.data.status !== 1) {
      throw new Error(`SolveCaptcha error: ${response.data.request || 'Unknown'}`);
    }
    
    console.log('[LAPAK] ✅ Captcha submitted, ID:', response.data.request);
    return response.data.request;
  } catch (error) {
    console.error('[LAPAK] ❌ Error submitCaptcha:', error.message);
    throw error;
  }
}

/**
 * Poll hasil captcha
 */
async function pollCaptchaResult(captchaId) {
  try {
    console.log('[LAPAK] 🔄 Menunggu hasil captcha...');
    
    for (let attempt = 1; attempt <= CONFIG.captchaMaxAttempts; attempt++) {
      const params = {
        key: CONFIG.solveCaptchaApiKey,
        action: 'get',
        id: captchaId,
        json: 1
      };
      
      const response = await axios.get(CONFIG.captchaResUrl, { params });
      
      if (response.data.status === 1) {
        console.log('[LAPAK] ✅ Captcha solved!');
        return response.data.request;
      }
      
      if (attempt < CONFIG.captchaMaxAttempts) {
        await sleep(CONFIG.captchaPollInterval);
      }
    }
    
    throw new Error('Timeout: Captcha tidak selesai');
  } catch (error) {
    console.error('[LAPAK] ❌ Error pollCaptcha:', error.message);
    throw error;
  }
}

/**
 * Bypass reCAPTCHA
 */
async function bypassRecaptcha() {
  const captchaId = await submitCaptcha();
  const captchaToken = await pollCaptchaResult(captchaId);
  return captchaToken;
}

/**
 * Submit form login
 */
async function submitLogin(csrfToken, captchaToken, cookies) {
  try {
    console.log('[LAPAK] 📤 Submit login...');
    
    const payload = {
      csrf_token: csrfToken,
      user: CONFIG.username,
      pass: CONFIG.password,
      'g-recaptcha-response': captchaToken,
      login: ''
    };
    
    const response = await axios.post(CONFIG.loginUrl, qs.stringify(payload), {
      headers: {
        'Cookie': cookiesToString(cookies),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': CONFIG.loginUrl
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    const newCookies = parseCookies(response.headers);
    const mergedCookies = mergeCookies(cookies, newCookies);
    
    const pageText = response.data;
    const requires2FA = pageText.includes('2FA') || 
                        pageText.includes('two-factor') || 
                        pageText.includes('authenticator');
    
    console.log('[LAPAK] ✅ Login berhasil' + (requires2FA ? ', perlu 2FA' : ''));
    return { success: true, cookies: mergedCookies, requires2FA };
  } catch (error) {
    if (error.response && error.response.status === 302) {
      const newCookies = parseCookies(error.response.headers);
      const mergedCookies = mergeCookies(cookies, newCookies);
      console.log('[LAPAK] ✅ Login berhasil (redirect)');
      return { success: true, cookies: mergedCookies, requires2FA: false };
    }
    console.error('[LAPAK] ❌ Error submitLogin:', error.message);
    throw error;
  }
}

/**
 * Generate 2FA code
 */
async function generate2FACode() {
  try {
    console.log('[LAPAK] 🔢 Generate 2FA code...');
    
    if (!CONFIG.totpSecret) {
      throw new Error('TOTP Secret tidak dikonfigurasi');
    }
    
    const cleanSecret = CONFIG.totpSecret.trim().toUpperCase();
    
    const totp = new TOTP({
      crypto: new NobleCryptoPlugin(),
      base32: new ScureBase32Plugin()
    });
    
    const token = await totp.generate({ secret: cleanSecret });
    
    if (!/^\d{6}$/.test(token)) {
      throw new Error(`Token tidak valid: ${token}`);
    }
    
    console.log('[LAPAK] ✅ 2FA code generated:', token);
    return token;
  } catch (error) {
    console.error('[LAPAK] ❌ Error generate2FA:', error.message);
    throw error;
  }
}

/**
 * Submit 2FA code
 */
async function submit2FA(totpCode, cookies, csrfToken) {
  try {
    console.log('[LAPAK] 📤 Submit 2FA...');
    
    const payload = {
      csrf_token: csrfToken,
      user: CONFIG.username,
      pass: CONFIG.password,
      totp_value: totpCode
    };
    
    const response = await axios.post(CONFIG.loginUrl, qs.stringify(payload), {
      headers: {
        'Cookie': cookiesToString(cookies),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': CONFIG.loginUrl
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    const newCookies = parseCookies(response.headers);
    const mergedCookies = mergeCookies(cookies, newCookies);
    
    console.log('[LAPAK] ✅ 2FA verification berhasil');
    return { success: true, cookies: mergedCookies };
  } catch (error) {
    if (error.response && error.response.status === 302) {
      const newCookies = parseCookies(error.response.headers);
      const mergedCookies = mergeCookies(cookies, newCookies);
      console.log('[LAPAK] ✅ 2FA berhasil (redirect)');
      return { success: true, cookies: mergedCookies };
    }
    console.error('[LAPAK] ❌ Error submit2FA:', error.message);
    throw error;
  }
}

/**
 * Main auto-login function
 */
async function autoLogin() {
  try {
    console.log('[LAPAK] 🔐 Memulai auto-login...');
    
    const { csrfToken, cookies: initialCookies } = await getCsrfToken();
    const captchaToken = await bypassRecaptcha();
    const loginResult = await submitLogin(csrfToken, captchaToken, initialCookies);
    
    let finalCookies = loginResult.cookies;
    
    if (loginResult.requires2FA) {
      const totpCode = await generate2FACode();
      const twoFAResult = await submit2FA(totpCode, finalCookies, csrfToken);
      if (twoFAResult.success) {
        finalCookies = twoFAResult.cookies;
      }
    }
    
    const cookieString = cookiesToString(finalCookies);
    console.log('[LAPAK] ✅ Auto-login berhasil!');
    
    // Simpan cookie ke file
    saveCookie(cookieString);
    
    return cookieString;
  } catch (error) {
    console.error('[LAPAK] ❌ Auto-login gagal:', error.message);
    throw error;
  }
}

// ==================== SCRAPING FUNCTIONS ====================

/**
 * Cek saldo Lapakgaming via web scraping
 * @returns {Promise<Object>} { saldo: number, saldoFormatted: string }
 */
async function cekSaldo() {
  try {
    console.log('[LAPAK] 🔍 Mengecek saldo...');
    
    // Get cookie dengan auto-refresh
    const cookie = await getCookie();
    
    const response = await axios.get(CONFIG.dashboardUrl, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const saldoString = $('span b.font-20').text().trim();

    if (!saldoString) {
      // Cookie expired, hapus dan retry
      console.log('[LAPAK] ⚠️  Cookie expired, refresh...');
      COOKIE_CACHE = null;
      if (fs.existsSync(COOKIE_FILE)) {
        fs.unlinkSync(COOKIE_FILE);
      }
      return await cekSaldo(); // Retry
    }

    const saldoAngka = parseSaldoToNumber(saldoString);
    console.log('[LAPAK] ✅ Saldo:', formatRupiah(saldoAngka));
    
    return {
      saldo: saldoAngka,
      saldoFormatted: saldoString
    };

  } catch (error) {
    console.error('[LAPAK] ❌ Error cek saldo:', error.message);
    throw error;
  }
}

// ==================== DEPOSIT FUNCTIONS ====================

/**
 * Get latest deposit history
 */
async function getLatestDepositHistory() {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 3000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[LAPAK] 🔍 Mengambil riwayat deposit (${attempt}/${MAX_RETRIES})...`);
      
      // Get cookie dengan auto-refresh
      const cookie = await getCookie();
      
      const apiUrl = 'https://www.lapakgaming.com/reseller/deposit/list?draw=1&columns%5B0%5D%5Bdata%5D=0&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=true&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=1&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=2&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=3&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=4&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=5&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=true&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=6&columns%5B6%5D%5Bname%5D=&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=true&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B7%5D%5Bdata%5D=7&columns%5B7%5D%5Bname%5D=&columns%5B7%5D%5Bsearchable%5D=true&columns%5B7%5D%5Borderable%5D=true&columns%5B7%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B7%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B8%5D%5Bdata%5D=8&columns%5B8%5D%5Bname%5D=&columns%5B8%5D%5Bsearchable%5D=true&columns%5B8%5D%5Borderable%5D=true&columns%5B8%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B8%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=desc&start=0&length=1&search%5Bvalue%5D=&search%5Bregex%5D=false';
      
      const response = await axios.get(apiUrl, {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.lapakgaming.com/reseller/deposit/history'
        }
      });
      
      if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
        throw new Error('Format response tidak valid');
      }
      
      if (response.data.data.length === 0) {
        throw new Error('Tidak ada data transaksi');
      }
      
      const row = response.data.data[0];
      const faktur = (row[1] || '').replace('#', '').trim();
      const metode = (row[2] || '').trim();
      const catatanRaw = (row[3] || '').trim();
      let va = catatanRaw;
      if (catatanRaw.includes(' A/N ')) {
        va = catatanRaw.split(' A/N ')[0].trim();
      }
      const transfer = (row[4] || '').trim();
      
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
      
      console.log('[LAPAK] ✅ Data riwayat berhasil diambil');
      
      return {
        success: true,
        data: {
          faktur,
          metode,
          nomorVA: va,
          nominal: transfer,
          status,
          statusEmoji
        }
      };
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error('[LAPAK] ❌ Gagal ambil riwayat setelah', MAX_RETRIES, 'percobaan');
        return { success: false, data: null };
      }
      console.log(`[LAPAK] ⚠️  Percobaan ${attempt} gagal, retry...`);
      await sleep(RETRY_DELAY);
    }
  }
  
  return { success: false, data: null };
}

/**
 * Auto-deposit function
 */
async function autoDeposit() {
  try {
    console.log('[LAPAK] 💳 Memulai auto-deposit...');
    console.log(`[LAPAK]    Method: ${CONFIG.paymentMethod}`);
    console.log(`[LAPAK]    Amount: ${formatRupiah(CONFIG.depositAmount)}`);
    
    // Get cookie dengan auto-refresh
    const cookie = await getCookie();
    
    // Step 1: Get CSRF token
    console.log('[LAPAK] 🔍 Mengambil CSRF token...');
    const getResponse = await axios.get(CONFIG.depositUrl, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(getResponse.data);
    const csrfToken = $('#csrf_token').val();
    
    if (!csrfToken) {
      throw new Error('CSRF token tidak ditemukan');
    }
    
    console.log('[LAPAK] ✅ CSRF token berhasil diambil');
    
    // Step 2: Submit deposit
    console.log('[LAPAK] 📤 Mengirim request deposit...');
    
    const formData = new URLSearchParams();
    formData.append('csrf_token', csrfToken);
    formData.append('lang_code', 'id');
    formData.append('currency', 'IDR');
    formData.append('method', CONFIG.paymentMethod);
    formData.append('quantity', CONFIG.depositAmount.toString());
    formData.append('deposit_international', '');
    
    try {
      const postResponse = await axios.post(
        CONFIG.depositUrl,
        formData.toString(),
        {
          headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': CONFIG.depositUrl
          },
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400
        }
      );
      
      if (postResponse.status >= 200 && postResponse.status < 300) {
        const $result = cheerio.load(postResponse.data);
        const pageText = postResponse.data;
        
        if (pageText.includes('permintaan setoran yang tertunda')) {
          console.log('[LAPAK] ⚠️  Terdeteksi tagihan pending');
          const historyData = await getLatestDepositHistory();
          
          return {
            success: false,
            isPending: true,
            pendingData: historyData.data,
            message: 'Ada tagihan pending yang belum dibayar'
          };
        }
        
        const errorMsg = $result('.alert-danger').text().trim();
        if (errorMsg) {
          throw new Error(`Deposit gagal: ${errorMsg}`);
        }
      }
      
      console.log('[LAPAK] ✅ Deposit berhasil diproses');
      console.log('[LAPAK] ⏳ Menunggu 3 detik...');
      await sleep(3000);
      
      console.log('[LAPAK] 📋 Mengambil detail deposit...');
      const historyData = await getLatestDepositHistory();
      
      if (historyData.success) {
        return {
          success: true,
          isPending: false,
          depositData: historyData.data,
          message: `Deposit ${formatRupiah(CONFIG.depositAmount)} berhasil`
        };
      } else {
        return {
          success: true,
          isPending: false,
          message: `Deposit ${formatRupiah(CONFIG.depositAmount)} berhasil`
        };
      }
      
    } catch (error) {
      if (error.response && error.response.status === 302) {
        console.log('[LAPAK] ✅ Deposit berhasil (redirect)');
        await sleep(3000);
        
        const historyData = await getLatestDepositHistory();
        
        if (historyData.success) {
          return {
            success: true,
            isPending: false,
            depositData: historyData.data,
            message: `Deposit ${formatRupiah(CONFIG.depositAmount)} berhasil`
          };
        } else {
          return {
            success: true,
            isPending: false,
            message: `Deposit ${formatRupiah(CONFIG.depositAmount)} berhasil`
          };
        }
      }
      throw error;
    }
    
  } catch (error) {
    console.error('[LAPAK] ❌ Error auto-deposit:', error.message);
    return {
      success: false,
      isPending: false,
      message: `Deposit gagal: ${error.message}`
    };
  }
}

// ==================== MAIN FUNCTION ====================

/**
 * Fungsi utama untuk monitoring dan auto-deposit Lapakgaming
 * @returns {Promise<Object>} Status object dengan format standar
 */
async function runLapakAutoDeposit() {
  try {
    console.log('\n[LAPAK] ═══════════════════════════════════════════');
    console.log('[LAPAK] 🚀 Memulai monitoring Lapakgaming...');
    console.log('[LAPAK] ═══════════════════════════════════════════\n');
    
    // Debug: Log konfigurasi
    console.log('[LAPAK] 🔧 Konfigurasi:');
    console.log(`[LAPAK]    MIN_SALDO_THRESHOLD dari .env: "${process.env.MIN_SALDO_THRESHOLD}"`);
    console.log(`[LAPAK]    Parsed value: ${CONFIG.minSaldoThreshold}`);
    console.log(`[LAPAK]    Auto-Deposit Enabled: ${CONFIG.autoDepositEnabled}`);
    console.log('');
    
    // Step 1: Cek saldo
    const { saldo, saldoFormatted } = await cekSaldo();
    
    console.log(`[LAPAK] 📊 Saldo: ${formatRupiah(saldo)}`);
    console.log(`[LAPAK] 📊 Threshold: ${formatRupiah(CONFIG.minSaldoThreshold)}`);
    console.log(`[LAPAK] 📊 Auto-Deposit: ${CONFIG.autoDepositEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    // Step 2: Cek apakah perlu deposit
    if (saldo >= CONFIG.minSaldoThreshold) {
      console.log('[LAPAK] ✅ Saldo aman, tidak perlu deposit\n');
      
      return {
        status: 'SUCCESS',
        platform: 'LAPAKGAMING',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: false
        },
        message: `Saldo aman: ${formatRupiah(saldo)}`
      };
    }
    
    // Saldo di bawah threshold
    console.log('[LAPAK] ⚠️  Saldo di bawah threshold!');
    
    if (!CONFIG.autoDepositEnabled) {
      console.log('[LAPAK] ⚠️  Auto-deposit tidak diaktifkan\n');
      
      return {
        status: 'ERROR',
        platform: 'LAPAKGAMING',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: true
        },
        message: `Saldo menipis (${formatRupiah(saldo)}) tapi auto-deposit tidak aktif`
      };
    }
    
    // Step 3: Jalankan auto-deposit
    console.log('[LAPAK] 💳 Menjalankan auto-deposit...');
    const depositResult = await autoDeposit();
    
    if (depositResult.success) {
      console.log('[LAPAK] ✅ Auto-deposit berhasil!\n');
      
      return {
        status: 'SUCCESS',
        platform: 'LAPAKGAMING',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: true,
          depositData: depositResult.depositData
        },
        message: `Deposit berhasil: ${CONFIG.paymentMethod} - ${formatRupiah(CONFIG.depositAmount)}`
      };
    } else if (depositResult.isPending) {
      console.log('[LAPAK] ⚠️  Tagihan pending ditemukan\n');
      
      return {
        status: 'PENDING',
        platform: 'LAPAKGAMING',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: true,
          pendingData: depositResult.pendingData
        },
        message: 'Ada tagihan pending yang belum dibayar'
      };
    } else {
      console.log('[LAPAK] ❌ Auto-deposit gagal\n');
      
      return {
        status: 'ERROR',
        platform: 'LAPAKGAMING',
        data: {
          saldo,
          saldoFormatted,
          needsDeposit: true
        },
        message: `Deposit gagal: ${depositResult.message}`
      };
    }
    
  } catch (error) {
    console.error('[LAPAK] ❌ Error:', error.message);
    console.error('[LAPAK] ═══════════════════════════════════════════\n');
    
    return {
      status: 'ERROR',
      platform: 'LAPAKGAMING',
      data: null,
      message: `Error: ${error.message}`
    };
  }
}

// ==================== EXPORTS ====================

module.exports = {
  runLapakAutoDeposit,
  cekSaldo,
  autoDeposit,
  CONFIG
};