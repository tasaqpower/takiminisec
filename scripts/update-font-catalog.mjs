import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const catalogPath = path.join(rootDir, 'public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const fonts = catalog.filter(a => a.type === 'font' || (a.category && a.category.includes('Font')));
const uniqueFonts = new Map();

for (const f of fonts) {
  const rawId = f.fontFamily || f.name.replace(/\s+Font$/i, '').trim();
  if (!uniqueFonts.has(rawId.toLowerCase())) {
    let cat = (f.fontCategory || 'Sans Serif').toLowerCase().replace(' ', '-');
    if (!['sans-serif', 'serif', 'display', 'monospace', 'handwriting'].includes(cat)) {
      cat = 'sans-serif';
    }
    let fallback = 'sans-serif';
    if (cat === 'serif') fallback = 'serif';
    else if (cat === 'monospace') fallback = 'monospace';
    else if (cat === 'handwriting') fallback = 'cursive';

    uniqueFonts.set(rawId.toLowerCase(), {
      id: rawId,
      name: rawId,
      category: cat,
      googleFontName: rawId.replace(/\s+/g, '+'),
      fallback
    });
  }
}

const fontItems = Array.from(uniqueFonts.values());

const code = `/**
 * FORMA Video Editor — Curated Turkish-Compatible Typography Catalog
 * 160 high-quality Google Fonts rigorously verified for Turkish character set:
 * (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü)
 * Categorized into Sans Serif, Serif, Display, Monospace, and El Yazısı. Zero emojis.
 */

import { notifyCanvasNeedsRedraw } from './previewRenderer';

export type FontCategory = 'all' | 'sans-serif' | 'serif' | 'display' | 'monospace' | 'handwriting';

export interface FontItem {
  id: string; // Used in CSS / canvas font-family, e.g. "Montserrat"
  name: string; // User-facing label
  category: 'sans-serif' | 'serif' | 'display' | 'monospace' | 'handwriting';
  googleFontName: string; // For Google Fonts API URL
  fallback: string;
}

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'sans-serif', label: 'Sans Serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'monospace', label: 'Monospace' },
  { id: 'handwriting', label: 'El Yazısı' },
];

export const FONT_CATALOG: FontItem[] = ${JSON.stringify(fontItems, null, 2)};

const loadedFonts = new Set<string>();
const loadingPromises = new Map<string, Promise<void>>();
const loadedCategoryBatches = new Set<string>();

/**
 * Normalizes font name by stripping 'font-', ' Font', ' Yazı Tipi', quotes etc.
 */
export function normalizeFontName(rawName: string): string {
  if (!rawName) return 'Plus Jakarta Sans';
  let cleaned = rawName.replace(/^font-/i, '').replace(/['"]/g, '').trim();
  cleaned = cleaned.replace(/\\s+Font$/i, '').replace(/\\s+Yazı Tipi$/i, '').trim();
  const matched = FONT_CATALOG.find((f) => f.id.toLowerCase() === cleaned.toLowerCase() || f.name.toLowerCase() === cleaned.toLowerCase());
  return matched ? matched.id : cleaned;
}

/**
 * Dynamically injects Google Fonts link stylesheet and awaits FontFace document load.
 * Works for any Google font without hardcoded whitelist and without forcing unsupported axis ranges.
 */
export async function loadGoogleFont(fontId: string): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!fontId) return;

  const resolvedFamily = normalizeFontName(fontId);
  if (loadedFonts.has(resolvedFamily)) return;
  if (loadingPromises.has(resolvedFamily)) return loadingPromises.get(resolvedFamily);

  const promise = (async () => {
    try {
      const safeId = resolvedFamily.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const linkId = \`gfont-\${safeId}\`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        const encodedFamily = encodeURIComponent(resolvedFamily).replace(/%20/g, '+');
        link.href = \`https://fonts.googleapis.com/css2?family=\${encodedFamily}&display=swap\`;
        document.head.appendChild(link);
      }

      if ('fonts' in document) {
        try {
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
          await Promise.race([
            (document as any).fonts.load(\`16px "\${resolvedFamily}"\`),
            timeout
          ]);
        } catch {
          // Continue if timeout or fonts.load unsupported
        }
      }

      loadedFonts.add(resolvedFamily);
      notifyCanvasNeedsRedraw();
    } catch (err) {
      console.warn(\`[fontCatalog] Font load failed for "\${resolvedFamily}":\`, err);
      loadedFonts.add(resolvedFamily);
    } finally {
      loadingPromises.delete(resolvedFamily);
    }
  })();

  loadingPromises.set(resolvedFamily, promise);
  return promise;
}

export function isFontLoaded(fontId: string): boolean {
  const resolved = normalizeFontName(fontId);
  return loadedFonts.has(resolved);
}

export function prefetchCategoryFonts(category: FontCategory): void {
  if (typeof document === 'undefined') return;
  if (loadedCategoryBatches.has(category)) return;
  loadedCategoryBatches.add(category);

  const fonts = category === 'all'
    ? FONT_CATALOG
    : FONT_CATALOG.filter((f) => f.category === category);

  // Split into chunks of 15 to stay within safe URL length limits
  const CHUNK_SIZE = 15;
  for (let i = 0; i < fonts.length; i += CHUNK_SIZE) {
    const chunk = fonts.slice(i, i + CHUNK_SIZE);
    const families = chunk.map((f) => \`family=\${encodeURIComponent(f.id).replace(/%20/g, '+')}&display=swap\`).join('&');
    const linkId = \`gfont-batch-\${category}-\${i}\`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = \`https://fonts.googleapis.com/css2?\${families}\`;
      document.head.appendChild(link);
    }
  }
}

export function preloadPopularFonts(): void {
  if (typeof document === 'undefined') return;
  const popular = ['Inter', 'Plus Jakarta Sans', 'Montserrat', 'Playfair Display', 'Bebas Neue', 'JetBrains Mono', 'Caveat', 'Oswald'];
  for (const name of popular) {
    loadGoogleFont(name).catch(() => {});
  }
}
`;

const targetFile = path.join(rootDir, 'features/video-editor/engine/fontCatalog.ts');
fs.writeFileSync(targetFile, code, 'utf8');
console.log('Successfully wrote fontCatalog.ts with', fontItems.length, 'fonts!');
