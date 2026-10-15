import fs from 'node:fs';

const cat98 = JSON.parse(fs.readFileSync('catalog_98_physical_assets.json', 'utf8')).assets;
const rep = JSON.parse(fs.readFileSync('extra_361_physical_assets_report.json', 'utf8')).files;

const allMediaFiles = new Set();
// read all files in Verified-Media
function getFiles(dir) {
  let list = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + e.name;
    if (e.isDirectory()) list.push(...getFiles(full));
    else list.push(e.name);
  }
  return list;
}

const mediaNames = new Set(getFiles('FORMA-ADOBE-CORE-PACK/Verified-Media'));
const missingFromCorePack = [];

for (const c of cat98) {
  if (!mediaNames.has(c.fileName)) {
    missingFromCorePack.push(c);
  }
}

console.log(`Cat98 items missing from Core Pack Verified-Media: ${missingFromCorePack.length}`);
console.log('Missing items:', missingFromCorePack.map(x => ({ id: x.catalogId, file: x.fileName, path: x.diskPath })));
