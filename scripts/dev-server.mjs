import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleCoach } from '../api/coach.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };
export function publicPath(rawUrl) {
  let decoded;
  try { decoded = decodeURIComponent(rawUrl.split('?')[0]); } catch { return null; }
  if (/[\\\0:]/.test(decoded) || decoded.split('/').some(p => p.startsWith('.'))) return null;
  const name = decoded === '/' ? 'index.html' : decoded.slice(1);
  return /^(index\.html|preview\.html|styles\.css|README\.md|src\/[a-z-]+\.js|assets\/[\w-]+\.(png|svg)|docs\/[\w-]+\.md)$/.test(name) ? name : null;
}

export function createDevServer({ root = projectRoot, coach = handleCoach } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')) { res.writeHead(403); res.end('Forbidden host'); return; }
    if (req.url === '/api/capabilities' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ai: !!process.env.OPENAI_API_KEY })); return;
    }
    if (req.url === '/api/coach') {
      try { await coach(req, res); } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const name = publicPath(req.url);
    if (!name) { res.writeHead(403); res.end('Forbidden'); return; }
    try {
      const filename = await realpath(path.join(root, name));
      const relative = path.relative(await realpath(root), filename);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); res.end(); return; }
      const data = await readFile(filename);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filename)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404); res.end('Not Found'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createDevServer().listen(port, '127.0.0.1', () => console.log(`知行 AI MVP: http://127.0.0.1:${port}`));
}
