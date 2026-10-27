// =====================================================================
// Downloads the Fraunces variable font from Google Fonts and saves the
// Latin WOFF2 into public/fonts/. Idempotent: skips if file already exists
// and is >10KB (a valid font file). Fails loudly if download is broken.
// =====================================================================

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..600,0..100,0&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const OUT_DIR = path.join(process.env.USERPROFILE, 'time-organizer', 'public', 'fonts');
const OUT_FILE = path.join(OUT_DIR, 'fraunces-variable.woff2');
const MIN_BYTES = 10 * 1024;

function get(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: headers || {} }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(get(res.headers.location, headers));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async function () {
  if (fs.existsSync(OUT_FILE) && fs.statSync(OUT_FILE).size > MIN_BYTES) {
    console.log('ALREADY_PRESENT bytes=' + fs.statSync(OUT_FILE).size);
    return;
  }

  console.log('Fetching Google Fonts CSS...');
  const css = await get(CSS_URL, { 'User-Agent': UA });
  console.log('CSS status=' + css.status + ' bytes=' + css.body.length);
  if (css.status !== 200) {
    console.error('CSS fetch failed with HTTP ' + css.status);
    process.exit(1);
  }
  const text = css.body.toString('utf8');

  const urls = [];
  const re = /url\((https:\/\/[^)]+\.woff2)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) urls.push(m[1]);

  if (urls.length === 0) {
    console.error('No WOFF2 URL found in CSS response');
    process.exit(1);
  }
  const fontUrl = urls[urls.length - 1];
  console.log('Font URL=' + fontUrl);

  console.log('Downloading font...');
  const font = await get(fontUrl, { 'User-Agent': UA });
  console.log('Font status=' + font.status + ' bytes=' + font.body.length);
  if (font.status !== 200) {
    console.error('Font download failed with HTTP ' + font.status);
    process.exit(1);
  }
  if (font.body.length < MIN_BYTES) {
    console.error('Font file too small: ' + font.body.length + ' bytes');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, font.body);
  const size = fs.statSync(OUT_FILE).size;
  console.log('SAVED ' + OUT_FILE + ' bytes=' + size);
})().catch(function (e) {
  console.error('ERROR:', e && e.stack ? e.stack : String(e));
  process.exit(1);
});
