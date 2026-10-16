import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const catalogPath = path.join(rootDir, 'public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// 1. Filter items
const fonts = catalog.filter((a) => a.type === 'font' || (a.category && a.category.includes('Font')));
const titles = catalog.filter((a) => a.type === 'title' || (a.category && (a.category.includes('Başlık') || a.category.includes('Metin'))));

console.log('=== FORMA TITLES & FONTS EXHAUSTIVE VERIFICATION ===');
console.log(`Total fonts detected: ${fonts.length}`);
console.log(`Total titles detected: ${titles.length}`);

// 2. Verify all 160 fonts against Google Fonts API with polite concurrency
async function verifyAllFonts() {
  console.log('\n--- VERIFYING ALL 160 FONTS AGAINST GOOGLE FONTS API ---');
  let successCount = 0;
  const failures = [];
  const results = [];

  const checkSingleFont = async (font, attempt = 1) => {
    const family = (font.fontFamily || font.name.replace(/\s+Font$/i, '')).trim();
    const encoded = encodeURIComponent(family).replace(/%20/g, '+');
    const url = `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timer);

      if (res.status === 200) {
        successCount++;
        return { id: font.id, family, status: 200, ok: true };
      } else {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000));
          return checkSingleFont(font, attempt + 1);
        }
        failures.push({ id: font.id, family, status: res.status, url });
        return { id: font.id, family, status: res.status, ok: false };
      }
    } catch (err) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
        return checkSingleFont(font, attempt + 1);
      }
      failures.push({ id: font.id, family, error: err.message, url });
      return { id: font.id, family, error: err.message, ok: false };
    }
  };

  // Run in chunks of 8 concurrent requests to avoid rate limit / socket congestion
  const CHUNK_SIZE = 8;
  for (let i = 0; i < fonts.length; i += CHUNK_SIZE) {
    const chunk = fonts.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map((f) => checkSingleFont(f)));
    results.push(...chunkResults);
    process.stdout.write(`Verified ${results.length}/${fonts.length} fonts...\r`);
    // Small breath between chunks
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nFont Verification Complete: ${successCount}/${fonts.length} OK (Errors: ${failures.length})`);
  return { successCount, total: fonts.length, failures, results };
}

// 3. Verify all 490 titles
function verifyAllTitles() {
  console.log('\n--- VERIFYING ALL 490 TITLE ASSETS ---');
  let validTitles = 0;
  const titleErrors = [];
  const categorized = {
    baslikSablonlari: 0,
    metinAnimasyonlari: 0,
    metinVeBaslik: 0,
  };

  for (const title of titles) {
    try {
      if (title.category === 'Başlık Şablonları') categorized.baslikSablonlari++;
      else if (title.category === 'Metin Animasyonları') categorized.metinAnimasyonlari++;
      else if (title.category === 'Metin ve Başlık Şablonları') categorized.metinVeBaslik++;

      if (!title.id || !title.name) {
        throw new Error(`Missing id or name for asset ${title.id}`);
      }

      const text = title.defaultText || title.metadata?.textData?.text || title.localizedName;
      if (!text || typeof text !== 'string') {
        throw new Error(`Invalid text in title ${title.id}`);
      }

      validTitles++;
    } catch (err) {
      titleErrors.push({ id: title.id, error: err.message });
    }
  }

  console.log(`Title Verification Complete: ${validTitles}/${titles.length} Valid (Errors: ${titleErrors.length})`);
  console.log(`Breakdown: Başlık Şablonları=${categorized.baslikSablonlari}, Metin Animasyonları=${categorized.metinAnimasyonlari}, MOGRT Şablonları=${categorized.metinVeBaslik}`);
  return { validTitles, total: titles.length, categorized, titleErrors };
}

// 4. Run verification and write report
async function run() {
  const fontAudit = await verifyAllFonts();
  const titleAudit = verifyAllTitles();

  const report = {
    timestamp: new Date().toISOString(),
    fonts: {
      total: fontAudit.total,
      verified200: fontAudit.successCount,
      errors: fontAudit.failures.length,
      sampleVerifiedFonts: fonts.slice(0, 10).map((f) => ({
        id: f.id,
        name: f.name,
        fontFamily: f.fontFamily,
        category: f.fontCategory,
      })),
      failures: fontAudit.failures,
    },
    titles: {
      total: titleAudit.total,
      valid: titleAudit.validTitles,
      errors: titleAudit.titleErrors.length,
      breakdown: titleAudit.categorized,
      sampleVerifiedTitles: titles.slice(0, 10).map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        style: t.style || t.metadata?.style,
        defaultText: t.defaultText || t.metadata?.textData?.text,
      })),
      failures: titleAudit.titleErrors,
    },
    status: fontAudit.failures.length === 0 && titleAudit.titleErrors.length === 0 ? 'PASSED' : 'FAILED',
  };

  const reportPath = path.join(rootDir, 'scripts/verification-report-titles-fonts.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nWritten report to: ${reportPath}`);
  console.log(`Final Status: ${report.status}`);

  if (report.status !== 'PASSED') {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Audit failed with uncaught exception:', err);
  process.exit(1);
});
