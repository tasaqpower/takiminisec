import React, { useState } from 'react';
import { VideoProject, VideoClip } from '../../types';
import { saveAssetBlob } from '../../db';
import { useEditorDragDrop } from '../../context/DragDropContext';
import { Shapes, Search, GripVertical, Sparkles, Check } from 'lucide-react';
import {
  ELEMENT_PRESETS,
  ElementPreset,
  createSvgDataUrl,
} from '../../data/elementPresets';

async function createSvgAssetBlob(svgString: string): Promise<Blob> {
  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
}

interface ElementsTabProps {
  project: VideoProject;
  currentTime: number;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  onAddTrack?: (type: 'video' | 'audio' | 'text' | 'subtitle', name?: string) => any;
  findTrack: (type: 'video' | 'audio' | 'text' | 'subtitle') => string;
  getNextClipStartTime: (trackId: string) => number;
}

type CategoryType =
  | 'all'
  | 'animated'
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'stickers'
  | 'arrows'
  | 'censor';

const CATEGORIES: { id: CategoryType; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'animated', label: '⚡ Canlı Animasyon' },
  { id: 'tiktok', label: '🎵 TikTok & Reels' },
  { id: 'youtube', label: '▶️ YouTube' },
  { id: 'instagram', label: '📷 Instagram' },
  { id: 'stickers', label: '🔥 Çıkartmalar' },
  { id: 'arrows', label: '🎯 Oklar & Vurgu' },
  { id: 'censor', label: '🛑 Sansür & Gizlilik' },
];

