const CookieLoader = require('./index.js');

/**
 * Example 1: Basic Cookie Loading
 */
async function example1_BasicLoading() {
  console.log('\n=== EXAMPLE 1: Basic Cookie Loading ===\n');
  
  const loader = new CookieLoader('cookies-lapakgaming.txt');
  
  // Load cookies
  const cookies = loader.loadCookies();
  console.log(`Loaded ${cookies.length} cookies`);
  
  // Get cookie string
  const cookieString = loader.toCookieString();
  console.log('\nCookie String (first 100 chars):');
  console.log(cookieString.substring(0, 100) + '...\n');
  
  // Get specific cookie value
  const phpsessid = loader.getCookieValue('PHPSESSID');
  console.log(`PHPSESSID: ${phpsessid}\n`);
  
  // Check expiration
  const expiration = loader.checkExpiration();
  console.log('Expiration Status:');
  console.log(`  Total: ${expiration.total}`);
  console.log(`  Valid: ${expiration.valid}`);
  console.log(`  Expired: ${expiration.expired}\n`);
}

/**
 * Example 2: Using Cookies with Puppeteer
 */
async function example2_Puppeteer() {
  console.log('\n=== EXAMPLE 2: Using Cookies with Puppeteer ===\n');
  
  try {
    const puppeteer = require('puppeteer');
    const loader = new CookieLoader('cookies-lapakgaming.txt');
    
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: false, // Set to true untuk headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set cookies sebelum navigate
    console.log('Setting cookies...');
    await loader.setPuppeteerCookies(page);
    
    // Navigate ke lapakgaming.com
    console.log('Navigating to lapakgaming.com...');
    await page.goto('https://www.lapakgaming.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Check if logged in by looking for user-specific elements
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Get current cookies from page
    const currentCookies = await page.cookies();
    console.log(`Current cookies in browser: ${currentCookies.length}`);
    
    // Take screenshot
    await page.screenshot({ path: 'lapakgaming-screenshot.png' });
    console.log('Screenshot saved: lapakgaming-screenshot.png');
    
    // Wait a bit to see the page
    console.log('Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await browser.close();
    console.log('Browser closed.\n');
    
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      console.log('⚠️  Puppeteer not installed. Run: npm install');
      console.log('   This example requires Puppeteer to be installed.\n');
    } else {
      console.error('Error:', error.message);
    }
  }
}

/**
 * Example 3: Using Cookies with Axios
 */
async function example3_Axios() {
  console.log('\n=== EXAMPLE 3: Using Cookies with Axios ===\n');
  
  try {
    const axios = require('axios');
    const loader = new CookieLoader('cookies-lapakgaming.txt');
    
    // Get axios config with cookies
    const config = loader.getAxiosConfig({
      timeout: 10000,
      maxRedirects: 5
    });
    
    console.log('Making request to lapakgaming.com...');
    const response = await axios.get('https://www.lapakgaming.com', config);
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.data.length} bytes`);
    
    // Check if we're logged in by looking for specific content
    const html = response.data;
    const isLoggedIn = html.includes('logout') || html.includes('akun') || html.includes('profile');
    console.log(`Logged in: ${isLoggedIn ? 'Yes' : 'Maybe not (check manually)'}`);
    
    // Save response to file
    const fs = require('fs');
    fs.writeFileSync('lapakgaming-response.html', html);
    console.log('Response saved: lapakgaming-response.html\n');
    
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      console.log('⚠️  Axios not installed. Run: npm install');
      console.log('   This example requires Axios to be installed.\n');
    } else {
      console.error('Error:', error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
      }
    }
  }
}

/**
 * Example 4: Get Cookies by Domain
 */
async function example4_FilterByDomain() {
  console.log('\n=== EXAMPLE 4: Filter Cookies by Domain ===\n');
  
  const loader = new CookieLoader('cookies-lapakgaming.txt');
  loader.loadCookies();
  
  // Get cookies for specific domain
  const lapakgamingCookies = loader.getCookiesByDomain('lapakgaming.com');
  console.log(`Cookies for lapakgaming.com: ${lapakgamingCookies.length}`);
  
  // Display cookie names
  console.log('\nCookie names:');
  lapakgamingCookies.forEach(cookie => {
    console.log(`  - ${cookie.name} (${cookie.domain})`);
  });
  console.log();
}

/**
 * Example 5: Save Cookies to New File
 */
async function example5_SaveCookies() {
  console.log('\n=== EXAMPLE 5: Save Cookies to New File ===\n');
  
  const loader = new CookieLoader('cookies-lapakgaming.txt');
  loader.loadCookies();
  
  // Save to backup file
  const backupFile = 'cookies-backup.json';
  loader.saveCookies(backupFile);
  console.log(`Cookies backed up to: ${backupFile}\n`);
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log('🍪 Cookie Loader Examples - Lapakgaming\n');
  console.log('=' .repeat(50));
  
  try {
    // Run examples
    await example1_BasicLoading();
    
    console.log('\nPress Ctrl+C to skip Puppeteer example, or wait 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Uncomment to run Puppeteer example
    // await example2_Puppeteer();
    
    await example3_Axios();
    await example4_FilterByDomain();
    await example5_SaveCookies();
    
    console.log('=' .repeat(50));
    console.log('\n✓ All examples completed!\n');
    console.log('Tips:');
    console.log('  - Uncomment example2_Puppeteer() to test with browser');
    console.log('  - Install dependencies: npm install');
    console.log('  - Check generated files: lapakgaming-screenshot.png, lapakgaming-response.html');
    console.log('  - Modify examples as needed for your use case\n');
    
  } catch (error) {
    console.error('\n✗ Error running examples:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  example1_BasicLoading,
  example2_Puppeteer,
  example3_Axios,
  example4_FilterByDomain,
  example5_SaveCookies
};