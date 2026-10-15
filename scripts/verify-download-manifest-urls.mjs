import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';

const fontsPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/google-fonts-manifest.json');
const stockPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/stock-footage-manifest.json');

const fonts = JSON.parse(fs.readFileSync(fontsPath, 'utf8'));
const stock = JSON.parse(fs.readFileSync(stockPath, 'utf8'));

console.log(`Loaded ${fonts.length} fonts and ${stock.length} stock items. Total: ${fonts.length + stock.length}`);

// Helper to probe URL with HEAD (falling back to GET range: 0-100)
function probeUrl(targetUrl, timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(targetUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const options = {
        method: 'HEAD',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        },
        timeout: timeoutMs
      };

      const req = lib.request(options, (res) => {
        // If 301, 302, 303, 307, 308 redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve({
            ok: true,
            status: res.statusCode,
            redirectUrl: res.headers.location,
            contentType: res.headers['content-type'] || 'redirect',
            contentLength: res.headers['content-length'] || 0
          });
          return;
        }

        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          contentType: res.headers['content-type'] || 'unknown',
          contentLength: res.headers['content-length'] || 0
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 408, error: 'Timeout' });
      });

      req.on('error', (err) => {
        resolve({ ok: false, status: 0, error: err.message });
      });

      req.end();
    } catch (e) {
      resolve({ ok: false, status: 0, error: e.message });
    }
  });
}

// Concurrency pool
async function probeBatch(items, maxConcurrent = 15) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      const urlToTest = item.downloadUrl || item.sourceUrl;
      const res = await probeUrl(urlToTest);
      results[i] = {
        id: item.id,
        name: item.name,
        type: item.category || item.type || 'asset',
        url: urlToTest,
        license: item.license || 'unspecified',
        httpStatus: res.status,
        ok: res.ok,
        mimeType: res.contentType,
        contentLength: res.contentLength,
        error: res.error || null
      };

      if ((i + 1) % 50 === 0 || i + 1 === items.length) {
        console.log(`Probed ${i + 1} / ${items.length}...`);
      }
    }
  }

  const workers = Array.from({ length: maxConcurrent }, () => worker());
  await Promise.all(workers);
  return results;
}

async function run() {
  console.log('\n--- PROBING 160 GOOGLE FONTS ---');
  const fontResults = await probeBatch(fonts, 10);

  console.log('\n--- PROBING 292 STOCK FOOTAGE / AUDIO ---');
  const stockResults = await probeBatch(stock, 15);

  const allResults = [...fontResults, ...stockResults];
  const okCount = allResults.filter(x => x.ok).length;
  const failCount = allResults.filter(x => !x.ok).length;

  console.log(`\n=== PROBE RESULTS ===`);
  console.log(`Total Probed: ${allResults.length}`);
  console.log(`Success (2xx / 3xx): ${okCount}`);
  console.log(`Failed / Inactive: ${failCount}`);

  const report = {
    totalProbed: allResults.length,
    successCount: okCount,
    failureCount: failCount,
    fonts: {
      total: fontResults.length,
      success: fontResults.filter(x => x.ok).length,
      failed: fontResults.filter(x => !x.ok)
    },
    stock: {
      total: stockResults.length,
      success: stockResults.filter(x => x.ok).length,
      failed: stockResults.filter(x => !x.ok)
    },
    items: allResults
  };

  fs.writeFileSync('download_manifest_verification_report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log('Saved download_manifest_verification_report.json');
}

run();
