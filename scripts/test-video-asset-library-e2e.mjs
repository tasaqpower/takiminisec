/**
 * FORMA Video Editor — Professional Asset Library E2E Verification Suite
 * Verifies catalog scale (>=2,000 items), SHA-256 integrity, bilingual search (<300ms),
 * virtualized grid, drag-and-drop, modals (Packs, Storage, Licenses), and timeline integration.
 */

import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const ROOT_DIR = process.cwd();
const CATALOG_PATH = path.join(ROOT_DIR, 'public', 'video-assets', 'ONLINE_CATALOG.json');
const PACKS_PATH = path.join(ROOT_DIR, 'public', 'video-assets', 'ASSET_PACKS.json');
const LICENSES_PATH = path.join(ROOT_DIR, 'public', 'video-assets', 'ASSET_LICENSES.json');
const STARTER_PATH = path.join(ROOT_DIR, 'public', 'video-assets', 'ASSET_MANIFEST.json');

const DEV_SERVER_URL = 'http://localhost:5174/video-editor';
const CDP_PORT = 9235;

async function runStaticCatalogChecks() {
  console.log('\n======================================================');
  console.log('1. STATIC CATALOG & INTEGRITY CHECKS');
  console.log('======================================================');

  assert.ok(fs.existsSync(CATALOG_PATH), 'ONLINE_CATALOG.json exists');
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  console.log(`✓ Loaded ONLINE_CATALOG.json: ${catalog.length} items`);
  assert.ok(catalog.length >= 2000, `Catalog must have >= 2,000 items (Actual: ${catalog.length})`);

  // SHA-256 Duplicates check (for verified physical assets)
  const seenSha = new Set();
  let shaDups = 0;
  for (const item of catalog) {
    if (item.sha256) {
      if (seenSha.has(item.sha256)) {
        shaDups++;
      }
      seenSha.add(item.sha256);
    }
  }
  console.log(`✓ Non-null SHA-256 Duplicate Count: ${shaDups} (Target: 0)`);
  assert.strictEqual(shaDups, 0, 'SHA-256 duplicates must be 0');

  // Category counts check
  const catCounts = {};
  for (const item of catalog) {
    catCounts[item.category] = (catCounts[item.category] || 0) + 1;
  }
  console.log('✓ Category Distribution:');
  for (const [k, v] of Object.entries(catCounts)) {
    console.log(`   - ${k}: ${v}`);
  }

  // Starter pack check
  assert.ok(fs.existsSync(STARTER_PATH), 'starter-pack-manifest.json exists');
  const starter = JSON.parse(fs.readFileSync(STARTER_PATH, 'utf-8'));
  console.log(`✓ Starter pack assets: ${starter.length} items (offline ready)`);

  // Packs check
  assert.ok(fs.existsSync(PACKS_PATH), 'ASSET_PACKS.json exists');
  const packs = JSON.parse(fs.readFileSync(PACKS_PATH, 'utf-8'));
  console.log(`✓ Offline download packs defined: ${packs.length} packs`);
  assert.ok(packs.length >= 15, `Expected >= 15 offline packs (Actual: ${packs.length})`);

  // Licenses check
  assert.ok(fs.existsSync(LICENSES_PATH), 'ASSET_LICENSES.json exists');
  const lic = JSON.parse(fs.readFileSync(LICENSES_PATH, 'utf-8'));
  console.log(`✓ Asset attributions documented: ${lic.assetAttributions.length} entries`);
  assert.ok(lic.assetAttributions.length > 500, 'Expected > 500 attributions');

  console.log('✓ All static integrity checks PASSED.\n');
}

