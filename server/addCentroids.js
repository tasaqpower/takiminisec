const fs = require('fs');
const path = require('path');

// Calculate approximate center (centroid) for SVG paths by parsing numbers in 'd'
const svgDataPath = path.join(__dirname, '../client/src/data/turkeyMapSvgData.js');
const svgContent = fs.readFileSync(svgDataPath, 'utf8');

// Require or parse the array
const jsonStrMatch = svgContent.match(/export const TURKEY_PROVINCES_SVG = (\[[\s\S]*?\]);/);
if (!jsonStrMatch) {
  console.error('Could not find TURKEY_PROVINCES_SVG');
  process.exit(1);
}

const provinces = JSON.parse(jsonStrMatch[1]);

provinces.forEach(p => {
  const allD = p.paths ? p.paths.join(' ') : p.d;
  // Match coordinates: e.g. M123,456 or L 123 456 or 123,456 or -123,456
  // Extract all numbers after commands or absolute coordinates
  // SVG paths in dnomak format are absolute (M..., L..., C...) or relative
  // Let's parse numbers
  const nums = allD.match(/[-+]?[0-9]*\.?[0-9]+/g);
  if (nums && nums.length >= 2) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    // In dnomak format, coordinates are absolute X, Y
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = parseFloat(nums[i]);
      const y = parseFloat(nums[i+1]);
      if (!isNaN(x) && !isNaN(y) && x >= 0 && x <= 1010 && y >= 0 && y <= 550) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    p.centerX = Math.round((minX + maxX) / 2);
    p.centerY = Math.round((minY + maxY) / 2);
  } else {
    p.centerX = 500;
    p.centerY = 250;
  }
});

// Custom manual fine-tuning for certain provinces if needed
const manualAdjustments = {
  'istanbul-avrupa': { centerX: 185, centerY: 70 },
  'istanbul-asya': { centerX: 228, centerY: 82 },
  'izmir': { centerX: 105, centerY: 235 },
  'canakkale': { centerX: 80, centerY: 140 },
  'balikesir': { centerX: 155, centerY: 150 },
  'mugla': { centerX: 175, centerY: 335 },
  'antalya': { centerX: 330, centerY: 350 },
  'ankara': { centerX: 405, centerY: 180 },
  'konya': { centerX: 410, centerY: 285 },
  'diyarbakir': { centerX: 740, centerY: 290 },
  'trabzon': { centerX: 730, centerY: 95 },
  'adana': { centerX: 515, centerY: 345 },
  'sanliurfa': { centerX: 695, centerY: 345 },
  'gaziantep': { centerX: 590, centerY: 345 },
  'hatay': { centerX: 540, centerY: 410 },
  'van': { centerX: 935, centerY: 240 },
  'erzurum': { centerX: 820, centerY: 160 },
  'samsun': { centerX: 575, centerY: 90 },
  'bursa': { centerX: 215, centerY: 135 },
  'kocaeli': { centerX: 255, centerY: 90 },
  'sakarya': { centerX: 295, centerY: 100 }
};

provinces.forEach(p => {
  if (manualAdjustments[p.id]) {
    p.centerX = manualAdjustments[p.id].centerX;
    p.centerY = manualAdjustments[p.id].centerY;
  }
});

const outContent = `// Official Geographic SVG Turkey Map 81 Provinces Dataset with Centroids
// ViewBox: 0 0 1007.478 527.323
export const TURKEY_VIEWBOX = "0 0 1007.478 527.323";

export const TURKEY_PROVINCES_SVG = ${JSON.stringify(provinces, null, 2)};
`;

fs.writeFileSync(svgDataPath, outContent, 'utf8');
console.log('Successfully updated turkeyMapSvgData.js with accurate centroids!');
