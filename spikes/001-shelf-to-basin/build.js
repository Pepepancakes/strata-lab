// node build.js -> dist/strata-spike-001.html (single offline file)
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/app.html', 'utf8');
const eng = fs.readFileSync(__dirname + '/engine.js', 'utf8');
const out = html.replace('<script src="engine.js"></script>', () => `<script>\n${eng}\n</script>`);
if (out === html) throw new Error('engine tag not found');
if (/https?:\/\//.test(out.replace(/<!--[\s\S]*?-->/g, ''))) console.warn('warning: file contains a URL');
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/strata-spike-001.html', out);
console.log('wrote dist/strata-spike-001.html', (out.length / 1024).toFixed(0), 'KB');
