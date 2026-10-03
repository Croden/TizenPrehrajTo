const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const dist = path.join(__dirname, 'dist');

const css = fs.readFileSync(path.join(src, 'userStyles.css'), 'utf8');
const script = fs.readFileSync(path.join(src, 'userScript.js'), 'utf8');

const out = script.replace("/*__CSS__*/ ''", JSON.stringify(css));

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'userScript.js'), out);
console.log('dist/userScript.js vygenerován (' + out.length + ' B)');