export const ElementsTab: React.FC<ElementsTabProps> = ({
  project,
  currentTime,
  onAddClip,
  onAddTrack,
  findTrack,
  getNextClipStartTime,
}) => {
  const { startDrag, isClickSuppressed } = useEditorDragDrop();
  const [category, setCategory] = useState<CategoryType>('all');
  const [search, setSearch] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const filteredElements = ELEMENT_PRESETS.filter((item) => {
    if (category === 'all') return true;
    if (category === 'animated') return Boolean(item.isAnimated || item.category === 'animated');
    return item.category === category;
  }).filter(
    (item) =>
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddElement = async (preset: ElementPreset) => {
    try {
      if (!preset.svg) return;
      const dataUrl = createSvgDataUrl(preset.svg);
      const assetId = `element-${preset.id}-${Date.now()}`;

      // Persist to IndexedDB for offline safety
      try {
        const blob = await createSvgAssetBlob(preset.svg);
        await saveAssetBlob(assetId, blob);
      } catch (_) {}

      // Prioritize overlay video track (secondary video track) if exists
      let overlayTrack = project.tracks.find(
        (t) => t.type === 'video' && t.id !== project.tracks[0]?.id
      );
      let targetTrackId = overlayTrack?.id;

      // If no secondary overlay track exists and user has clips on main video track, create an overlay track
      if (!targetTrackId && project.tracks[0]?.clips?.length && onAddTrack) {
        const newTrack = onAddTrack('video', 'Öğeler & Çıkartmalar');
        if (newTrack?.id) {
          targetTrackId = newTrack.id;
        }
      }

      if (!targetTrackId) {
        targetTrackId = overlayTrack?.id || findTrack('video') || project.tracks[0]?.id;
      }

      const startTime = currentTime > 0 ? currentTime : getNextClipStartTime(targetTrackId);
      const isAnim = Boolean(preset.isAnimated || preset.category === 'animated');
      const duration = isAnim ? 4.0 : 3.0;

      onAddClip(targetTrackId, {
        assetId,
        elementPresetId: preset.id,
        svgContent: preset.svg,
        name: preset.name,
        type: 'image',
        sourceUrl: dataUrl,
        startTime,
        duration,
        sourceDuration: duration,
        isAnimated: isAnim,
        elementAnimation: preset.elementAnimation,
        fitMode: 'fit',
        transform: {
          x: 0,
          y: 0,
          scaleX: preset.defaultScale ?? 0.35,
          scaleY: preset.defaultScale ?? 0.35,
          rotation: 0,
          opacity: 1,
        },
      });

      setStatusBanner(`"${preset.name}" katmanı videoya eklendi!`);
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err) {
      console.error('Öğe eklenemedi:', err);
    }
  };

  return (
    <div className="space-y-3 p-3 text-xs bg-[#111419]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shapes className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span className="font-semibold text-[#E7EAF0]">Grafik & Çıkartmalar</span>
        </div>
        <span className="text-[10px] text-[#929AA8] font-mono bg-[#171B21] px-2 py-0.5 rounded-[2px] border border-[#292F39]">
          {filteredElements.length} / {ELEMENT_PRESETS.length} Öğe
        </span>
      </div>

      {statusBanner && (
        <div className="p-2 rounded-[3px] bg-[#171B21] border border-[#4f6bf5]/40 text-[#93c5fd] text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
          <Sparkles className="w-3.5 h-3.5 text-[#4f6bf5] shrink-0" />
          <span className="truncate">{statusBanner}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#929AA8] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="TikTok, YouTube, Instagram veya çıkartma ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] placeholder-[#5A6270] text-xs outline-none focus:border-[#4f6bf5] transition-colors"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`px-2.5 py-1 rounded-[2px] text-[11px] font-medium whitespace-nowrap transition-colors ${
              category === c.id
                ? 'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]'
                : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid of Elements */}
      <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 custom-scrollbar">
        {filteredElements.map((elem) => (
          <div
            key={elem.id}
            data-element-item={elem.id}
            onPointerDown={(e) => {
              if (e.button === 0) {
                const dataUrl = elem.svg ? createSvgDataUrl(elem.svg) : undefined;
                const svgBlob = elem.svg ? new Blob([elem.svg], { type: 'image/svg+xml;charset=utf-8' }) : undefined;
                const isAnim = Boolean(elem.isAnimated || elem.category === 'animated');
                const duration = isAnim ? 4.0 : 3.0;
                startDrag(
                  {
                    type: 'image',
                    id: elem.id,
                    name: elem.name,
                    icon: 'Shapes',
                    duration,
                    category: elem.category,
                    data: {
                      ...elem,
                      sourceUrl: dataUrl,
                      svgContent: elem.svg,
                      elementPresetId: elem.id,
                      defaultScale: elem.defaultScale ?? 0.35,
                      blob: svgBlob,
                      isAnimated: isAnim,
                      elementAnimation: elem.elementAnimation,
                    },
                  },
                  e.clientX,
                  e.clientY
                );
              }
            }}
            onClick={() => {
              if (isClickSuppressed()) return;
              handleAddElement(elem);
            }}
            className="group relative flex flex-col justify-between p-2 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] transition-all cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] uppercase tracking-tight flex items-center gap-1 ${
                elem.isAnimated || elem.category === 'animated'
                  ? 'text-[#25f4ee] font-bold'
                  : 'font-medium text-[#929AA8]'
              }`}>
                {elem.isAnimated || elem.category === 'animated' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#fe2c55] animate-pulse" />
                    <span>CANLI</span>
                  </>
                ) : (
                  elem.category
                )}
              </span>
              <GripVertical className="w-3.5 h-3.5 text-[#5A6270] group-hover:text-[#929AA8] transition-colors" />
            </div>

            <div className="h-14 rounded-[2px] bg-[#0E1014] border border-[#292F39] flex items-center justify-center p-1.5 overflow-hidden my-1">
              {elem.svg && (
                <div
                  className="w-full h-full flex items-center justify-center pointer-events-none [&>svg]:max-h-full [&>svg]:w-auto"
                  dangerouslySetInnerHTML={{ __html: elem.svg }}
                />
              )}
            </div>

            <p className="text-[11px] font-medium text-[#E7EAF0] group-hover:text-white truncate">
              {elem.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
