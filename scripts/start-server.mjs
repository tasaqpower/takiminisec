import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const port = process.env.PORT || '10000';
const host = '0.0.0.0';
const cli = fileURLToPath(new URL('../node_modules/vinext/dist/cli.js', import.meta.url));

const proc = spawn(process.execPath, [cli, 'start', '--port', port, '--host', host], {
  stdio: 'inherit'
});

proc.on('exit', (code) => process.exit(code ?? 0));
proc.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Also forward port 3000 -> 10000 so localhost:3000 works seamlessly
setTimeout(() => {
  try {
    const proxy = http.createServer((req, res) => {
      const options = {
        hostname: '127.0.0.1',
        port: Number(port),
        path: req.url,
        method: req.method,
        headers: req.headers,
      };
      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (err) => {
        res.writeHead(502);
        res.end('Proxy connecting: ' + err.message);
      });
      req.pipe(proxyReq);
    });
    proxy.on('error', () => {});
    proxy.listen(3000, '0.0.0.0', () => {
      console.log('[vinext] Also listening on http://localhost:3000');
    });
  } catch {}
}, 1200);
