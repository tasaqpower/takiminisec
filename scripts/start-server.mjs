import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const targetPort = 10001;
const host = '127.0.0.1';
const cli = fileURLToPath(new URL('../node_modules/vinext/dist/cli.js', import.meta.url));

const proc = spawn(process.execPath, [cli, 'start', '--port', String(targetPort), '--host', host], {
  stdio: 'inherit'
});

proc.on('exit', (code) => process.exit(code ?? 0));
proc.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

function createProxy(listenPort) {
  const proxy = http.createServer((req, res) => {
    const options = {
      hostname: '127.0.0.1',
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `localhost:${listenPort}` },
    };
    const proxyReq = http.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      // Force disable browser cache for dev/preview so user sees fresh code immediately
      headers['cache-control'] = 'no-cache, no-store, must-revalidate';
      headers['pragma'] = 'no-cache';
      headers['expires'] = '0';
      res.writeHead(proxyRes.statusCode || 200, headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Server warming up, please refresh in 2 seconds...');
    });
    req.pipe(proxyReq);
  });
  proxy.on('error', (err) => {
    console.error(`Proxy port ${listenPort} error:`, err.message);
  });
  proxy.listen(listenPort, '0.0.0.0', () => {
    console.log(`[Forma] Listening on http://localhost:${listenPort}`);
  });
}

// Start proxies on both 10000 and 3000 after 1.5s
setTimeout(() => {
  createProxy(10000);
  createProxy(3000);
}, 1500);
