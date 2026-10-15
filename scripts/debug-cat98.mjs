import fs from 'node:fs';

const cat98 = JSON.parse(fs.readFileSync('catalog_98_physical_assets.json', 'utf8')).assets;
const rep = JSON.parse(fs.readFileSync('extra_361_physical_assets_report.json', 'utf8')).files;

const repFiles = new Set(rep.map(x => x.fileName));
const repHashes = new Set(rep.map(x => x.sha256));

const unmatchedInCat98 = [];
for (const c of cat98) {
  if (repFiles.has(c.fileName) || repHashes.has(c.sha256)) {
    unmatchedInCat98.push(c);
  }
}

console.log(`Items in cat98 that ended up in rep: ${unmatchedInCat98.length}`);
console.log('Sample unmatched:', unmatchedInCat98.slice(0, 5));
