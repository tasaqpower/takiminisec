import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { VideoProject, VideoClip } from '../../types';
import { assetCatalog, CatalogAssetItem, CatalogFilterOptions } from '../../engine/assetCatalog';
import { assetDownloader } from '../../engine/assetDownloader';
import { useEditorDragDrop } from '../../context/DragDropContext';
import {
  Search,
  Download,
  CheckCircle2,
  Heart,
  Play,
  Pause,
  Plus,
  Layers,
  Sparkles,
  Package,
  HardDrive,
  Scale,
  GripVertical,
  SlidersHorizontal,
  ChevronDown,
  Info,
  Type,
  Music,
  Video,
  Shapes,
  Palette,
  Shuffle,
  FileText,
  Globe,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { AssetPacksModal } from './AssetPacksModal';
import { StorageManagementModal } from './StorageManagementModal';
import { AssetLicenseModal } from './AssetLicenseModal';

interface AssetsTabProps {
  project: VideoProject;
  currentTime: number;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  findTrack: (type: 'video' | 'audio' | 'text' | 'subtitle') => string;
  getNextClipStartTime: (trackId: string) => number;
  selectedClipId?: string | null;
  onUpdateClip?: (clipId: string, updates: Partial<VideoClip>) => void;
}

export const AssetsTab: React.FC<AssetsTabProps> = ({
  project,
  currentTime,
  onAddClip,
  findTrack,
  getNextClipStartTime,
  selectedClipId,
  onUpdateClip,
}) => {
  const { startDrag } = useEditorDragDrop();

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'free' | 'builtin' | 'downloaded' | 'online' | 'favorites'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [aspectRatio, setAspectRatio] = useState<'all' | '16:9' | '9:16' | '1:1'>('all');
  const [catalogVersion, setCatalogVersion] = useState(0);

  // Modals state
  const [isPacksModalOpen, setIsPacksModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [selectedAssetForDetails, setSelectedAssetForDetails] = useState<CatalogAssetItem | null>(null);

  // Audio preview state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Virtualization state
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Load catalog on mount
  useEffect(() => {
    assetCatalog.loadCatalog().then(() => {
      setCatalogVersion((v) => v + 1);
    });

    const unsubscribeCatalog = assetCatalog.subscribe(() => {
      setCatalogVersion((v) => v + 1);
    });

    const unsubscribeDownloader = assetDownloader.subscribe(() => {
      setCatalogVersion((v) => v + 1);
    });

    return () => {
      unsubscribeCatalog();
      unsubscribeDownloader();
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
    };
  }, []);

  // Reset scroll position to top when search or filters change so virtualized rows remain visible
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    setScrollTop(0);
  }, [search, selectedCategory, statusFilter, selectedType, aspectRatio]);

  // Filter items in memory (< 20ms)
  const filteredAssets = useMemo(() => {
    return assetCatalog.filterAssets({
      query: search,
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      type: selectedType === 'all' ? undefined : (selectedType as any),
      filter: statusFilter,
      aspectRatio,
    });
  }, [search, selectedCategory, statusFilter, selectedType, aspectRatio, catalogVersion]);

  // Audio preview handler
  const handleToggleAudio = useCallback((asset: CatalogAssetItem) => {
    if (playingAudioId === asset.id) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPlayingAudioId(null);
    } else {
      if (!audioPreviewRef.current) {
        audioPreviewRef.current = new Audio();
        audioPreviewRef.current.onended = () => setPlayingAudioId(null);
      }
      audioPreviewRef.current.src = asset.previewUrl;
      audioPreviewRef.current.play().catch((e) => console.warn('Preview error:', e));
      setPlayingAudioId(asset.id);
    }
  }, [playingAudioId]);

  // Add Asset to Timeline
  const handleAddToTimeline = useCallback(
    async (asset: CatalogAssetItem) => {
      if (asset.type === 'lut') {
        // Apply LUT color filter to active or selected video clip
        const targetClip =
          (selectedClipId && project.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId && c.type === 'video')) ||
          project.tracks.flatMap((t) => t.clips).find((c) => c.type === 'video');

        if (targetClip && onUpdateClip) {
          onUpdateClip(targetClip.id, { colorFilter: asset.id });
          return;
        }
      }

      let targetTrackType: 'video' | 'audio' | 'text' = 'video';
      let clipType: 'video' | 'audio' | 'text' | 'image' = 'video';

      if (asset.type === 'audio') {
        targetTrackType = 'audio';
        clipType = 'audio';
      } else if (asset.type === 'title' || asset.type === 'font') {
        targetTrackType = 'text';
        clipType = 'text';
      } else if (asset.type === 'overlay' || asset.type === 'element') {
        targetTrackType = 'video';
        clipType = 'image';
      } else {
        targetTrackType = 'video';
        clipType = 'video';
      }

      let trackId = findTrack(targetTrackType);
      if (!trackId) {
        trackId = project.tracks.find((t) => t.type === targetTrackType)?.id || project.tracks[0]?.id || '';
      }
      const startTime = getNextClipStartTime(trackId);

      // Resolve source URL
      let sourceUrl = asset.downloadUrl || asset.filePath || '';
      if (!sourceUrl || sourceUrl.startsWith('virtual:') || !sourceUrl.startsWith('/')) {
        if (asset.id.startsWith('broll-')) {
          sourceUrl = `/video-assets/broll/${asset.id}.webm`;
        } else if (asset.id.startsWith('overlay-')) {
          const name = asset.id.replace('overlay-', '');
          sourceUrl = `/video-assets/overlays/${name}.svg`;
        } else if (asset.id.startsWith('element-')) {
          const name = asset.id.replace('element-', '');
          sourceUrl = `/video-assets/elements/${name}.svg`;
        } else if (asset.id.startsWith('music-')) {
          const name = asset.id.replace('music-', '');
          sourceUrl = `/video-assets/audio/music/${name}.wav`;
        } else if (asset.id.startsWith('sfx-')) {
          const name = asset.id.replace('sfx-', '');
          sourceUrl = `/video-assets/audio/sfx/${name}.wav`;
        }
      }

      // On-demand download fallback if still empty
      if (!sourceUrl && !asset.isBuiltIn) {
        const blob = await assetDownloader.downloadAsset(asset);
        if (blob) {
          sourceUrl = URL.createObjectURL(blob);
        }
      }

      onAddClip(trackId, {
        assetId: asset.id,
        name: asset.localizedName,
        type: clipType,
        sourceUrl,
        startTime,
        duration: asset.duration || (clipType === 'image' ? 10.0 : 4.0),
        sourceDuration: asset.duration || (clipType === 'image' ? 10.0 : 4.0),
        textData:
          asset.type === 'title'
            ? {
                text: asset.defaultText || asset.localizedName || 'Forma Başlık',
                fontSize: 54,
                fontWeight: 'bold',
                color: '#ffffff',
                fontFamily: 'Plus Jakarta Sans',
              }
            : undefined,
      });
    },
    [findTrack, getNextClipStartTime, onAddClip, project.tracks, selectedClipId, onUpdateClip]
  );

  // Virtualized calculations
  const ITEM_HEIGHT = 104; // Height of each card row (2 columns = 2 items per row)
  const COLS = 2;
  const totalRows = Math.ceil(filteredAssets.length / COLS);
  const visibleRowCount = 12;
  const startRow = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 3);
  const endRow = Math.min(totalRows, startRow + visibleRowCount + 6);
  const visibleAssets = filteredAssets.slice(startRow * COLS, endRow * COLS);

  const categories = useMemo(() => {
    return [
      { id: 'all', label: 'Tümü' },
      { id: 'Ses Efektleri', label: 'Ses Efektleri', icon: Music },
      { id: 'Müzik ve Ambiyans', label: 'Müzik', icon: Music },
      { id: 'Arka Plan Videoları', label: 'B-Roll & Video', icon: Video },
      { id: 'Video Katmanları', label: 'Overlays', icon: Layers },
      { id: 'Başlık Şablonları', label: 'Başlıklar', icon: Type },
      { id: 'LUT & Renk', label: 'LUT / Renk', icon: Palette },
      { id: 'Şekiller ve Grafikler', label: 'Grafikler', icon: Shapes },
      { id: 'Türkçe Uyumlu Fontlar', label: 'Fontlar', icon: FileText },
      { id: 'Geçiş Efektleri', label: 'Geçişler', icon: Shuffle },
    ];
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#111419] text-xs select-none">
      {/* 1. TOP HEADER & ACTION BUTTONS */}
      <div className="p-2.5 border-b border-[#292F39] bg-[#0E1014] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-[#E7EAF0]">Asset Kütüphanesi</span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono bg-[#161a22] px-2 py-0.5 rounded border border-[#232936]">
            {filteredAssets.length} / {assetCatalog.getRawCatalog().length} Öğe
          </span>
        </div>

        {/* Action Buttons: Paketler, Depolama, Lisanslar */}
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            data-testid="open-packs-modal"
            onClick={() => setIsPacksModalOpen(true)}
            className="flex items-center justify-center gap-1 py-1 rounded-[2px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] text-[#CBD5E1] text-[10px] font-medium transition-colors"
          >
            <Package className="w-3 h-3 text-emerald-400" />
            <span>Paketler</span>
          </button>
          <button
            type="button"
            data-testid="open-storage-modal"
            onClick={() => setIsStorageModalOpen(true)}
            className="flex items-center justify-center gap-1 py-1 rounded-[2px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] text-[#CBD5E1] text-[10px] font-medium transition-colors"
          >
            <HardDrive className="w-3 h-3 text-amber-400" />
            <span>Depolama</span>
          </button>
          <button
            type="button"
            data-testid="open-license-modal"
            onClick={() => setIsLicenseModalOpen(true)}
            className="flex items-center justify-center gap-1 py-1 rounded-[2px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] text-[#CBD5E1] text-[10px] font-medium transition-colors"
          >
            <Scale className="w-3 h-3 text-sky-400" />
            <span>Lisanslar</span>
          </button>
        </div>

        {/* Search Bar with Instant Debounce */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#5A6270] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Türkçe veya İngilizce asset ara (örn: yağmur, rain, drone, bass)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] placeholder-[#5A6270] text-xs outline-none focus:border-[#4f6bf5] transition-colors"
          />
        </div>

        {/* Category Horizontal Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`px-2 py-0.5 rounded-[2px] text-[10px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                selectedCategory === c.id
                  ? 'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]'
                  : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
              }`}
            >
              {c.icon && <c.icon className="w-2.5 h-2.5" />}
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Secondary Filter Chips */}
        <div className="flex items-center justify-between text-[10px] pt-0.5">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'downloaded', label: 'İndirilenler' },
              { id: 'builtin', label: 'Yerleşik' },
              { id: 'online', label: 'Çevrim İçi' },
              { id: 'favorites', label: 'Favoriler' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-1.5 py-0.5 rounded-[2px] transition-colors ${
                  statusFilter === f.id
                    ? 'text-indigo-400 font-semibold underline'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Aspect Ratio Selector */}
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as any)}
            className="bg-[#171B21] border border-[#292F39] text-[#94A3B8] rounded px-1.5 py-0.5 text-[9px] outline-none"
          >
            <option value="all">Oran: Tümü</option>
            <option value="16:9">16:9 Yatay</option>
            <option value="9:16">9:16 Dikey</option>
            <option value="1:1">1:1 Kare</option>
          </select>
        </div>
      </div>

      {/* 2. VIRTUALIZED ASSET GRID */}
      <div
        ref={containerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="flex-1 overflow-y-auto custom-scrollbar p-2 relative"
      >
        <div style={{ height: `${totalRows * ITEM_HEIGHT}px`, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${startRow * ITEM_HEIGHT}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
            className="grid grid-cols-2 gap-2"
          >
            {visibleAssets.map((asset) => {
              const isBuiltIn = asset.isBuiltIn || asset.downloadUrl.startsWith('/video-assets/') || asset.downloadUrl.startsWith('virtual:');
              const isDownloading = assetDownloader.isDownloading(asset.id);
              const dlProgress = assetDownloader.getProgress(asset.id);
              const isDownloaded = isBuiltIn || assetCatalog.isDownloaded(asset.id);
              const isFailed = asset.downloadStatus === 'failed' || dlProgress?.status === 'error';
              const isDecodeFailed = asset.decoderStatus === 'failed';
              const isLicenseReview = !asset.licenseId || asset.licenseName?.toLowerCase().includes('review');
              const isFav = assetCatalog.isFavorite(asset.id);
              const isPlaying = playingAudioId === asset.id;

              // Explicit status badge demanded by user
              let statusBadge = {
                label: 'Çevrim içi',
                badgeClass: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                icon: <Globe className="w-2.5 h-2.5 shrink-0" />
              };

              if (isBuiltIn) {
                statusBadge = {
                  label: 'Yerleşik ve doğrulanmış',
                  badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  icon: <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                };
              } else if (isDownloading) {
                statusBadge = {
                  label: `İndiriliyor (${dlProgress?.percent || 0}%)`,
                  badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                  icon: <Loader2 className="w-2.5 h-2.5 shrink-0 animate-spin" />
                };
              } else if (isDecodeFailed) {
                statusBadge = {
                  label: 'Decode başarısız',
                  badgeClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                  icon: <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                };
              } else if (isFailed) {
                statusBadge = {
                  label: 'İndirme başarısız',
                  badgeClass: 'text-red-400 bg-red-500/10 border-red-500/20',
                  icon: <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                };
              } else if (isLicenseReview) {
                statusBadge = {
                  label: 'Lisans incelemesi gerekli',
                  badgeClass: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
                  icon: <ShieldAlert className="w-2.5 h-2.5 shrink-0" />
                };
              } else if (isDownloaded) {
                statusBadge = {
                  label: 'İndirildi ve doğrulandı',
                  badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  icon: <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                };
              }

              return (
                <div
                  key={asset.id}
                  data-asset-card={asset.id}
                  onPointerDown={(e) => {
                    if (e.button === 0) {
                      let dragType: any = 'video';
                      if (asset.type === 'video') dragType = 'video';
                      else if (asset.type === 'audio') dragType = 'audio';
                      else if (asset.type === 'title') dragType = 'title-template';
                      else if (asset.type === 'overlay') dragType = 'overlay';
                      else if (asset.type === 'element') dragType = 'image';
                      else if (asset.type === 'lut') dragType = 'filter-preset';

                      startDrag(
                        {
                          type: dragType,
                          id: asset.id,
                          name: asset.localizedName,
                          duration: asset.duration || 4.0,
                          category: asset.category,
                          data: {
                            ...asset,
                            colorFilter: asset.id,
                          },
                        },
                        e.clientX,
                        e.clientY
                      );
                    }
                  }}
                  className="bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] rounded-[3px] p-1.5 flex flex-col justify-between transition-all group select-none cursor-grab active:cursor-grabbing relative"
                >
                  {/* Top Bar: Icon, Name, Favorite Button */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      {asset.type === 'audio' && <Music className="w-3 h-3 text-emerald-400 shrink-0" />}
                      {asset.type === 'video' && <Video className="w-3 h-3 text-sky-400 shrink-0" />}
                      {asset.type === 'overlay' && <Layers className="w-3 h-3 text-indigo-400 shrink-0" />}
                      {asset.type === 'element' && <Shapes className="w-3 h-3 text-amber-400 shrink-0" />}
                      {asset.type === 'lut' && <Palette className="w-3 h-3 text-pink-400 shrink-0" />}
                      {asset.type === 'title' && <Type className="w-3 h-3 text-purple-400 shrink-0" />}
                      {asset.type === 'font' && <FileText className="w-3 h-3 text-teal-400 shrink-0" />}
                      {asset.type === 'transition' && <Shuffle className="w-3 h-3 text-orange-400 shrink-0" />}
                      <span className="font-medium text-[#E7EAF0] text-[11px] truncate group-hover:text-white" title={asset.localizedName}>
                        {asset.localizedName}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        assetCatalog.toggleFavorite(asset.id);
                      }}
                      className="text-[#5A6270] hover:text-red-400 p-0.5 transition-colors"
                      title={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                    >
                      <Heart className={`w-3 h-3 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                    </button>
                  </div>

                  {/* Status Badge Tag */}
                  <div className={`flex items-center gap-1 text-[8.5px] px-1.5 py-0.5 rounded border my-1 w-fit ${statusBadge.badgeClass}`}>
                    {statusBadge.icon}
                    <span className="font-medium truncate">{statusBadge.label}</span>
                  </div>

                  {/* Middle: Badges & Tags */}
                  <div className="flex items-center gap-1.5 text-[9px] text-[#828B9B] my-0.5">
                    {asset.duration ? <span>{asset.duration.toFixed(1)}s</span> : null}
                    <span>•</span>
                    <span className="truncate">{asset.source ? asset.source.split(' ')[0] : 'Forma'}</span>
                    <span>•</span>
                    <span className="truncate">{asset.licenseId || asset.licenseName?.split(' ')[0] || 'CC0'}</span>
                  </div>

                  {/* Bottom: Action Buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#232936]">
                    <div className="flex items-center gap-1">
                      {/* Audio Play/Pause Button */}
                      {asset.type === 'audio' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAudio(asset);
                          }}
                          className="w-5 h-5 rounded-[2px] bg-[#0E1014] hover:bg-[#12241b] text-[#86efac] flex items-center justify-center transition-colors border border-[#292F39]"
                          title={isPlaying ? 'Durdur' : 'Dinle'}
                        >
                          {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5 ml-0.5" />}
                        </button>
                      )}

                      {/* Download Status Badge / Action */}
                      {isDownloaded ? (
                        <span className="flex items-center gap-0.5 text-[9px] text-emerald-400" title="İndirildi & Hazır">
                          <CheckCircle2 className="w-3 h-3" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await assetDownloader.downloadAsset(asset);
                          }}
                          className="text-[#828B9B] hover:text-white p-0.5"
                          title="İndir"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      )}

                      {/* Details Info Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAssetForDetails(asset);
                        }}
                        className="text-[#5A6270] hover:text-[#94A3B8] p-0.5"
                        title="Detaylar & Lisans"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Add to Timeline Button */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToTimeline(asset);
                        }}
                        className="px-1.5 py-0.5 rounded-[2px] bg-[#202631] hover:bg-[#4f6bf5] text-[#E7EAF0] hover:text-white text-[9px] font-medium border border-[#292F39] hover:border-[#4f6bf5] transition-colors flex items-center gap-0.5"
                        title="Timeline'a Ekle"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Ekle</span>
                      </button>
                      <GripVertical className="w-3 h-3 text-[#5A6270] group-hover:text-[#929AA8]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. MODALS */}
      {isPacksModalOpen && <AssetPacksModal isOpen={isPacksModalOpen} onClose={() => setIsPacksModalOpen(false)} />}
      {isStorageModalOpen && (
        <StorageManagementModal
          isOpen={isStorageModalOpen}
          project={project}
          onClose={() => setIsStorageModalOpen(false)}
        />
      )}
      {isLicenseModalOpen && <AssetLicenseModal isOpen={isLicenseModalOpen} onClose={() => setIsLicenseModalOpen(false)} />}

      {/* 4. ASSET DETAILS POPOVER */}
      {selectedAssetForDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedAssetForDetails(null)}
        >
          <div
            className="bg-[#111419] border border-[#292F39] rounded-[4px] p-4 max-w-md w-full shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#292F39] pb-2">
              <span className="font-semibold text-white text-sm">{selectedAssetForDetails.localizedName}</span>
              <button
                type="button"
                onClick={() => setSelectedAssetForDetails(null)}
                className="text-[#94A3B8] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-[#94A3B8]">
              <p>
                <strong className="text-white">Tür:</strong> {selectedAssetForDetails.type.toUpperCase()}
              </p>
              <p>
                <strong className="text-white">Kategori:</strong> {selectedAssetForDetails.category}
              </p>
              <p>
                <strong className="text-white">Kaynak:</strong> {selectedAssetForDetails.source}
              </p>
              <p>
                <strong className="text-white">Eser Sahibi:</strong> {selectedAssetForDetails.author}
              </p>
              <p>
                <strong className="text-white">Lisans:</strong>{' '}
                <a
                  href={selectedAssetForDetails.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 underline"
                >
                  {selectedAssetForDetails.licenseName}
                </a>
              </p>
              <p>
                <strong className="text-white">SHA-256:</strong>{' '}
                <span className="font-mono text-[10px] break-all text-[#64748B]">{selectedAssetForDetails.sha256}</span>
              </p>
              {selectedAssetForDetails.attributionText && (
                <div className="p-2 rounded bg-[#0E1014] border border-[#292F39] text-[11px] text-[#CBD5E1]">
                  <strong>Zorunlu Atıf Metni:</strong>
                  <p>{selectedAssetForDetails.attributionText}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#292F39]">
              <button
                type="button"
                onClick={() => setSelectedAssetForDetails(null)}
                className="px-3 py-1 rounded bg-[#202631] text-white hover:bg-[#2e3747] text-xs font-medium"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
