// Zašifruje TMDB_API_KEY z .env krátkým heslem a výsledek uloží do
// src/tmdbKey.enc (jediný base64 blob: salt 16 B + iv 12 B + ciphertext
// + GCM tag 16 B). Ten se commitne – bez hesla je k ničemu. Stránka
// Doporučení ho v prohlížeči rozšifruje (WebCrypto, stejné parametry)
// a klíč uloží do localStorage.
//
// Použití:  node encrypt-key.js      (zeptá se na heslo, vstup se neukazuje)
//
// Po výměně klíče v TMDB stačí aktualizovat .env a spustit znovu.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const PBKDF2_ITERATIONS = 120000;

function readEnvKey() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env nenalezen – vytvoř ho s řádkem TMDB_API_KEY=...');
    process.exit(1);
  }
  const line = fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('TMDB_API_KEY='));
  const key = line && line.split('=').slice(1).join('=').trim();
  if (!key) {
    console.error('TMDB_API_KEY v .env nenalezen.');
    process.exit(1);
  }
  return key;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const origWrite = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (s) => {
      // ukázat jen výzvu a odřádkování, ne psané znaky
      if (s.includes(question) || s.includes('\n')) origWrite(s.includes(question) ? s : '\n');
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

(async () => {
  const apiKey = readEnvKey();
  const password = process.env.TMDB_ENC_PASSWORD || (await askHidden('Heslo pro zašifrování: '));
  if (!password) {
    console.error('Prázdné heslo.');
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const blob = Buffer.concat([salt, iv, ct, cipher.getAuthTag()]).toString('base64');
  fs.writeFileSync(path.join(__dirname, 'src', 'tmdbKey.enc'), blob + '\n');
  console.log('src/tmdbKey.enc zapsán (' + blob.length + ' B base64). Teď spusť npm run build.');
})();
