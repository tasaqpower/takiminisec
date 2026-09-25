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
    // Intercept any stale chunk requests for aiActionDispatcher to guarantee HTTP 200 and auto-update
    if (req.url && (req.url.includes('/aiActionDispatcher') || req.url.includes('aiActionDispatcher'))) {
      res.writeHead(200, {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-cache, no-store, must-revalidate',
        'access-control-allow-origin': '*'
      });
      res.end(`
// Auto-shim for stale client sessions from earlier deployments
if (typeof window !== 'undefined') {
  setTimeout(() => {
    console.warn('[Forma] Stale aiActionDispatcher chunk requested. Auto-reloading page...');
    window.location.reload();
  }, 100);
}
export async function dispatchAiAction(intent, context, onProgress) {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
  return {
    success: false,
    action: intent?.action || "watermark_remove",
    message: "🔄 Sitede yeni bir güncelleme yayınlandı. Sayfa otomatik olarak yenileniyor..."
  };
}
export function formatCandidateTitle(c) { return "Filigran / Damga"; }
export function formatCandidateDetails(c) { return "Sayfa öğesi"; }
export default { dispatchAiAction, formatCandidateTitle, formatCandidateDetails };
`.trim());
      return;
    }

    const options = {
      hostname: '127.0.0.1',
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `localhost:${listenPort}` },
    };
    const proxyReq = http.request(options, (proxyRes) => {
      // If any .js chunk from an older build returns 404, gracefully reload the client
      if (proxyRes.statusCode === 404 && req.url && req.url.startsWith('/_next/static/chunks/') && req.url.endsWith('.js')) {
        res.writeHead(200, {
          'content-type': 'application/javascript; charset=utf-8',
          'cache-control': 'no-cache, no-store, must-revalidate',
          'access-control-allow-origin': '*'
        });
        res.end(`
if (typeof window !== 'undefined') {
  console.warn('[Forma] Stale chunk requested: ${req.url}. Auto-reloading page...');
  window.location.reload();
}
export default {};
`.trim());
        return;
      }

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

// Start proxies on ports 10000, 3000, and Render's PORT environment variable
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
const portsToListen = new Set([10000, 3000]);
if (envPort && envPort !== targetPort) {
  portsToListen.add(envPort);
}
setTimeout(() => {
  for (const p of portsToListen) {
    createProxy(p);
  }
}, 1500);