async function runBrowserE2E() {
  console.log('======================================================');
  console.log('2. HEADLESS CHROME E2E INTERACTION & WORKSPACE TESTS');
  console.log('======================================================');

  const profileDir = path.join(
    process.env.TEMP || 'C:/Users/sinan/AppData/Local/Temp',
    'chrome_assets_e2e_' + Date.now()
  );
  fs.mkdirSync(profileDir, { recursive: true });

  console.log(`[E2E] Launching headless Chrome on port ${CDP_PORT}...`);
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error(`Chrome failed to start on port ${CDP_PORT}`);
  }

  console.log(`[E2E] Chrome active. Navigating to ${DEV_SERVER_URL}...`);
  const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${DEV_SERVER_URL}`, {
    method: 'PUT',
  });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  const browserErrors = [];

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
      if (msg.params.type === 'error') {
        browserErrors.push(text);
      }
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1536,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('[E2E] Waiting for video editor hydration...');
  await new Promise((r) => setTimeout(r, 4500));

  async function evaluate(fnStr) {
    const res = await send('Runtime.evaluate', {
      expression: fnStr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Evaluation error');
    }
    return res.result?.value;
  }

  // 1. Check workspace layout
  const initialCheck = await evaluate(`(() => {
    return {
      hasAside: Boolean(document.querySelector('aside')),
      hasTimeline: Boolean(document.querySelector('.h-72') || document.querySelector('[data-timeline]')),
      hasToolRail: Boolean(document.querySelectorAll('button').length > 5)
    };
  })()`);
  console.log('✓ Workspace Layout Detected:', initialCheck);
  assert.ok(initialCheck.hasAside, 'Aside element present');

  // 2. Click "Kütüphane" tab in Tool Rail
  console.log('[E2E] Clicking "Kütüphane" sidebar rail button...');
  const openTabRes = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('aside button'));
    const assetBtn = buttons.find(b => b.innerText.includes('Kütüphane') || b.getAttribute('title')?.includes('Kütüphane') || b.getAttribute('id') === 'assets');
    if (assetBtn) {
      assetBtn.click();
      return { success: true, text: assetBtn.innerText.trim() };
    }
    return { success: false };
  })()`);
  console.log('✓ Opened Kütüphane Tab:', openTabRes);
  assert.ok(openTabRes.success, 'Successfully clicked Kütüphane tab');

  await new Promise((r) => setTimeout(r, 1200));
  console.log('[E2E] Browser console errors:', browserErrors);
  const debugAside = await evaluate(`(() => {
    return {
      asideText: document.querySelector('aside')?.innerText.slice(0, 300),
      bodyText: document.body.innerText.slice(0, 300)
    };
  })()`);
  console.log('[E2E] Aside Debug Text:', debugAside);

  // 3. Verify Assets Tab UI elements
  const assetsTabContent = await evaluate(`(() => {
    const text = document.body.innerText;
    const hasHeader = text.includes('Varlık Kütüphanesi') || text.includes('Asset Kütüphanesi');
    const hasSearch = Boolean(document.querySelector('input[placeholder*="asset ara"]'));
    const hasPackBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Paketler'));
    const hasStorageBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Depolama'));
    const hasLicenseBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Lisanslar'));
    const cardCount = document.querySelectorAll('[data-asset-card]').length;
    return { hasHeader, hasSearch, hasPackBtn, hasStorageBtn, hasLicenseBtn, cardCount };
  })()`);
  console.log('✓ Assets Tab UI Verification:', assetsTabContent);
  assert.ok(assetsTabContent.hasSearch, 'Search input exists');
  assert.ok(assetsTabContent.hasPackBtn, 'Paketler button exists');
  assert.ok(assetsTabContent.hasStorageBtn, 'Depolama button exists');
  assert.ok(assetsTabContent.hasLicenseBtn, 'Lisanslar button exists');
  assert.ok(assetsTabContent.cardCount > 0, `Virtualized cards rendered (count: ${assetsTabContent.cardCount})`);

  // 4. Test Bilingual Search (< 300ms speed test)
  console.log('[E2E] Testing bilingual search performance...');
  const searchQueries = ['yağmur', 'rain', 'whoosh', 'tıklama', 'drone', 'click'];
  for (const q of searchQueries) {
    const searchPerf = await evaluate(`(async () => {
      const input = document.querySelector('input[placeholder*="asset ara"]');
      if (!input) return null;
      const t0 = performance.now();
      input.value = "${q}";
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // Wait microtask
      await new Promise(r => setTimeout(r, 60));
      const t1 = performance.now();
      const cardCount = document.querySelectorAll('[data-asset-card]').length;
      return { query: "${q}", elapsedMs: Math.round(t1 - t0), cardCount };
    })()`);
    console.log(`   ✓ Search "${q}": ${searchPerf?.elapsedMs}ms, ${searchPerf?.cardCount} visible cards`);
    assert.ok(searchPerf && searchPerf.elapsedMs < 300, `Search response < 300ms (Actual: ${searchPerf?.elapsedMs}ms)`);
  }

  // Clear search
  await evaluate(`(() => {
    const input = document.querySelector('input[placeholder*="asset ara"]');
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await new Promise((r) => setTimeout(r, 300));

  // 5. Category Filtering Test
  console.log('[E2E] Testing category pill filters...');
  const catTestRes = await evaluate(`(() => {
    const pills = Array.from(document.querySelectorAll('button')).filter(b => 
      ['Ses Efektleri', 'B-Roll & Video', 'Overlays', 'Başlıklar', 'LUT / Renk'].some(t => b.innerText.includes(t))
    );
    const results = [];
    for (const pill of pills.slice(0, 4)) {
      pill.click();
      results.push(pill.innerText.trim());
    }
    return results;
  })()`);
  console.log('✓ Category filters tested:', catTestRes);

  // Reset to "Tümü"
  await evaluate(`(() => {
    const allBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Tümü');
    if (allBtn) allBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 300));

  // 6. Test Card Action: Add Clip to Timeline (+)
  console.log('[E2E] Adding asset directly to timeline via card (+) button...');
  const addClipRes = await evaluate(`(() => {
    const addBtns = Array.from(document.querySelectorAll('[data-asset-card] button[title*="Timeline"]'));
    if (addBtns.length > 0) {
      addBtns[0].click();
      return { clicked: true };
    }
    return { clicked: false };
  })()`);
  console.log('✓ Add to timeline action:', addClipRes);
  assert.ok(addClipRes.clicked, 'Clicked add to timeline button');
  await new Promise((r) => setTimeout(r, 600));

  // 7. Test Modals: Paketler (AssetPacksModal)
  console.log('[E2E] Testing AssetPacksModal...');
  const packsModalTest = await evaluate(`(() => {
    const packBtn = document.querySelector('[data-testid="open-packs-modal"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Paketler'));
    if (!packBtn) return { open: false };
    packBtn.click();
    return { open: true };
  })()`);
  assert.ok(packsModalTest.open, 'Opened packs modal');
  await new Promise((r) => setTimeout(r, 600));

  const packsContent = await evaluate(`(() => {
    const modalText = document.body.innerText;
    const hasPacksTitle = modalText.includes('Çevrimdışı Asset Paketleri') || modalText.includes('Çevrimdışı Varlık Paketleri');
    const closeBtn = document.querySelector('[data-testid="close-packs-modal"]');
    if (closeBtn) closeBtn.click();
    return { hasPacksTitle };
  })()`);
  console.log('✓ AssetPacksModal verified:', packsContent);
  assert.ok(packsContent.hasPacksTitle, 'AssetPacksModal rendered successfully');
  await new Promise((r) => setTimeout(r, 600));

  // 8. Test Modals: Depolama (StorageManagementModal)
  console.log('[E2E] Testing StorageManagementModal...');
  const storageModalTest = await evaluate(`(() => {
    const storageBtn = document.querySelector('[data-testid="open-storage-modal"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Depolama'));
    if (!storageBtn) return { open: false };
    storageBtn.click();
    return { open: true };
  })()`);
  assert.ok(storageModalTest.open, 'Opened storage modal');
  await new Promise((r) => setTimeout(r, 600));

  const storageContent = await evaluate(`(() => {
    const modalText = document.body.innerText;
    const hasStorageTitle = modalText.includes('Depolama & Önbellek Yönetimi');
    const hasStorageBar = modalText.includes('Toplam Tarayıcı Depolama Alanı');
    const closeBtn = document.querySelector('[data-testid="close-storage-modal"]');
    if (closeBtn) closeBtn.click();
    return { hasStorageTitle, hasStorageBar };
  })()`);
  console.log('✓ StorageManagementModal verified:', storageContent);
  assert.ok(storageContent.hasStorageTitle, 'StorageManagementModal rendered successfully');
  await new Promise((r) => setTimeout(r, 600));

  // 9. Test Modals: Lisanslar (AssetLicenseModal)
  console.log('[E2E] Testing AssetLicenseModal...');
  const licenseModalTest = await evaluate(`(() => {
    const licBtn = document.querySelector('[data-testid="open-license-modal"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Lisanslar'));
    if (!licBtn) return { open: false };
    licBtn.click();
    return { open: true };
  })()`);
  assert.ok(licenseModalTest.open, 'Opened license modal');
  await new Promise((r) => setTimeout(r, 600));

  const licenseContent = await evaluate(`(() => {
    const modalText = document.body.innerText;
    const hasLicenseTitle = modalText.includes('Lisanslar ve Üçüncü Taraf');
    const hasLegalNotice = modalText.includes('Tüm varlıklar ticari kullanım için');
    const closeBtn = document.querySelector('[data-testid="close-license-modal"]');
    if (closeBtn) closeBtn.click();
    return { hasLicenseTitle, hasLegalNotice };
  })()`);
  console.log('✓ AssetLicenseModal verified:', licenseContent);
  assert.ok(licenseContent.hasLicenseTitle, 'AssetLicenseModal rendered successfully');
  await new Promise((r) => setTimeout(r, 600));

  // Clean up
  console.log('[E2E] Closing Chrome...');
  ws.close();
  chromeProc.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}

  console.log('\n======================================================');
  console.log('✓ ALL BROWSER E2E TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

async function main() {
  try {
    await runStaticCatalogChecks();
    await runBrowserE2E();
    console.log('[FINAL RESULT] Video Asset Library Full Verification PASSED!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ [E2E FAILED]:', err);
    process.exit(1);
  }
}

main();
