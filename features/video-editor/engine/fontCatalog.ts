/**
 * FORMA Video Editor — Curated Turkish-Compatible Typography Catalog
 * 25-30 high-quality Google Fonts rigorously tested for Turkish characters:
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

export const FONT_CATALOG: FontItem[] = [
  // 1. SANS SERIF (7 core fonts)
  { id: 'Inter', name: 'Inter', category: 'sans-serif', googleFontName: 'Inter', fallback: 'sans-serif' },
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', category: 'sans-serif', googleFontName: 'Plus+Jakarta+Sans', fallback: 'sans-serif' },
  { id: 'Montserrat', name: 'Montserrat', category: 'sans-serif', googleFontName: 'Montserrat', fallback: 'sans-serif' },
  { id: 'Roboto', name: 'Roboto', category: 'sans-serif', googleFontName: 'Roboto', fallback: 'sans-serif' },
  { id: 'Poppins', name: 'Poppins', category: 'sans-serif', googleFontName: 'Poppins', fallback: 'sans-serif' },
  { id: 'Open Sans', name: 'Open Sans', category: 'sans-serif', googleFontName: 'Open+Sans', fallback: 'sans-serif' },
  { id: 'Lato', name: 'Lato', category: 'sans-serif', googleFontName: 'Lato', fallback: 'sans-serif' },

  // 2. SERIF (6 core fonts)
  { id: 'Playfair Display', name: 'Playfair Display', category: 'serif', googleFontName: 'Playfair+Display', fallback: 'serif' },
  { id: 'Merriweather', name: 'Merriweather', category: 'serif', googleFontName: 'Merriweather', fallback: 'serif' },
  { id: 'Lora', name: 'Lora', category: 'serif', googleFontName: 'Lora', fallback: 'serif' },
  { id: 'Cinzel', name: 'Cinzel', category: 'serif', googleFontName: 'Cinzel', fallback: 'serif' },
  { id: 'Cormorant Garamond', name: 'Cormorant Garamond', category: 'serif', googleFontName: 'Cormorant+Garamond', fallback: 'serif' },
  { id: 'PT Serif', name: 'PT Serif', category: 'serif', googleFontName: 'PT+Serif', fallback: 'serif' },

  // 3. DISPLAY (6 core fonts)
  { id: 'Bebas Neue', name: 'Bebas Neue', category: 'display', googleFontName: 'Bebas+Neue', fallback: 'sans-serif' },
  { id: 'Oswald', name: 'Oswald', category: 'display', googleFontName: 'Oswald', fallback: 'sans-serif' },
  { id: 'Anton', name: 'Anton', category: 'display', googleFontName: 'Anton', fallback: 'sans-serif' },
  { id: 'Barlow Condensed', name: 'Barlow Condensed', category: 'display', googleFontName: 'Barlow+Condensed', fallback: 'sans-serif' },
  { id: 'Righteous', name: 'Righteous', category: 'display', googleFontName: 'Righteous', fallback: 'cursive' },
  { id: 'Archivo Black', name: 'Archivo Black', category: 'display', googleFontName: 'Archivo+Black', fallback: 'sans-serif' },

  // 4. MONOSPACE (4 core fonts)
  { id: 'JetBrains Mono', name: 'JetBrains Mono', category: 'monospace', googleFontName: 'JetBrains+Mono', fallback: 'monospace' },
  { id: 'Fira Code', name: 'Fira Code', category: 'monospace', googleFontName: 'Fira+Code', fallback: 'monospace' },
  { id: 'Roboto Mono', name: 'Roboto Mono', category: 'monospace', googleFontName: 'Roboto+Mono', fallback: 'monospace' },
  { id: 'Space Mono', name: 'Space Mono', category: 'monospace', googleFontName: 'Space+Mono', fallback: 'monospace' },

  // 5. EL YAZISI / HANDWRITING (4 core fonts)
  { id: 'Caveat', name: 'Caveat', category: 'handwriting', googleFontName: 'Caveat', fallback: 'cursive' },
  { id: 'Dancing Script', name: 'Dancing Script', category: 'handwriting', googleFontName: 'Dancing+Script', fallback: 'cursive' },
  { id: 'Pacifico', name: 'Pacifico', category: 'handwriting', googleFontName: 'Pacifico', fallback: 'cursive' },
  { id: 'Great Vibes', name: 'Great Vibes', category: 'handwriting', googleFontName: 'Great+Vibes', fallback: 'cursive' },
];

const loadedFonts = new Set<string>();
const loadingPromises = new Map<string, Promise<void>>();
const loadedCategoryBatches = new Set<string>();

/**
 * Dynamically injects Google Fonts link stylesheet and awaits FontFace document load.
 */
export async function loadGoogleFont(fontId: string): Promise<void> {
  if (typeof document === 'undefined') return;

  if (loadedFonts.has(fontId)) return;
  if (loadingPromises.has(fontId)) return loadingPromises.get(fontId);

  const fontItem = FONT_CATALOG.find((f) => f.id.toLowerCase() === fontId.toLowerCase());
  if (!fontItem) {
    loadedFonts.add(fontId);
    return;
  }

  const promise = (async () => {
    try {
      const linkId = `gfont-${fontItem.id.replace(/\s+/g, '-').toLowerCase()}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontItem.googleFontName}:ital,wght@0,300..900;1,300..900&display=swap`;
        document.head.appendChild(link);
      }

      if ('fonts' in document) {
        await (document as any).fonts.load(`16px "${fontItem.id}"`);
      }

      loadedFonts.add(fontItem.id);
      notifyCanvasNeedsRedraw();
    } catch (err) {
      console.warn(`[fontCatalog] Font load failed for "${fontItem.id}":`, err);
      loadedFonts.add(fontItem.id);
    } finally {
      loadingPromises.delete(fontId);
    }
  })();

  loadingPromises.set(fontId, promise);
  return promise;
}

export function prefetchCategoryFonts(category: FontCategory): void {
  if (typeof document === 'undefined') return;
  if (loadedCategoryBatches.has(category)) return;
  loadedCategoryBatches.add(category);

  const fonts = category === 'all'
    ? FONT_CATALOG
    : FONT_CATALOG.filter((f) => f.category === category);

  const families = fonts.map((f) => `family=${f.googleFontName}`).join('&');
  const linkId = `gfont-batch-${category}`;
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }
}

export function preloadPopularFonts(): void {
  if (typeof document === 'undefined') return;
  const popular = ['Inter', 'Plus Jakarta Sans', 'Montserrat', 'Playfair Display', 'Bebas Neue', 'JetBrains Mono', 'Caveat'];
  for (const name of popular) {
    loadGoogleFont(name).catch(() => {});
  }
}
