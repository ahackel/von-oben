// npm run dev: the game served as plain files (http://, for the music's worklet), never cached, so a reload always
// runs the latest code
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.'), port = +(process.env.PORT || 8325);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.zip': 'application/zip', '.wav': 'audio/wav', '.md': 'text/plain; charset=utf-8' };
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/shot') { // (?debug: a picture of the canvas, saved to .shots/)
    let body = '';
    for await (const chunk of req) body += chunk;
    await fs.mkdir(path.join(root, '.shots'), { recursive: true });
    const file = path.join(root, '.shots', `${Date.now()}.png`);
    await fs.writeFile(file, Buffer.from(body.replace(/^data:image\/png;base64,/, ''), 'base64'));
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end(file);
    return;
  }
  try {
    let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); }
}).listen(port, () => console.log(`Von Oben → http://localhost:${port}`));
