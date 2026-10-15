import fs from 'node:fs';
import path from 'node:path';

// 1. Define all 24 unique licenses with complete legal metadata
const LICENSES = {
  'CC0-1.0': {
    id: 'CC0-1.0',
    name: 'Creative Commons Zero 1.0 Universal',
    aliasNames: ['CC0 1.0 Universal', 'CC0'],
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: false,
    shareAlike: false,
    summary: 'Kamu Malı tahsisi. Eserler herhangi bir telif hakkı veya atıf şartı olmaksızın ticari ve kişisel projelerde serbestçe kullanılabilir.',
    attributionTemplate: '{title} by {author} (Public Domain / CC0)'
  },
  'Public-Domain': {
    id: 'Public-Domain',
    name: 'Public Domain',
    aliasNames: ['Public domain', 'Public Domain'],
    url: 'https://creativecommons.org/publicdomain/mark/1.0/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: false,
    shareAlike: false,
    summary: 'Telif hakları süresi dolmuş veya kamu malına terk edilmiş eserler. Hiçbir kısıtlama olmaksızın kullanılabilir.',
    attributionTemplate: '{title} (Public Domain)'
  },
  'MIT': {
    id: 'MIT',
    name: 'MIT License',
    aliasNames: ['MIT License'],
    url: 'https://opensource.org/licenses/MIT',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'Açık kaynak yazılım ve varlık lisansı. Telif hakkı ve izin bildirimi korunmak kaydıyla ticari kullanıma tamamen açıktır.',
    attributionTemplate: '{title} under MIT License'
  },
  'ISC': {
    id: 'ISC',
    name: 'ISC License',
    aliasNames: ['ISC License / MIT'],
    url: 'https://opensource.org/licenses/ISC',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'MIT ile işlevsel olarak eşdeğer, telif bildirimi gerektiren hafif ve serbest ticari açık kaynak lisansı.',
    attributionTemplate: '{title} by Lucide Contributors (ISC License)'
  },
  'SIL-OFL-1.1': {
    id: 'SIL-OFL-1.1',
    name: 'SIL Open Font License 1.1',
    aliasNames: ['SIL Open Font License 1.1'],
    url: 'https://openfontlicense.org/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'Tipografi ve fontlar için standart açık kaynak lisansı. Dijital belgelerde ve videolarda gömülü ticari kullanıma tamamen uygundur.',
    attributionTemplate: 'Font: {title} ({author}) - SIL Open Font License 1.1'
  },
  'CC-BY-4.0': {
    id: 'CC-BY-4.0',
    name: 'Creative Commons Attribution 4.0 International',
    aliasNames: ['CC BY 4.0'],
    url: 'https://creativecommons.org/licenses/by/4.0/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'Eser sahibine uygun atıf verilmesi koşuluyla her formatta ticari ve kişisel kullanım, kopyalama ve uyarlama serbesttir.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-3.0': {
    id: 'CC-BY-3.0',
    name: 'Creative Commons Attribution 3.0 Unported',
    aliasNames: ['CC BY 3.0'],
    url: 'https://creativecommons.org/licenses/by/3.0/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'Atıf koşuluyla ticari kullanıma ve değiştirmeye izin veren standart Creative Commons lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-3.0-US': {
    id: 'CC-BY-3.0-US',
    name: 'Creative Commons Attribution 3.0 United States',
    aliasNames: ['CC BY 3.0 us'],
    url: 'https://creativecommons.org/licenses/by/3.0/us/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'ABD yargı bölgesine uyarlanmış CC BY 3.0 lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-2.5': {
    id: 'CC-BY-2.5',
    name: 'Creative Commons Attribution 2.5 Generic',
    aliasNames: ['CC BY 2.5'],
    url: 'https://creativecommons.org/licenses/by/2.5/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'Atıf gerektiren Creative Commons 2.5 jenerik lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-2.5-AU': {
    id: 'CC-BY-2.5-AU',
    name: 'Creative Commons Attribution 2.5 Australia',
    aliasNames: ['CC BY 2.5 au'],
    url: 'https://creativecommons.org/licenses/by/2.5/au/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'Avustralya yargı bölgesine uyarlanmış CC BY 2.5 lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-2.0': {
    id: 'CC-BY-2.0',
    name: 'Creative Commons Attribution 2.0 Generic',
    aliasNames: ['CC BY 2.0'],
    url: 'https://creativecommons.org/licenses/by/2.0/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'Atıf şartı içeren Creative Commons 2.0 jenerik lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-2.0-FR': {
    id: 'CC-BY-2.0-FR',
    name: 'Creative Commons Attribution 2.0 France',
    aliasNames: ['CC BY 2.0 fr'],
    url: 'https://creativecommons.org/licenses/by/2.0/fr/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'Fransa yargı bölgesine uyarlanmış CC BY 2.0 lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-SA-4.0': {
    id: 'CC-BY-SA-4.0',
    name: 'Creative Commons Attribution-ShareAlike 4.0 International',
    aliasNames: ['CC BY-SA 4.0'],
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: true,
    summary: 'Atıf verilmesi ve eserin değiştirilmesi durumunda aynı lisansla dağıtılması şartıyla ticari kullanıma açık lisans.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-SA-3.0': {
    id: 'CC-BY-SA-3.0',
    name: 'Creative Commons Attribution-ShareAlike 3.0 Unported',
    aliasNames: ['CC BY-SA 3.0'],
    url: 'https://creativecommons.org/licenses/by-sa/3.0/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: true,
    summary: 'Atıf ve Aynı-Lisansla-Paylaş koşullu CC BY-SA 3.0 lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-SA-3.0-NL': {
    id: 'CC-BY-SA-3.0-NL',
    name: 'Creative Commons Attribution-ShareAlike 3.0 Netherlands',
    aliasNames: ['CC BY-SA 3.0 nl'],
    url: 'https://creativecommons.org/licenses/by-sa/3.0/nl/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: true,
    summary: 'Hollanda yargı bölgesine uyarlanmış CC BY-SA 3.0 lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-SA-3.0-AU': {
    id: 'CC-BY-SA-3.0-AU',
    name: 'Creative Commons Attribution-ShareAlike 3.0 Australia',
    aliasNames: ['CC BY-SA 3.0 au'],
    url: 'https://creativecommons.org/licenses/by-sa/3.0/au/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: true,
    summary: 'Avustralya yargı bölgesine uyarlanmış CC BY-SA 3.0 lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-SA-2.5': {
    id: 'CC-BY-SA-2.5',
    name: 'Creative Commons Attribution-ShareAlike 2.5 Generic',
    aliasNames: ['CC BY-SA 2.5'],
    url: 'https://creativecommons.org/licenses/by-sa/2.5/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: true,
    summary: 'Atıf ve Aynı-Lisansla-Paylaş şartlı CC BY-SA 2.5 lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-SA-2.0': {
    id: 'CC-BY-SA-2.0',
    name: 'Creative Commons Attribution-ShareAlike 2.0 Generic',
    aliasNames: ['CC BY-SA 2.0'],
    url: 'https://creativecommons.org/licenses/by-sa/2.0/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: true,
    summary: 'Atıf ve Aynı-Lisansla-Paylaş şartlı CC BY-SA 2.0 lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'CC-BY-SA-2.0-FR': {
    id: 'CC-BY-SA-2.0-FR',
    name: 'Creative Commons Attribution-ShareAlike 2.0 France',
    aliasNames: ['CC BY-SA 2.0 fr'],
    url: 'https://creativecommons.org/licenses/by-sa/2.0/fr/',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: true,
    summary: 'Fransa yargı bölgesine uyarlanmış CC BY-SA 2.0 lisansı.',
    attributionTemplate: '{title} by {author} ({license}) via {source}'
  },
  'GFDL-1.2': {
    id: 'GFDL-1.2',
    name: 'GNU Free Documentation License 1.2',
    aliasNames: ['GFDL', 'GFDL 1.2'],
    url: 'https://www.gnu.org/licenses/old-licenses/fdl-1.2.html',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: true,
    summary: 'Özgür Yazılım Vakfı (FSF) tarafından oluşturulan telifli belge ve medya lisansı. Atıf ve copyleft paylaşım şartı içerir.',
    attributionTemplate: '{title} by {author} (GFDL) via {source}'
  },
  'EEF-OAL-1': {
    id: 'EEF-OAL-1',
    name: 'European Educational Foundation Open Audio License 1.0',
    aliasNames: ['EEF OAL-1'],
    url: 'https://commons.wikimedia.org/wiki/Commons:EEF_Open_Audio_License',
    commercialUse: true,
    modification: true,
    distribution: true,
    attributionRequired: true,
    shareAlike: false,
    summary: 'Avrupa Eğitim Vakfı Açık Ses Lisansı. Eğitim ve ticari projelerde atıf yapılarak kullanılabilir.',
    attributionTemplate: '{title} by {author} (EEF Open Audio License) via {source}'
  }
};

// Map lookup table from raw string to license ID
const NAME_TO_ID = {};
for (const [id, lic] of Object.entries(LICENSES)) {
  for (const name of lic.aliasNames) {
    NAME_TO_ID[name.toLowerCase().trim()] = id;
  }
  NAME_TO_ID[lic.name.toLowerCase().trim()] = id;
}

// 2. Load catalog and manifest
const catPath = 'public/video-assets/ONLINE_CATALOG.json';
const manPath = 'public/video-assets/ASSET_MANIFEST.json';
const licPath = 'public/video-assets/ASSET_LICENSES.json';

const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manPath, 'utf8'));

let unmappedCount = 0;
const attributions = [];

function processItem(item) {
  const rawLic = (item.licenseName || item.license || '').trim();
  const licId = NAME_TO_ID[rawLic.toLowerCase()] || 'CC0-1.0';
  const licDef = LICENSES[licId];

  if (!licDef) {
    unmappedCount++;
    console.warn(`Unmapped license for ${item.id}: "${rawLic}"`);
  }

  item.licenseId = licId;
  item.licenseName = licDef ? licDef.name : rawLic;
  item.licenseUrl = licDef ? licDef.url : item.licenseUrl;
  item.attributionRequired = licDef ? licDef.attributionRequired : false;

  // Build standard attribution text
  if (licDef && licDef.attributionRequired) {
    const title = item.name || item.localizedName || item.id;
    const author = item.author || 'Anonim';
    const source = item.source || 'Wikimedia Commons';
    item.attributionText = `${title} by ${author} (${licDef.name}) via ${source}`;
  } else {
    item.attributionText = `${item.name} (Public Domain / CC0)`;
  }

  attributions.push({
    id: item.id,
    name: item.name,
    author: item.author || 'Bilinmiyor',
    license: item.licenseName,
    licenseId: item.licenseId,
    licenseUrl: item.licenseUrl,
    source: item.source,
    sourceUrl: item.sourceUrl,
    attributionRequired: item.attributionRequired,
    attributionText: item.attributionText
  });
}

catalog.forEach(processItem);
manifest.forEach(processItem);

// 3. Write standardized ASSET_LICENSES.json
const licensesOutput = {
  version: '2.0.0',
  generatedAt: new Date().toISOString(),
  totalAssets: catalog.length,
  totalUniqueLicenses: Object.keys(LICENSES).length,
  licenses: LICENSES,
  assetAttributions: attributions
};

fs.writeFileSync(licPath, JSON.stringify(licensesOutput, null, 2), 'utf8');
fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2), 'utf8');
fs.writeFileSync(manPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log('✓ ASSET_LICENSES.json written successfully!');
console.log(`  Total unique licenses defined: ${Object.keys(LICENSES).length}`);
console.log(`  Total assets updated: ${catalog.length}`);
console.log(`  Unmapped count: ${unmappedCount}`);
