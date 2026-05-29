const CookieLoader = require('./index.js');

/**
 * Script untuk cek saldo di lapakgaming.com
 * Menggunakan cookies yang sudah tersimpan
 */

async function cekSaldoPuppeteer() {
  console.log('🔍 Cek Saldo Lapakgaming - Puppeteer Method\n');
  
  try {
    const puppeteer = require('puppeteer');
    const loader = new CookieLoader('cookies-lapakgaming.txt');
    
    console.log('📂 Loading cookies...');
    loader.loadCookies();
    
    console.log('🌐 Launching browser...');
    const browser = await puppeteer.launch({
      headless: false, // Set true untuk headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set cookies
    console.log('🍪 Setting cookies...');
    await loader.setPuppeteerCookies(page);
    
    // Navigate langsung ke halaman reseller (tempat saldo berada)
    console.log('📄 Navigating to lapakgaming.com/reseller/...');
    await page.goto('https://www.lapakgaming.com/reseller/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Try to find saldo/balance information
    console.log('💰 Mencari informasi saldo di halaman reseller...\n');
    
    // Method 1: Look for common balance selectors
    const possibleSelectors = [
      // Selector spesifik untuk saldo di halaman reseller
      '#home-grid > div.row.card-container.p-0.title-card > div > div.greetings-container > span:nth-child(2) > b',
      '.greetings-container span:nth-child(2) b',
      '.greetings-container b',
      // Generic selectors sebagai fallback
      '.balance',
      '.saldo',
      '#balance',
      '#saldo',
      '[class*="balance"]',
      '[class*="saldo"]',
      '[id*="balance"]',
      '[id*="saldo"]',
      '.wallet',
      '.credit',
      '.user-balance',
      '.account-balance'
    ];
    
    let saldoFound = false;
    
    for (const selector of possibleSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await page.evaluate(el => el.textContent, element);
          if (text && text.trim()) {
            console.log(`✓ Saldo ditemukan (${selector}): ${text.trim()}`);
            saldoFound = true;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Method 2: Search for text containing "saldo" or "balance"
    if (!saldoFound) {
      console.log('🔎 Mencari dengan text search...');
      const bodyText = await page.evaluate(() => document.body.innerText);
      
      // Look for patterns like "Rp 1.000.000" or "Saldo: Rp 500.000"
      const patterns = [
        /saldo[:\s]*Rp[\s\d.,]+/gi,
        /balance[:\s]*Rp[\s\d.,]+/gi,
        /kredit[:\s]*Rp[\s\d.,]+/gi,
        /wallet[:\s]*Rp[\s\d.,]+/gi
      ];
      
      for (const pattern of patterns) {
        const matches = bodyText.match(pattern);
        if (matches && matches.length > 0) {
          console.log('✓ Informasi saldo ditemukan:');
          matches.forEach(match => console.log(`  - ${match.trim()}`));
          saldoFound = true;
        }
      }
    }
    
    // Method 3: Check if there's an account/profile page
    if (!saldoFound) {
      console.log('\n🔍 Mencoba halaman akun/profile...');
      
      // Try common account URLs
      const accountUrls = [
        'https://www.lapakgaming.com/account',
        'https://www.lapakgaming.com/profile',
        'https://www.lapakgaming.com/user',
        'https://www.lapakgaming.com/dashboard',
        'https://www.lapakgaming.com/my-account'
      ];
      
      for (const url of accountUrls) {
        try {
          console.log(`  Trying: ${url}`);
          const response = await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 10000 
          });
          
          if (response.status() === 200) {
            await page.waitForTimeout(2000);
            
            // Try to find balance again
            for (const selector of possibleSelectors) {
              try {
                const element = await page.$(selector);
                if (element) {
                  const text = await page.evaluate(el => el.textContent, element);
                  if (text && text.trim()) {
                    console.log(`  ✓ Saldo ditemukan di ${url}:`);
                    console.log(`    ${text.trim()}`);
                    saldoFound = true;
                    break;
                  }
                }
              } catch (e) {
                // Continue
              }
            }
            
            if (saldoFound) break;
          }
        } catch (e) {
          // URL not found, continue
        }
      }
    }
    
    if (!saldoFound) {
      console.log('\n⚠️  Saldo tidak ditemukan secara otomatis.');
      console.log('💡 Tips:');
      console.log('   1. Periksa browser yang terbuka untuk melihat halaman');
      console.log('   2. Cari menu "Akun", "Profile", atau "Wallet"');
      console.log('   3. Update script dengan selector yang tepat');
      console.log('   4. Atau gunakan browser DevTools untuk inspect element saldo');
    }
    
    // Take screenshot
    const screenshotPath = 'saldo-screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Screenshot disimpan: ${screenshotPath}`);
    
    // Keep browser open for manual inspection
    console.log('\n⏳ Browser akan tetap terbuka selama 30 detik untuk inspeksi manual...');
    console.log('   Tekan Ctrl+C untuk menutup lebih cepat.');
    await page.waitForTimeout(30000);
    
    await browser.close();
    console.log('\n✓ Browser ditutup.');
    
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      console.error('\n❌ Error: Puppeteer belum terinstall');
      console.log('   Jalankan: npm install');
    } else {
      console.error('\n❌ Error:', error.message);
    }
    process.exit(1);
  }
}

async function cekSaldoAxios() {
  console.log('🔍 Cek Saldo Lapakgaming - Axios Method\n');
  
  try {
    const axios = require('axios');
    const cheerio = require('cheerio');
    const loader = new CookieLoader('cookies-lapakgaming.txt');
    
    console.log('📂 Loading cookies...');
    loader.loadCookies();
    
    // Get axios config with cookies
    const config = loader.getAxiosConfig({
      timeout: 15000,
      maxRedirects: 5
    });
    
    console.log('🌐 Fetching lapakgaming.com/reseller/...');
    const response = await axios.get('https://www.lapakgaming.com/reseller/', config);
    
    console.log(`✓ Status: ${response.status}`);
    
    // Parse HTML with cheerio
    const $ = cheerio.load(response.data);
    
    console.log('💰 Mencari informasi saldo...\n');
    
    // Try to find balance
    let saldoFound = false;
    
    // Method 1: Common selectors
    const selectors = [
      // Selector spesifik untuk saldo di halaman reseller
      '#home-grid > div.row.card-container.p-0.title-card > div > div.greetings-container > span:nth-child(2) > b',
      '.greetings-container span:nth-child(2) b',
      '.greetings-container b',
      // Generic selectors sebagai fallback
      '.balance', '.saldo', '#balance', '#saldo',
      '[class*="balance"]', '[class*="saldo"]',
      '.wallet', '.credit', '.user-balance'
    ];
    
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text) {
          console.log(`✓ Saldo ditemukan (${selector}): ${text}`);
          saldoFound = true;
        }
      }
    }
    
    // Method 2: Text search
    if (!saldoFound) {
      const bodyText = $('body').text();
      const patterns = [
        /saldo[:\s]*Rp[\s\d.,]+/gi,
        /balance[:\s]*Rp[\s\d.,]+/gi,
        /kredit[:\s]*Rp[\s\d.,]+/gi
      ];
      
      for (const pattern of patterns) {
        const matches = bodyText.match(pattern);
        if (matches && matches.length > 0) {
          console.log('✓ Informasi saldo ditemukan:');
          matches.forEach(match => console.log(`  - ${match.trim()}`));
          saldoFound = true;
        }
      }
    }
    
    if (!saldoFound) {
      console.log('⚠️  Saldo tidak ditemukan dengan Axios method.');
      console.log('💡 Coba gunakan Puppeteer method (lebih reliable untuk halaman dinamis)');
    }
    
    // Save HTML for manual inspection
    const fs = require('fs');
    fs.writeFileSync('lapakgaming-page.html', response.data);
    console.log('\n📄 HTML disimpan: lapakgaming-page.html');
    console.log('   Buka file ini untuk inspeksi manual');
    
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      console.error('\n❌ Error: Axios atau Cheerio belum terinstall');
      console.log('   Jalankan: npm install axios cheerio');
    } else {
      console.error('\n❌ Error:', error.message);
    }
    process.exit(1);
  }
}

// Main function
async function main() {
  console.log('=' .repeat(60));
  console.log('💰 CEK SALDO LAPAKGAMING');
  console.log('=' .repeat(60));
  console.log();
  
  // Check which method to use
  const args = process.argv.slice(2);
  const method = args[0] || 'puppeteer';
  
  if (method === 'axios') {
    await cekSaldoAxios();
  } else {
    await cekSaldoPuppeteer();
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✓ Selesai');
  console.log('=' .repeat(60));
}

// Run
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { cekSaldoPuppeteer, cekSaldoAxios };