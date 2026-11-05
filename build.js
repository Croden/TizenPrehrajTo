const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const dist = path.join(__dirname, 'dist');

const css = fs.readFileSync(path.join(src, 'appStyles.css'), 'utf8');
const script = fs.readFileSync(path.join(src, 'userScript.js'), 'utf8');
const encPath = path.join(src, 'tmdbKey.enc');
const tmdbEnc = fs.existsSync(encPath) ? fs.readFileSync(encPath, 'utf8').trim() : '';

const out = script
  .replace("/*__CSS__*/ ''", JSON.stringify(css))
  .replace("/*__TMDB_ENC__*/ ''", JSON.stringify(tmdbEnc));

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'userScript.js'), out);
console.log('dist/userScript.js vygenerován (' + out.length + ' B)');
