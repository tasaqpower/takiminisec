export type StampType = 'circle' | 'rectangle';
export type StampGrunge = 'none' | 'subtle' | 'authentic';

export interface StampConfig {
  type: StampType;
  preset: string;
  companyName: string;
  statusText: string;
  subtitle: string;
  signerName?: string;
  date: string;
  color: string;
  angle: number;
  opacity: number;
  grunge: StampGrunge;
  borderWidth: number;
}

export const STAMP_PRESETS: { id: string; label: string; status: string; defaultColor: string }[] = [
  { id: 'asli-gibidir', label: 'ASLI GİBİDİR', status: 'ASLI GİBİDİR', defaultColor: '#dc2626' },
  { id: 'onaylandi', label: 'ONAYLANDI', status: 'ONAYLANDI', defaultColor: '#1d4ed8' },
  { id: 'odendi', label: 'ÖDENDİ', status: 'ÖDENDİ', defaultColor: '#15803d' },
  { id: 'kontrol-edildi', label: 'KONTROL EDİLDİ', status: 'KONTROL EDİLDİ', defaultColor: '#1d4ed8' },
  { id: 'gizlidir', label: 'GİZLİDİR / CONFIDENTIAL', status: 'GİZLİDİR', defaultColor: '#dc2626' },
  { id: 'muhasebe', label: 'MUHASEBE KAYDI', status: 'MUHASEBE', defaultColor: '#7e22ce' },
  { id: 'teslim-alindi', label: 'TESLİM ALINDI', status: 'TESLİM ALINDI', defaultColor: '#0f766e' },
  { id: 'ozel', label: 'ÖZEL KAŞE', status: 'ONAYLANDI', defaultColor: '#dc2626' }
];

export const STAMP_COLORS = [
  { hex: '#dc2626', name: 'Resmi Kırmızı' },
  { hex: '#1d4ed8', name: 'Banka Mavisi' },
  { hex: '#15803d', name: 'Zümrüt Yeşili' },
  { hex: '#18181b', name: 'Arşiv Siyahı' },
  { hex: '#7e22ce', name: 'Klasik Mor' }
];

