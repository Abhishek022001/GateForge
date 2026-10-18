import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5173;
const BACKEND_PORT = 5000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  // Proxy /api requests to backend server on PORT 5000 if accessed via 5173
  if (pathname.startsWith('/api')) {
    const proxyReq = http.request(
      `http://localhost:${BACKEND_PORT}${req.url}`,
      {
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Backend gateway connection error',
          message: err.message,
        })
      );
    });

    req.pipe(proxyReq);
    return;
  }

  // Serve static frontend files (prefer dist/ if production build exists)
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const distDir = path.join(__dirname, 'dist');
  const baseDir = fs.existsSync(distDir) ? distDir : __dirname;
  let filePath = path.join(baseDir, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(baseDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`🌐 GATEForge Frontend Dev Server running at http://localhost:${PORT}`);
  console.log(`⚡ Proxied /api requests to http://localhost:${BACKEND_PORT}`);
});
