// Společné zázemí Playwright testů. Čte TMDB klíč z .env JEN v paměti
// a vyrábí z něj šifrovaný blob s heslem "test" — klíč se nikde nevypisuje
// a zašifrovaný soubor v repu (src/tmdbKey.enc) se nikdy nemění.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

function loadMod() {
  let mod = fs.readFileSync(path.join(ROOT, 'dist/userScript.js'), 'utf8');
  const envLine = fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split('\n').find((l) => l.trim().startsWith('TMDB_API_KEY='));
  const apiKey = envLine.split('=').slice(1).join('=').trim();
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync('test', salt, 120000, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(apiKey, 'utf8'), c.final()]);
  const blob = Buffer.concat([salt, iv, ct, c.getAuthTag()]).toString('base64');
  return mod.replace(/TMDB_ENC = "[^"]*"/, 'TMDB_ENC = ' + JSON.stringify(blob));
}

const ok = (name, cond, extra) =>
  console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : ''));

const CHROME = '/usr/bin/google-chrome';

module.exports = { loadMod, ok, CHROME, ROOT };