export function getDefaultStampConfig(): StampConfig {
  const today = new Date();
  const dateStr = today.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return {
    type: 'circle',
    preset: 'asli-gibidir',
    companyName: 'FORMA TEKNOLOJİ VE BİLİŞİM A.Ş.',
    statusText: 'ASLI GİBİDİR',
    subtitle: 'KADIKÖY V.D. 3829104829 • MERSİS: 038291048290001',
    signerName: 'Yetkili İmza & Onay',
    date: dateStr,
    color: '#dc2626',
    angle: -3.5,
    opacity: 0.92,
    grunge: 'authentic',
    borderWidth: 3.5
  };
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderStampSvg(config: StampConfig): string {
  const color = config.color || '#dc2626';
  const opacity = Math.max(0.3, Math.min(1, config.opacity || 0.92));
  const angle = config.angle || 0;
  const grunge = config.grunge || 'authentic';

  const filterDef = grunge !== 'none'
    ? `<filter id="stamp-distress" x="-10%" y="-10%" width="120%" height="120%">
         <feTurbulence type="fractalNoise" baseFrequency="${grunge === 'authentic' ? '0.045' : '0.025'}" numOctaves="4" result="noise"/>
         <feDisplacementMap in="SourceGraphic" in2="noise" scale="${grunge === 'authentic' ? '2.5' : '1.2'}" xChannelSelector="R" yChannelSelector="G"/>
       </filter>`
    : '';

  const filterAttr = grunge !== 'none' ? 'filter="url(#stamp-distress)"' : '';

  if (config.type === 'circle') {
    const size = 320;
    const cx = size / 2;
    const cy = size / 2;
    const rOuter = 144;
    const rInner = 136;
    const bw = config.borderWidth || 3.5;

    const companyName = escapeXml(config.companyName.toUpperCase());
    const subtitle = escapeXml(config.subtitle.toUpperCase());
    const statusText = escapeXml(config.statusText.toUpperCase());
    const date = escapeXml(config.date);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <defs>
        ${filterDef}
        <path id="top-arc" d="M 40 ${cy} A 120 120 0 1 1 ${size - 40} ${cy}" fill="none"/>
        <path id="bot-arc" d="M ${size - 40} ${cy} A 120 120 0 0 1 40 ${cy}" fill="none"/>
      </defs>
      <g transform="rotate(${angle} ${cx} ${cy})" opacity="${opacity}" ${filterAttr} stroke="${color}" fill="${color}">
        <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="${color}" stroke-width="${bw}"/>
        <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="none" stroke="${color}" stroke-width="1.5"/>

        <text font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1.5" fill="${color}">
          <textPath href="#top-arc" startOffset="50%" text-anchor="middle">
            ${companyName}
          </textPath>
        </text>

        <text font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="8.5" font-weight="600" letter-spacing="0.8" fill="${color}">
          <textPath href="#bot-arc" startOffset="50%" text-anchor="middle">
            ${subtitle}
          </textPath>
        </text>

        <line x1="45" y1="130" x2="275" y2="130" stroke="${color}" stroke-width="2"/>
        <line x1="45" y1="190" x2="275" y2="190" stroke="${color}" stroke-width="2"/>

        <text x="${cx}" y="166" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="2" text-anchor="middle" fill="${color}">
          ${statusText}
        </text>

        <text x="${cx}" y="214" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="1" text-anchor="middle" fill="${color}">
          ★ ${date} ★
        </text>
      </g>
    </svg>`;
  }

  const w = 380;
  const h = 180;
  const cx = w / 2;
  const cy = h / 2;
  const bw = config.borderWidth || 3.5;

  const companyName = escapeXml(config.companyName.toUpperCase());
  const statusText = escapeXml(config.statusText.toUpperCase());
  const subtitle = escapeXml(config.subtitle || 'TİCARET SİCİL NO: 938210');
  const signerName = escapeXml(config.signerName || 'Yetkili Onay');
  const date = escapeXml(config.date);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      ${filterDef}
    </defs>
    <g transform="rotate(${angle} ${cx} ${cy})" opacity="${opacity}" ${filterAttr} stroke="${color}" fill="${color}">
      <rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="6" fill="none" stroke="${color}" stroke-width="${bw}"/>
      <rect x="15" y="15" width="${w - 30}" height="${h - 30}" rx="3" fill="none" stroke="${color}" stroke-width="1.5"/>

      <text x="${cx}" y="42" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="12" font-weight="800" letter-spacing="1" text-anchor="middle" fill="${color}">
        ${companyName}
      </text>

      <line x1="25" y1="54" x2="${w - 25}" y2="54" stroke="${color}" stroke-width="1.5"/>

      <text x="${cx}" y="95" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="24" font-weight="900" letter-spacing="2.5" text-anchor="middle" fill="${color}">
        ${statusText}
      </text>

      <line x1="25" y1="112" x2="${w - 25}" y2="112" stroke="${color}" stroke-width="1.5"/>

      <text x="30" y="134" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9.5" font-weight="600" fill="${color}">
        ${signerName}
      </text>
      <text x="${w - 30}" y="134" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9.5" font-weight="700" text-anchor="end" fill="${color}">
        ${date}
      </text>

      <text x="${cx}" y="153" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="8" font-weight="500" letter-spacing="0.5" text-anchor="middle" fill="${color}">
        ${subtitle}
      </text>
    </g>
  </svg>`;
}

export function stampSvgToDataUrl(svgString: string): string {
  const base64 = typeof window !== 'undefined'
    ? window.btoa(unescape(encodeURIComponent(svgString)))
    : Buffer.from(svgString).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export async function stampSvgToPngDataUrl(
  svgString: string,
  targetWidth = 600,
  targetHeight = 600
): Promise<string> {
  if (typeof window === 'undefined') {
    return stampSvgToDataUrl(svgString);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(stampSvgToDataUrl(svgString));
        return;
      }
      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      resolve(stampSvgToDataUrl(svgString));
    };
    img.src = stampSvgToDataUrl(svgString);
  });
}
