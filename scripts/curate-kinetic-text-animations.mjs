import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const catalogPath = path.join(rootDir, 'public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const kineticNames = [
  { name: 'Kinetik Hızlı İleri Fırlama (Fast Zoom)', anim: 'zoom-in', techId: 'in-zoom-in' },
  { name: 'Kinetik Ritmik Sıçrama (Rhythm Bounce)', anim: 'pop', techId: 'in-pop' },
  { name: 'Kinetik Çapraz Kayma & Dönüş (Diagonal Slide)', anim: 'slide-right', techId: 'in-slide-right' },
  { name: 'Kinetik Harf Harf Daktilo Vurgusu (Typewriter)', anim: 'typewriter', techId: 'typewriter' },
  { name: 'Kinetik Glitch Titreşim & Bozulma (Glitch)', anim: 'glitch', techId: 'in-glitch' },
  { name: 'Kinetik 3D Derinlik Dönüşü (3D Flip)', anim: 'flip-in', techId: 'in-flip-in' },
  { name: 'Kinetik Dikey Yığılma (Vertical Stack)', anim: 'slide-up', techId: 'in-slide-up' },
  { name: 'Kinetik Spiral Dönme & Büyüme (Spiral In)', anim: 'spin-in', techId: 'in-spin-in' },
  { name: 'Kinetik Çarpma & Geri Sekme (Hard Impact)', anim: 'bounce-in', techId: 'in-bounce-in' },
  { name: 'Kinetik Genişleyen Harf Aralığı (Tracking)', anim: 'tracking-in', techId: 'in-tracking-in' },
  { name: 'Kinetik Dalgalı Elastik Salınım (Wave)', anim: 'wave-in', techId: 'in-wave-in' },
  { name: 'Kinetik Aşağıdan Hızlı Yükseliş (Speed Lift)', anim: 'slide-up', techId: 'in-slide-up' },
  { name: 'Kinetik Neon Çakar Titreşimi (Strobe)', anim: 'neon-flicker', techId: 'in-neon-flicker' },
  { name: 'Kinetik Perspektif Uçuşu (Perspective)', anim: 'fly-in', techId: 'in-fly-in' },
  { name: 'Kinetik Merkezden Patlama (Radial Burst)', anim: 'pop', techId: 'in-pop' },
  { name: 'Kinetik Basamaklı Akış (Cascade Flow)', anim: 'slide-left', techId: 'in-slide-left' },
  { name: 'Kinetik Ters Yönde Kayma & Kilit (Counter Snap)', anim: 'slide-down', techId: 'in-slide-down' },
  { name: 'Kinetik Kamera Sarsıntısı (Camera Shake)', anim: 'shake', techId: 'loop-shake' },
  { name: 'Kinetik Pikselli Çözülme (Pixel Dissolve)', anim: 'fade', techId: 'in-fade' },
  { name: 'Kinetik Büyüteç Odaklama (Magnify Pop)', anim: 'zoom-in', techId: 'in-zoom-in' },
  { name: 'Kinetik Esnek Jöle Hareketi (Jelly Wiggle)', anim: 'wiggle', techId: 'loop-wiggle' },
  { name: 'Kinetik Eğik Parşömen Kayışı (Skew Slide)', anim: 'slide-right', techId: 'in-slide-right' },
  { name: 'Kinetik Işık Hüzmesi & Flare (Light Streak)', anim: 'glow', techId: 'loop-glow' },
  { name: 'Kinetik Katlanan Kağıt 3D (3D Fold)', anim: 'flip-in', techId: 'in-flip-in' },
  { name: 'Kinetik Dinamik Vurgu Patlaması (Accent Boom)', anim: 'pop', techId: 'in-pop' }
];

let updated = 0;
for (const item of catalog) {
  if (item.category === 'Metin Animasyonları' && item.id.startsWith('anim-kinetic-')) {
    const num = parseInt(item.id.replace('anim-kinetic-', ''), 10) - 1;
    if (num >= 0 && num < kineticNames.length) {
      const info = kineticNames[num];
      item.name = info.name;
      item.localizedName = info.name;
      item.defaultText = `${info.name.split(' (')[0]}\nDinamik Tipografi Hareketi`;
      item.metadata = {
        id: item.id,
        name: info.name,
        category: item.category,
        animKind: info.techId.startsWith('loop-') ? 'loop' : 'in',
        technicalId: info.techId,
        textData: {
          text: item.defaultText,
          fontFamily: 'Montserrat',
          fontSize: 52,
          fontWeight: '800',
          color: '#ffffff',
          fillColor: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 3,
          shadowColor: 'rgba(0,0,0,0.8)',
          shadowBlur: 8,
          inAnimation: info.anim,
          inDuration: 0.8,
          textAlign: 'center',
          alignment: 'center'
        },
        transform: { x: 0, y: 0 }
      };
      updated++;
    }
  }
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`[SUCCESS] Updated ${updated} kinetic text animations with unique names and presets.`);
