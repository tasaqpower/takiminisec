import fs from 'node:fs';

const cat = JSON.parse(fs.readFileSync('public/video-assets/ONLINE_CATALOG.json', 'utf8'));
const man = JSON.parse(fs.readFileSync('public/video-assets/ASSET_MANIFEST.json', 'utf8'));
const all = [...cat, ...man];

const licenses = new Map();
all.forEach((item) => {
  const lic = item.licenseName || item.license || 'Unknown';
  licenses.set(lic, (licenses.get(lic) || 0) + 1);
});

console.log('Unique Licenses Count:', licenses.size);
for (const [k, v] of [...licenses.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  "${k}": ${v}`);
}
