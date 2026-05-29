const axios = require('axios');
const cheerio = require('cheerio');

async function getSaldo() {
  try {
    const response = await axios.get('https://www.lapakgaming.com/reseller/', {
      headers: {
        'Cookie': 'lg_lang_country=id-id; AMP_MKTG_28011834e0=JTdCJTdE; _gcl_au=1.1.226248371.1779954155; _gid=GA1.2.1658832994.1779954155; _clck=r0laew%5E2%5Eg6f%5E0%5E2339; _tt_enable_cookie=1; _ttp=01KSPRJ010GB4A6ZXEJ3JXK47B_.tt.1; _ga=GA1.2.1868646753.1779954155; _rdt_uuid=1779954155142.f034a2f7-4801-4d0a-a623-9fe587909a71; _clsk=1lb75da%5E1779959867338%5E1%5E1%5El.clarity.ms%2Fcollect; ttcsid_CRGFSORC77UD2MA16PRG=1779959838022::ewCSXlUi1l5RNvsR-Dgw.2.1779959867466.1; AMP_28011834e0=JTdCJTIyZGV2aWNlSWQlMjIlM0ElMjIxNWNkODMxMC04Y2JlLTQ5ZjgtYWRjMC04OTE0NDc3ZmQ5MDclMjIlMkMlMjJzZXNzaW9uSWQlMjIlM0ExNzc5OTU5ODM4MDI2JTJDJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJsYXN0RXZlbnRUaW1lJTIyJTNBMTc3OTk1OTg4NDIwNCUyQyUyMmxhc3RFdmVudElkJTIyJTNBMjAlMkMlMjJwYWdlQ291bnRlciUyMiUzQTElN0Q=; ttcsid=1779959838013::QdzhYLvQkNi_2usTSyIS.2.1779959867466.0::1.27499.29207::5360.4.333.6232::167072.29.6012; _ga_N0BQ2Y58SP=GS2.1.s1779959867$o2$g1$t1779961600$j60$l0$h0; _ga_ZETVVQ1SL2=GS2.1.s1779959867$o2$g1$t1779961600$j60$l0$h0; PHPSESSID=j5r02j14onkosn32r181rp822n',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const saldo = $('span b.font-20').text().trim();

    if (!saldo) {
      throw new Error('Saldo tidak ditemukan. Cookie mungkin sudah expired.');
    }

    console.log(saldo);
    return saldo;

  } catch (error) {
    if (error.response) {
      console.error('Error HTTP:', error.response.status);
    } else if (error.message) {
      console.error('Error:', error.message);
    } else {
      console.error('Error tidak diketahui');
    }
    process.exit(1);
  }
}

getSaldo();