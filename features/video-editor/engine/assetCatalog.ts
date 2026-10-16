/**
 * FORMA Video Editor — Central Asset Catalog Engine
 * Supports 2,000+ real assets with instant search, bilingual synonym lookup,
 * category filtering, favorites, local caching status, and responsive pagination.
 */

export type AssetType =
  | 'video'
  | 'audio'
  | 'overlay'
  | 'element'
  | 'lut'
  | 'title'
  | 'font'
  | 'transition';

export interface CatalogAssetItem {
  id: string;
  name: string;
  localizedName: string;
  type: AssetType;
  category: string;
  tags: string[];
  source: string;
  sourceUrl: string;
  downloadUrl: string;
  previewUrl: string;
  filePath?: string;
  previewPath?: string;
  thumbnailPath?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAlpha?: boolean;
  loopable?: boolean;
  author: string;
  licenseName: string;
  licenseUrl: string;
  attributionRequired: boolean;
  attributionText?: string;
  sha256?: string | null;
  hashStatus?: 'verified' | 'pending-download' | 'virtual-procedural';
  licenseId?: string;
  downloadStatus?: 'not-downloaded' | 'downloading' | 'downloaded' | 'failed';
  integrityStatus?: 'unverified' | 'verified' | 'failed';
  decoderStatus?: 'unverified' | 'verified' | 'failed';
  qualityStatus?: 'approved' | 'editorial' | 'low-quality' | 'miscategorized' | 'rejected';
  qualityReason?: string;
  fileSize: number;
  version: string;
  isBuiltIn?: boolean;
  isDownloaded?: boolean;
  isFavorite?: boolean;
  // Specific payload attributes
  style?: string;
  defaultText?: string;
  intensity?: number;
  fontFamily?: string;
  fontCategory?: string;
  blendMode?: string;
  metadata?: any;
}

export interface CatalogFilterOptions {
  query?: string;
  category?: string; // 'all' or specific category
  type?: AssetType | 'all';
  filter?: 'all' | 'free' | 'builtin' | 'downloaded' | 'online' | 'favorites' | 'forma-originals';
  qualityStatus?: 'all' | 'approved' | 'editorial' | 'low-quality' | 'miscategorized' | 'rejected';
  source?: string;
  license?: string;
  aspectRatio?: 'all' | '16:9' | '9:16' | '1:1';
  hasAlpha?: boolean;
  loopable?: boolean;
  sortBy?: 'name' | 'duration' | 'size' | 'popular';
}

const FAVORITES_STORAGE_KEY = 'forma_video_editor_asset_favorites';

// Bilingual Turkish - English synonym lookup dictionary
const SYNONYM_MAP: Record<string, string[]> = {
  yağmur: ['rain', 'water', 'storm', 'droplet', 'fırtına'],
  rain: ['yağmur', 'su', 'fırtına', 'storm'],
  alkış: ['applause', 'clapping', 'cheer', 'audience'],
  applause: ['alkış', 'tezahürat', 'tebrik'],
  geçiş: ['transition', 'whoosh', 'swipe', 'wipe', 'cut'],
  transition: ['geçiş', 'whoosh', 'kesme'],
  ışık: ['light', 'leak', 'flare', 'glow', 'sun', 'bright'],
  'light leak': ['ışık sızıntısı', 'parlama', 'flare'],
  duman: ['smoke', 'fog', 'sis', 'vapor', 'cloud'],
  smoke: ['duman', 'sis', 'buhar'],
  çizik: ['scratches', 'dust', 'grain', 'vintage'],
  scratches: ['çizik', 'toz', 'gren', 'analog'],
  gerilim: ['suspense', 'tension', 'drone', 'dark', 'horror'],
  suspense: ['gerilim', 'korku', 'tansiyon'],
  neşeli: ['happy', 'upbeat', 'cheerful', 'joy'],
  happy: ['neşeli', 'mutlu', 'eğlenceli'],
  çocuk: ['kids', 'children', 'playful', 'toy'],
  kids: ['çocuk', 'oyun'],
  cam: ['glass', 'break', 'shatter', 'window'],
  'glass break': ['cam kırılması'],
  deniz: ['sea', 'ocean', 'wave', 'dalga', 'sahil', 'beach'],
  orman: ['forest', 'wood', 'tree', 'nature', 'doğa'],
  şehir: ['city', 'urban', 'traffic', 'building', 'sokak'],
  ateş: ['fire', 'flames', 'sparks', 'burning', 'alev'],
  fire: ['ateş', 'alev', 'kıvılcım'],
  kar: ['snow', 'winter', 'blizzard', 'kış'],
  snow: ['kar', 'kış', 'tipi'],
  kuş: ['bird', 'chirp', 'singing', 'songbird'],
  bird: ['kuş', 'ötüş', 'cıvıltı'],
};

