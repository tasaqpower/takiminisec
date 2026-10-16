import React, { useState, useMemo, useEffect } from 'react';
import { VideoProject, VideoClip, TextAnimationSegment, TimelineTransition, TextLayerData } from '../../types';
import { assetCatalog, CatalogAssetItem } from '../../engine/assetCatalog';
import { TEXT_ANIMATION_DEFINITIONS } from '../../engine/textRasterizer';
import { useEditorDragDrop } from '../../context/DragDropContext';
import { loadGoogleFont } from '../../engine/fontCatalog';
import {
  createTitleClipTextData,
  TitleAssetPreview,
  FontAssetPreview,
} from './TypographyAssetPreviews';
import {
  Type,
  Plus,
  Search,
  GripVertical,
  Sparkles,
  FileText,
  Heart,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export interface TextTabProps {
  project: VideoProject;
  currentTime: number;
  selectedClipId?: string | null;
  onAddTextClip: (text?: string, styleData?: any) => void;
  onAddClip?: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  findTrack?: (type: 'video' | 'audio' | 'text' | 'subtitle') => string;
  getNextClipStartTime?: (trackId: string) => number;
  onUpdateClip?: (clipId: string, updates: Partial<VideoClip>) => void;
  onPreviewAnimation?: (target: string | number, duration?: number) => void;
  onAddTextAnimationSegment?: (clipId: string, segment: Omit<TextAnimationSegment, 'id'>) => TextAnimationSegment;
}

export const TextTab: React.FC<TextTabProps> = ({
  project,
  currentTime,
  selectedClipId,
  onAddTextClip,
  onAddClip,
  findTrack,
  getNextClipStartTime,
  onUpdateClip,
  onPreviewAnimation,
  onAddTextAnimationSegment,
}) => {
  const { startDrag, isClickSuppressed } = useEditorDragDrop();

  // Active top subtab: 'titles' | 'fonts' | 'animations' | 'quick'
  const [activeSubTab, setActiveSubTab] = useState<'titles' | 'fonts' | 'animations' | 'quick'>('titles');
  const [search, setSearch] = useState<string>('');
  const [titleCategory, setTitleCategory] = useState<string>('all');
  const [fontCategory, setFontCategory] = useState<string>('all');
  const [animCategory, setAnimCategory] = useState<'all' | 'in' | 'loop' | 'out' | 'kinetic'>('all');
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    assetCatalog.loadCatalog().then(() => setCatalogVersion((v) => v + 1));
    const unsub = assetCatalog.subscribe(() => setCatalogVersion((v) => v + 1));
    return () => unsub();
  }, []);

  const showBanner = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 3000);
  };

  // 1. All Title Assets (Başlık Şablonları - 240 items + MOGRTs)
  const titleAssets = useMemo(() => {
    const raw = assetCatalog.getRawCatalog().filter(
      (a) =>
        a.category === 'Başlık Şablonları' ||
        a.category === 'Metin ve Başlık Şablonları' ||
        (a.type === 'title' && a.category !== 'Metin Animasyonları')
    );

    return raw.filter((a) => {
      if (titleCategory !== 'all') {
        const style = a.style || (a.metadata as any)?.style || '';
        if (titleCategory === 'lower-third' && style !== 'lower-third' && style !== 'lowerthird') return false;
        if (titleCategory === 'cinematic' && style !== 'cinematic') return false;
        if (titleCategory === 'social' && style !== 'social') return false;
        if (titleCategory === 'promo' && style !== 'promo') return false;
        if (titleCategory === 'news' && style !== 'news') return false;
        if (titleCategory === 'minimal' && style !== 'minimal') return false;
        if (titleCategory === 'subtitle' && style !== 'subtitle') return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.localizedName.toLowerCase().includes(q) ||
        (a.defaultText && a.defaultText.toLowerCase().includes(q)) ||
        (a.tags && a.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [titleCategory, search, catalogVersion]);

  // 2. All Font Assets (Türkçe Uyumlu Fontlar - 160 items)
  const fontAssets = useMemo(() => {
    const raw = assetCatalog.getRawCatalog().filter(
      (a) => a.type === 'font' || a.category === 'Türkçe Uyumlu Fontlar'
    );

    return raw.filter((a) => {
      if (fontCategory !== 'all' && a.fontCategory !== fontCategory) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const family = (a.fontFamily || a.name).toLowerCase();
      return family.includes(q) || a.name.toLowerCase().includes(q);
    });
  }, [fontCategory, search, catalogVersion]);

  // 3. All Text Animation Assets
  const animAssets = useMemo(() => {
    const raw = assetCatalog.getRawCatalog().filter(
      (a) => a.category === 'Metin Animasyonları' || a.tags?.includes('text-animation')
    );

    return raw.filter((a) => {
      if (animCategory !== 'all') {
        if (animCategory === 'kinetic') {
          if (!a.id.startsWith('anim-kinetic-') && !a.name.toLowerCase().includes('kinetik')) return false;
        } else {
          const kind = (a.metadata as any)?.animKind || 'in';
          if (kind !== animCategory) return false;
        }
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.localizedName.toLowerCase().includes(q);
    });
  }, [animCategory, search, catalogVersion]);

  // Helper: Add title asset to timeline
  const handleAddTitleToTimeline = (asset: CatalogAssetItem) => {
    let trackId = findTrack ? findTrack('text') : '';
    if (!trackId) {
      trackId = project.tracks.find((t) => t.type === 'text')?.id || project.tracks[0]?.id || '';
    }
    const startTime = getNextClipStartTime ? getNextClipStartTime(trackId) : currentTime;
    const textData = createTitleClipTextData(asset);

    if (textData.fontFamily) {
      loadGoogleFont(textData.fontFamily).catch(() => {});
    }

    if (onAddClip) {
      onAddClip(trackId, {
        assetId: asset.id,
        name: asset.localizedName,
        type: 'text',
        startTime,
        duration: asset.duration || 4.0,
        sourceDuration: asset.duration || 4.0,
        transform: {
          x: (asset.metadata as any)?.transform?.x ?? 0,
          y: (asset.metadata as any)?.transform?.y ?? ((asset.style === 'lower-third' || asset.style === 'lowerthird') ? 320 : 0),
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        textData: textData as TextLayerData,
      });
      showBanner(`"${asset.localizedName}" zaman çizelgesine eklendi!`);
    } else {
      onAddTextClip(textData.text, textData);
    }
  };

  // Helper: Apply or Add Font
  const handleApplyFont = (asset: CatalogAssetItem) => {
    const family = (asset.fontFamily || asset.name.replace(/\s+Font$/i, '')).trim();
    loadGoogleFont(family).catch(() => {});

    const targetTextClip =
      (selectedClipId && project.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId && c.type === 'text')) ||
      project.tracks.flatMap((t) => t.clips).find((c) => c.type === 'text' && currentTime >= c.startTime && currentTime <= c.startTime + c.duration);

    if (targetTextClip && onUpdateClip) {
      onUpdateClip(targetTextClip.id, {
        textData: {
          ...(targetTextClip.textData || { text: 'Metin', fontSize: 54, fontWeight: 'bold', color: '#ffffff' }),
          fontFamily: family,
        },
      });
      showBanner(`Seçili metnin fontu "${family}" olarak güncellendi!`);
    } else {
      // Add new text clip with this font
      let trackId = findTrack ? findTrack('text') : '';
      if (!trackId) {
        trackId = project.tracks.find((t) => t.type === 'text')?.id || project.tracks[0]?.id || '';
      }
      const startTime = getNextClipStartTime ? getNextClipStartTime(trackId) : currentTime;
      if (onAddClip) {
        onAddClip(trackId, {
          name: `${family} Başlık`,
          type: 'text',
          startTime,
          duration: 4.0,
          sourceDuration: 4.0,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          textData: {
            text: `${family} Başlık`,
            fontSize: 54,
            fontWeight: 'bold',
            color: '#ffffff',
            fillColor: '#ffffff',
            fontFamily: family,
            textAlign: 'center',
            alignment: 'center',
          },
        });
        showBanner(`"${family}" fontuyla yeni metin katmanı eklendi!`);
      } else {
        onAddTextClip(`${family} Başlık`);
      }
    }
  };

  // Helper: Apply or Add Animation
  const handleApplyAnimation = (asset: CatalogAssetItem) => {
    const targetTextClip =
      (selectedClipId && project.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId && c.type === 'text')) ||
      project.tracks.flatMap((t) => t.clips).find((c) => c.type === 'text' && currentTime >= c.startTime && currentTime <= c.startTime + c.duration);

    const animKind = (asset.metadata as any)?.animKind || 'in';
    const technicalId = (asset.metadata as any)?.technicalId || asset.id.replace(/^forma-original-textanim-\d+-/, '').replace(/^anim-/, '');

    if (targetTextClip && onUpdateClip) {
      const updates: any = {};
      if (animKind === 'in' || technicalId.startsWith('in-') || technicalId === 'typewriter') {
        updates.inAnimation = technicalId.replace(/^in-/, '');
        updates.inDuration = asset.duration || 0.8;
      } else if (animKind === 'loop' || technicalId.startsWith('loop-')) {
        updates.loopAnimation = technicalId.replace(/^loop-/, '');
      } else if (animKind === 'out' || technicalId.startsWith('out-')) {
        updates.outAnimation = technicalId.replace(/^out-/, '');
        updates.outDuration = asset.duration || 0.6;
      }

      onUpdateClip(targetTextClip.id, {
        textData: {
          ...(targetTextClip.textData || { text: 'Metin', fontSize: 54, fontWeight: 'bold', color: '#ffffff' }),
          ...updates,
        },
      });
      showBanner(`"${asset.localizedName}" animasyonu seçili metne eklendi!`);
    } else {
      handleAddTitleToTimeline(asset);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111419] text-xs select-none">
      {/* 1. TOP HEADER & PRIMARY ACTION */}
      <div className="p-2.5 border-b border-[#292F39] bg-[#0E1014] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Type className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-[#E7EAF0]">Metin & Başlık Kütüphanesi</span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono bg-[#161a22] px-2 py-0.5 rounded border border-[#232936]">
            {activeSubTab === 'titles'
              ? `${titleAssets.length} Başlık`
              : activeSubTab === 'fonts'
              ? `${fontAssets.length} Font`
              : activeSubTab === 'animations'
              ? `${animAssets.length} Animasyon`
              : 'Hızlı Ekle'}
          </span>
        </div>

        {/* Primary Add Button */}
        <button
          type="button"
          onClick={() => onAddTextClip()}
          className="w-full py-2 px-3 rounded-[3px] bg-[#4f6bf5] hover:bg-[#3d57d6] text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Yeni Metin Katmanı Ekle</span>
        </button>

        {/* 4 Main Subtabs: Başlıklar, Fontlar, Animasyonlar, Hızlı */}
        <div className="flex rounded-[3px] bg-[#0A0D12] p-0.5 border border-[#292F39]">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('titles');
              setSearch('');
            }}
            className={`flex-1 py-1 rounded-[2px] text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors ${
              activeSubTab === 'titles'
                ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
                : 'text-[#929AA8] hover:text-[#E7EAF0]'
            }`}
          >
            <Type className="w-3 h-3 text-purple-400" />
            <span>Başlıklar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('fonts');
              setSearch('');
            }}
            className={`flex-1 py-1 rounded-[2px] text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors ${
              activeSubTab === 'fonts'
                ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
                : 'text-[#929AA8] hover:text-[#E7EAF0]'
            }`}
          >
            <FileText className="w-3 h-3 text-teal-400" />
            <span>Fontlar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('animations');
              setSearch('');
            }}
            className={`flex-1 py-1 rounded-[2px] text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors ${
              activeSubTab === 'animations'
                ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
                : 'text-[#929AA8] hover:text-[#E7EAF0]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Animasyon</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('quick');
              setSearch('');
            }}
            className={`flex-1 py-1 rounded-[2px] text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors ${
              activeSubTab === 'quick'
                ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
                : 'text-[#929AA8] hover:text-[#E7EAF0]'
            }`}
          >
            <Layers className="w-3 h-3 text-sky-400" />
            <span>Hızlı</span>
          </button>
        </div>

        {/* Search Input */}
        {activeSubTab !== 'quick' && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5A6270] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeSubTab === 'titles'
                  ? '240 başlık ara (alt bant, sinematik, viral, indirim, haber)...'
                  : activeSubTab === 'fonts'
                  ? '160 Google Fontu ara (Montserrat, Oswald, Playfair, Roboto)...'
                  : 'Animasyon ara (zoom, slide, pop, typewriter, kinetik)...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] placeholder-[#5A6270] text-xs outline-none focus:border-[#4f6bf5] transition-colors"
            />
          </div>
        )}

        {/* Secondary Category Pills for Titles */}
        {activeSubTab === 'titles' && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'all', label: 'Tümü (240)' },
              { id: 'lower-third', label: 'Alt Bantlar (41)' },
              { id: 'cinematic', label: 'Sinematik (41)' },
              { id: 'social', label: 'Sosyal & Viral (52)' },
              { id: 'promo', label: 'Promo & İndirim (31)' },
              { id: 'news', label: 'Haber & Bülten (25)' },
              { id: 'minimal', label: 'Minimal (25)' },
              { id: 'subtitle', label: 'Altyazılar (25)' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setTitleCategory(c.id)}
                className={`px-2 py-0.5 rounded-[2px] text-[10px] font-medium whitespace-nowrap transition-colors ${
                  titleCategory === c.id
                    ? 'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]'
                    : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Secondary Category Pills for Fonts */}
        {activeSubTab === 'fonts' && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'all', label: 'Tümü (160)' },
              { id: 'Sans Serif', label: 'Sans Serif' },
              { id: 'Serif', label: 'Serif' },
              { id: 'Display', label: 'Display' },
              { id: 'Monospace', label: 'Monospace' },
              { id: 'Handwriting', label: 'El Yazısı' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFontCategory(f.id)}
                className={`px-2 py-0.5 rounded-[2px] text-[10px] font-medium whitespace-nowrap transition-colors ${
                  fontCategory === f.id
                    ? 'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]'
                    : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Secondary Category Pills for Animations */}
        {activeSubTab === 'animations' && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'all', label: 'Tümü (170)' },
              { id: 'in', label: 'Giriş (In)' },
              { id: 'loop', label: 'Döngü (Loop)' },
              { id: 'out', label: 'Çıkış (Out)' },
              { id: 'kinetic', label: 'Kinetik Tipografi (25)' },
            ].map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAnimCategory(a.id as any)}
                className={`px-2 py-0.5 rounded-[2px] text-[10px] font-medium whitespace-nowrap transition-colors ${
                  animCategory === a.id
                    ? 'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]'
                    : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {statusBanner && (
          <div className="p-1.5 rounded-[3px] bg-[#171B21] border border-[#4f6bf5]/40 text-[#93c5fd] text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
            <Sparkles className="w-3.5 h-3.5 text-[#4f6bf5] shrink-0" />
            <span className="truncate">{statusBanner}</span>
          </div>
        )}
      </div>

      {/* 2. MAIN SCROLLABLE CONTENT AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5">
        {/* SUBTAB 1: BAŞLIK ŞABLONLARI (240 ÖĞE) */}
        {activeSubTab === 'titles' && (
          <div className="grid grid-cols-2 gap-2">
            {titleAssets.map((asset) => {
              const textData = createTitleClipTextData(asset);
              return (
                <div
                  key={asset.id}
                  data-asset-card={asset.id}
                  onPointerDown={(e) => {
                    if (e.button === 0) {
                      startDrag(
                        {
                          type: 'title-template',
                          id: asset.id,
                          name: asset.localizedName,
                          duration: asset.duration || 4.0,
                          category: asset.category,
                          data: {
                            ...asset,
                            textData,
                          },
                        },
                        e.clientX,
                        e.clientY
                      );
                    }
                  }}
                  className="bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] rounded-[3px] p-1.5 flex flex-col justify-between transition-all group select-none cursor-grab active:cursor-grabbing relative"
                >
                  {/* Top Bar: Icon & Name */}
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <Type className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="font-medium text-[#E7EAF0] text-[11px] truncate group-hover:text-white" title={asset.localizedName}>
                        {asset.localizedName}
                      </span>
                    </div>
                  </div>

                  {/* Live Visual Title Card Preview */}
                  <TitleAssetPreview asset={asset} />

                  {/* Bottom Action Bar: Ekle button & Grip */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#232936] mt-1">
                    <span className="text-[8.5px] text-gray-400 font-mono">
                      {asset.duration ? `${asset.duration.toFixed(1)}s` : '4.0s'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isClickSuppressed()) return;
                          handleAddTitleToTimeline(asset);
                        }}
                        className="px-2 py-0.5 rounded-[2px] bg-[#202631] hover:bg-[#4f6bf5] text-[#E7EAF0] hover:text-white text-[9.5px] font-medium border border-[#292F39] hover:border-[#4f6bf5] transition-colors flex items-center gap-0.5"
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
        )}

        {/* SUBTAB 2: FONTLAR (160 ÖĞE) */}
        {activeSubTab === 'fonts' && (
          <div className="grid grid-cols-2 gap-2">
            {fontAssets.map((asset) => {
              const family = (asset.fontFamily || asset.name.replace(/\s+Font$/i, '')).trim();
              const textData = createTitleClipTextData(asset);
              return (
                <div
                  key={asset.id}
                  data-asset-card={asset.id}
                  onPointerDown={(e) => {
                    if (e.button === 0) {
                      startDrag(
                        {
                          type: 'font',
                          id: asset.id,
                          name: asset.localizedName,
                          duration: 4.0,
                          category: asset.category,
                          data: {
                            ...asset,
                            fontFamily: family,
                            textData,
                          },
                        },
                        e.clientX,
                        e.clientY
                      );
                    }
                  }}
                  onClick={() => {
                    if (isClickSuppressed()) return;
                    handleApplyFont(asset);
                  }}
                  className="bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] rounded-[3px] p-1.5 flex flex-col justify-between transition-all group select-none cursor-grab active:cursor-grabbing relative"
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <FileText className="w-3 h-3 text-teal-400 shrink-0" />
                      <span className="font-medium text-[#E7EAF0] text-[11px] truncate group-hover:text-white">
                        {family}
                      </span>
                    </div>
                  </div>

                  <FontAssetPreview asset={asset} />

                  <div className="flex items-center justify-between pt-1 border-t border-[#232936] mt-1">
                    <span className="text-[8px] text-gray-400 truncate max-w-[70px]">
                      {asset.fontCategory || 'Font'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isClickSuppressed()) return;
                          handleApplyFont(asset);
                        }}
                        className="px-1.5 py-0.5 rounded-[2px] bg-[#202631] hover:bg-[#0d9488] text-[#E7EAF0] hover:text-white text-[9px] font-medium border border-[#292F39] hover:border-[#0d9488] transition-colors flex items-center gap-0.5"
                        title="Seçiliye Uygula veya Ekle"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Seç</span>
                      </button>
                      <GripVertical className="w-3 h-3 text-[#5A6270] group-hover:text-[#929AA8]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SUBTAB 3: METİN ANİMASYONLARI (170 ÖĞE) */}
        {activeSubTab === 'animations' && (
          <div className="grid grid-cols-2 gap-2">
            {animAssets.map((asset) => {
              const textData = createTitleClipTextData(asset);
              return (
                <div
                  key={asset.id}
                  data-asset-card={asset.id}
                  onPointerDown={(e) => {
                    if (e.button === 0) {
                      startDrag(
                        {
                          type: 'text-animation',
                          id: asset.id,
                          name: asset.localizedName,
                          duration: asset.duration || 1.5,
                          category: (asset.metadata as any)?.animKind || 'in',
                          data: {
                            ...asset,
                            textData,
                          },
                        },
                        e.clientX,
                        e.clientY
                      );
                    }
                  }}
                  onClick={() => {
                    if (isClickSuppressed()) return;
                    handleApplyAnimation(asset);
                  }}
                  className="bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] rounded-[3px] p-1.5 flex flex-col justify-between transition-all group select-none cursor-grab active:cursor-grabbing relative"
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="font-medium text-[#E7EAF0] text-[11px] truncate group-hover:text-white">
                        {asset.localizedName}
                      </span>
                    </div>
                  </div>

                  <TitleAssetPreview asset={asset} />

                  <div className="flex items-center justify-between pt-1 border-t border-[#232936] mt-1">
                    <span className="text-[8.5px] text-gray-400 font-mono">
                      {asset.duration ? `${asset.duration.toFixed(1)}s` : '1.5s'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isClickSuppressed()) return;
                          handleApplyAnimation(asset);
                        }}
                        className="px-1.5 py-0.5 rounded-[2px] bg-[#202631] hover:bg-[#f59e0b] text-[#E7EAF0] hover:text-white text-[9px] font-medium border border-[#292F39] hover:border-[#f59e0b] transition-colors flex items-center gap-0.5"
                        title="Metne Uygula veya Ekle"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Uygula</span>
                      </button>
                      <GripVertical className="w-3 h-3 text-[#5A6270] group-hover:text-[#929AA8]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SUBTAB 4: HIZLI METİN EKLEME */}
        {activeSubTab === 'quick' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Büyük Başlık (Heading)', size: 64, weight: 'bold', desc: '64px kalın ana başlık' },
                { name: 'Alt Başlık (Subheading)', size: 44, weight: '600', desc: '44px yarı kalın alt başlık' },
                { name: 'Paragraf / Gövde (Body)', size: 32, weight: 'normal', desc: '32px standart metin' },
                { name: 'Vurgu / Callout', size: 40, weight: 'bold', desc: '40px dikkat çekici vurgu' },
                { name: 'Altyazı (Subtitle)', size: 28, weight: '500', desc: '28px altyazı stili' },
                { name: 'Rozet / Etiket (Badge)', size: 24, weight: 'bold', desc: '24px etiket rozeti' },
              ].map((item) => (
                <div
                  key={item.name}
                  onClick={() => {
                    onAddTextClip(item.name, {
                      fontSize: item.size,
                      fontWeight: item.weight,
                    });
                    showBanner(`"${item.name}" metin katmanı eklendi!`);
                  }}
                  className="p-2.5 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#4f6bf5] transition-all cursor-pointer select-none group"
                >
                  <p className="font-semibold text-[#E7EAF0] text-xs group-hover:text-white truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
