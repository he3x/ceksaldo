const fs = require('fs');
const path = require('path');

/**
 * CookieLoader - Class untuk load dan manage cookies dari file
 */
class CookieLoader {
  constructor(cookieFilePath = 'cookies-lapakgaming.txt') {
    this.cookieFilePath = cookieFilePath;
    this.cookies = null;
  }

  /**
   * Load cookies dari file
   * @returns {Array} Array of cookie objects
   */
  loadCookies() {
    try {
      const cookieData = fs.readFileSync(this.cookieFilePath, 'utf-8');
      this.cookies = JSON.parse(cookieData);
      console.log(`✓ Berhasil load ${this.cookies.length} cookies dari ${this.cookieFilePath}`);
      return this.cookies;
    } catch (error) {
      console.error('✗ Error loading cookies:', error.message);
      throw error;
    }
  }

  /**
   * Get cookies yang sudah di-load
   * @returns {Array} Array of cookie objects
   */
  getCookies() {
    if (!this.cookies) {
      return this.loadCookies();
    }
    return this.cookies;
  }

  /**
   * Convert cookies ke format Cookie header string untuk HTTP requests
   * @returns {String} Cookie header string
   */
  toCookieString() {
    const cookies = this.getCookies();
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  }

  /**
   * Get cookies untuk domain tertentu
   * @param {String} domain - Domain yang dicari
   * @returns {Array} Filtered cookies
   */
  getCookiesByDomain(domain) {
    const cookies = this.getCookies();
    return cookies.filter(cookie => 
      cookie.domain === domain || cookie.domain.includes(domain)
    );
  }

  /**
   * Get cookie value by name
   * @param {String} name - Cookie name
   * @returns {String|null} Cookie value atau null jika tidak ditemukan
   */
  getCookieValue(name) {
    const cookies = this.getCookies();
    const cookie = cookies.find(c => c.name === name);
    return cookie ? cookie.value : null;
  }

  /**
   * Check apakah cookies masih valid (belum expired)
   * @returns {Object} Status validitas cookies
   */
  checkExpiration() {
    const cookies = this.getCookies();
    const now = Date.now() / 1000; // Convert to seconds
    
    const expired = cookies.filter(c => c.expirationDate && c.expirationDate < now);
    const valid = cookies.filter(c => !c.expirationDate || c.expirationDate >= now);
    
    return {
      total: cookies.length,
      valid: valid.length,
      expired: expired.length,
      expiredCookies: expired.map(c => c.name)
    };
  }

  /**
   * Set cookies ke Puppeteer page
   * @param {Object} page - Puppeteer page object
   * @returns {Promise}
   */
  async setPuppeteerCookies(page) {
    try {
      const cookies = this.getCookies();
      await page.setCookie(...cookies);
      console.log(`✓ Berhasil set ${cookies.length} cookies ke Puppeteer page`);
      return true;
    } catch (error) {
      console.error('✗ Error setting Puppeteer cookies:', error.message);
      throw error;
    }
  }

  /**
   * Get Axios config dengan cookies
   * @param {Object} additionalConfig - Additional axios config
   * @returns {Object} Axios config object
   */
  getAxiosConfig(additionalConfig = {}) {
    return {
      ...additionalConfig,
      headers: {
        ...additionalConfig.headers,
        'Cookie': this.toCookieString(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
  }

  /**
   * Save cookies ke file
   * @param {String} filePath - Path untuk save cookies
   * @param {Array} cookies - Cookies to save (optional, uses loaded cookies if not provided)
   */
  saveCookies(filePath, cookies = null) {
    try {
      const cookiesToSave = cookies || this.cookies;
      if (!cookiesToSave) {
        throw new Error('No cookies to save');
      }
      fs.writeFileSync(filePath, JSON.stringify(cookiesToSave, null, 2));
      console.log(`✓ Berhasil save ${cookiesToSave.length} cookies ke ${filePath}`);
      return true;
    } catch (error) {
      console.error('✗ Error saving cookies:', error.message);
      throw error;
    }
  }

  /**
   * Display cookies info
   */
  displayInfo() {
    const cookies = this.getCookies();
    const expiration = this.checkExpiration();
    
    console.log('\n=== COOKIE INFORMATION ===');
    console.log(`Total Cookies: ${cookies.length}`);
    console.log(`Valid Cookies: ${expiration.valid}`);
    console.log(`Expired Cookies: ${expiration.expired}`);
    
    if (expiration.expired > 0) {
      console.log('\nExpired Cookie Names:');
      expiration.expiredCookies.forEach(name => console.log(`  - ${name}`));
    }
    
    console.log('\nCookie Domains:');
    const domains = [...new Set(cookies.map(c => c.domain))];
    domains.forEach(domain => console.log(`  - ${domain}`));
    
    console.log('\nImportant Cookies:');
    const important = ['PHPSESSID', 'lg_lang_country', '_ga', '_gid'];
    important.forEach(name => {
      const value = this.getCookieValue(name);
      if (value) {
        console.log(`  - ${name}: ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`);
      }
    });
    console.log('========================\n');
  }
}

// Export class dan helper functions
module.exports = CookieLoader;

// Jika dijalankan langsung (bukan di-import)
if (require.main === module) {
  console.log('🍪 Cookie Loader - Lapakgaming\n');
  
  const loader = new CookieLoader();
  
  try {
    // Load cookies
    loader.loadCookies();
    
    // Display info
    loader.displayInfo();
    
    // Contoh penggunaan
    console.log('📝 Contoh Penggunaan:\n');
    console.log('1. Load cookies:');
    console.log('   const CookieLoader = require("./index.js");');
    console.log('   const loader = new CookieLoader();');
    console.log('   const cookies = loader.loadCookies();\n');
    
    console.log('2. Dengan Puppeteer:');
    console.log('   await loader.setPuppeteerCookies(page);\n');
    
    console.log('3. Dengan Axios:');
    console.log('   const config = loader.getAxiosConfig();');
    console.log('   const response = await axios.get(url, config);\n');
    
    console.log('4. Get cookie string:');
    console.log('   const cookieString = loader.toCookieString();\n');
    
    console.log('Lihat example.js untuk contoh lengkap!\n');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}