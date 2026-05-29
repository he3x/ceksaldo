const fs = require('fs');

// Baca file cookie JSON
const cookiesJson = fs.readFileSync('cookis-lapak.txt', 'utf8');
const cookies = JSON.parse(cookiesJson);

// Konversi ke format Cookie header
const cookieString = cookies
  .map(cookie => `${cookie.name}=${cookie.value}`)
  .join('; ');

console.log('Cookie berhasil dikonversi!\n');
console.log('Format Cookie Header:');
console.log('='.repeat(80));
console.log(cookieString);
console.log('='.repeat(80));

// Update scrape-saldo.js
let scriptContent = fs.readFileSync('scrape-saldo.js', 'utf8');
scriptContent = scriptContent.replace(
  "'Cookie': 'MASUKKAN_COOKIE_ANDA_DI_SINI'",
  `'Cookie': '${cookieString}'`
);

fs.writeFileSync('scrape-saldo.js', scriptContent);
console.log('\n✓ File scrape-saldo.js berhasil diupdate dengan cookie Anda!');
console.log('✓ Sekarang Anda bisa menjalankan: node scrape-saldo.js');