const fs = require('fs');
const path = require('path');

async function main() {
  const url = 'https://raw.githubusercontent.com/dnomak/svg-turkiye-haritasi/master/index.html';
  console.log('Fetching full SVG map from GitHub...');
  const res = await fetch(url);
  const content = await res.text();

  const gRegex = /<g\s+id="([^"]+)"\s+data-plakakodu="([^"]+)"\s+data-alankodu="([^"]+)"\s+data-iladi="([^"]+)">([\s\S]*?)<\/g>/g;

  const provinces = [];
  let match;

  while ((match = gRegex.exec(content)) !== null) {
    const [_, id, plaka, alan, iladi, inner] = match;
    
    const pathRegex = /<path\s+d="([^"]+)"/g;
    let pathMatch;
    const paths = [];
    while ((pathMatch = pathRegex.exec(inner)) !== null) {
      paths.push(pathMatch[1].replace(/\s+/g, ' ').trim());
    }

    provinces.push({
      id: id.toLowerCase(),
      plate: parseInt(plaka, 10),
      name: iladi,
      phoneCode: alan,
      paths: paths,
      d: paths.join(' ')
    });
  }

  console.log(`Extracted ${provinces.length} provinces.`);

  const targetPath = path.join(__dirname, '../client/src/data/turkeyMapSvgData.js');
  
  const outContent = `// Official Geographic SVG Turkey Map 81 Provinces Dataset
// ViewBox: 0 0 1007.478 527.323
export const TURKEY_VIEWBOX = "0 0 1007.478 527.323";

export const TURKEY_PROVINCES_SVG = ${JSON.stringify(provinces, null, 2)};
`;

  fs.writeFileSync(targetPath, outContent, 'utf8');
  console.log('Successfully written to', targetPath);
}

main().catch(console.error);