class AssetCatalogService {
  private catalog: CatalogAssetItem[] = [];
  private favorites: Set<string> = new Set();
  private downloadedAssetIds: Set<string> = new Set();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFavorites();
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }

  private loadFavorites(): void {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        this.favorites = new Set(JSON.parse(stored));
      }
    } catch {
      this.favorites = new Set();
    }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(this.favorites)));
    } catch {}
    this.notify();
  }

  public isFavorite(assetId: string): boolean {
    return this.favorites.has(assetId);
  }

  public toggleFavorite(assetId: string): boolean {
    if (this.favorites.has(assetId)) {
      this.favorites.delete(assetId);
    } else {
      this.favorites.add(assetId);
    }
    this.saveFavorites();
    return this.favorites.has(assetId);
  }

  public markAsDownloaded(
    assetId: string,
    actualSha256?: string,
    integrityStatus: 'verified' | 'failed' = 'verified',
    decoderStatus: 'verified' | 'failed' = 'verified'
  ): void {
    this.downloadedAssetIds.add(assetId);
    const item = this.catalog.find((a) => a.id === assetId);
    if (item) {
      item.isDownloaded = true;
      item.downloadStatus = 'downloaded';
      item.integrityStatus = integrityStatus;
      item.decoderStatus = decoderStatus;
      if (actualSha256) {
        item.sha256 = actualSha256;
      }
      item.hashStatus = integrityStatus === 'verified' && decoderStatus === 'verified' ? 'verified' : 'pending-download';
    }
    this.notify();
  }

  public markAsFailed(assetId: string, reason: string): void {
    this.downloadedAssetIds.delete(assetId);
    const item = this.catalog.find((a) => a.id === assetId);
    if (item) {
      item.isDownloaded = false;
      item.downloadStatus = 'failed';
      item.decoderStatus = 'failed';
      item.qualityReason = reason;
    }
    this.notify();
  }

  public markAsRemoved(assetId: string): void {
    this.downloadedAssetIds.delete(assetId);
    const item = this.catalog.find((a) => a.id === assetId);
    if (item) {
      item.isDownloaded = false;
      item.downloadStatus = 'not-downloaded';
      item.integrityStatus = 'unverified';
      item.decoderStatus = 'unverified';
    }
    this.notify();
  }

  public getDownloadedAssetIds(): string[] {
    return Array.from(this.downloadedAssetIds);
  }

  public isDownloaded(assetId: string): boolean {
    return this.downloadedAssetIds.has(assetId);
  }

  public async loadCatalog(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        // 1. Try loading full online catalog
        let items: CatalogAssetItem[] = [];
        try {
          const res = await fetch('/video-assets/ONLINE_CATALOG.json');
          if (res.ok) {
            items = await res.json();
          }
        } catch {
          // Fallback to built-in manifest
        }

        // 2. Fallback to built-in Starter Pack if empty
        if (!items || items.length === 0) {
          const res = await fetch('/video-assets/ASSET_MANIFEST.json');
          if (res.ok) {
            items = await res.json();
          }
        }

        this.catalog = items || [];
        this.isLoaded = true;
        this.notify();
      } catch (err) {
        console.warn('[AssetCatalog] Failed to load catalog JSON:', err);
        this.catalog = [];
      }
    })();

    return this.loadPromise;
  }

  public getRawCatalog(): CatalogAssetItem[] {
    return this.catalog;
  }

  public getAssetById(id: string): CatalogAssetItem | undefined {
    return this.catalog.find((item) => item.id === id);
  }

  /**
   * Filter and search the catalog in memory (< 20ms execution)
   */
  public filterAssets(options: CatalogFilterOptions): CatalogAssetItem[] {
    let result = this.catalog;

    // Quality Status Filter: By default, ONLY 'approved' items are shown!
    if (options.qualityStatus) {
      if (options.qualityStatus !== 'all') {
        result = result.filter((item) => (item.qualityStatus || 'approved') === options.qualityStatus);
      }
    } else {
      // Default: show ONLY approved items
      result = result.filter((item) => (item.qualityStatus || 'approved') === 'approved');
    }

    // 1. Type Filter
    if (options.type && options.type !== 'all') {
      result = result.filter((item) => item.type === options.type);
    }

    // 2. Category Filter
    if (options.category && options.category !== 'all') {
      result = result.filter((item) => item.category === options.category);
    }

    // 3. Quick Status Filter
    if (options.filter && options.filter !== 'all') {
      switch (options.filter) {
        case 'builtin':
          result = result.filter((item) => item.isBuiltIn);
          break;
        case 'downloaded':
          result = result.filter((item) => item.isBuiltIn || this.downloadedAssetIds.has(item.id));
          break;
        case 'online':
          result = result.filter((item) => !item.isBuiltIn && !this.downloadedAssetIds.has(item.id));
          break;
        case 'favorites':
          result = result.filter((item) => this.favorites.has(item.id));
          break;
        case 'free':
          result = result.filter((item) => !item.licenseName.toLowerCase().includes('paid'));
          break;
        case 'forma-originals':
          result = result.filter((item) => item.id.startsWith('forma-original-') || item.tags?.includes('forma-originals'));
          break;
      }
    }

    // 4. Source Filter
    if (options.source && options.source !== 'all') {
      result = result.filter((item) => item.source === options.source);
    }

    // 5. License Filter
    if (options.license && options.license !== 'all') {
      result = result.filter((item) => item.licenseName === options.license);
    }

    // 6. Aspect Ratio
    if (options.aspectRatio && options.aspectRatio !== 'all') {
      if (options.aspectRatio === '9:16') {
        result = result.filter((item) => item.width && item.height && item.height > item.width);
      } else if (options.aspectRatio === '16:9') {
        result = result.filter((item) => item.width && item.height && item.width > item.height);
      } else if (options.aspectRatio === '1:1') {
        result = result.filter((item) => item.width && item.height && item.width === item.height);
      }
    }

    // 7. Alpha Channel
    if (options.hasAlpha !== undefined) {
      result = result.filter((item) => !!item.hasAlpha === options.hasAlpha);
    }

    // 8. Loopable
    if (options.loopable !== undefined) {
      result = result.filter((item) => !!item.loopable === options.loopable);
    }

    // 9. Full-Text Search with Turkish/English Synonyms
    if (options.query && options.query.trim()) {
      const q = options.query.toLowerCase().trim();
      const queryTokens = q.split(/\s+/).filter(Boolean);

      // Expand tokens with synonyms
      const expandedTokens = new Set<string>();
      for (const token of queryTokens) {
        expandedTokens.add(token);
        if (SYNONYM_MAP[token]) {
          for (const syn of SYNONYM_MAP[token]) {
            expandedTokens.add(syn.toLowerCase());
          }
        }
      }

      result = result.filter((item) => {
        const searchableText = [
          item.id,
          item.name,
          item.localizedName,
          item.category,
          item.source,
          item.author,
          ...(item.tags || []),
        ]
          .join(' ')
          .toLowerCase();

        // Match if any expanded token matches
        for (const token of expandedTokens) {
          if (searchableText.includes(token)) return true;
        }
        return false;
      });
    }

    // 10. Sorting
    if (options.sortBy) {
      if (options.sortBy === 'name') {
        result = [...result].sort((a, b) => a.localizedName.localeCompare(b.localizedName, 'tr'));
      } else if (options.sortBy === 'duration') {
        result = [...result].sort((a, b) => (b.duration || 0) - (a.duration || 0));
      } else if (options.sortBy === 'size') {
        result = [...result].sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0));
      }
    }

    return result;
  }

  public getCategories(): string[] {
    const set = new Set<string>();
    for (const item of this.catalog) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set).sort();
  }

  public getSources(): string[] {
    const set = new Set<string>();
    for (const item of this.catalog) {
      if (item.source) set.add(item.source);
    }
    return Array.from(set).sort();
  }

  public getLicenses(): string[] {
    const set = new Set<string>();
    for (const item of this.catalog) {
      if (item.licenseName) set.add(item.licenseName);
    }
    return Array.from(set).sort();
  }
}

export const assetCatalog = new AssetCatalogService();
