import React, { useState } from 'react';
import { VideoProject, ClipEffects, EffectSegment } from '../../types';
import { COLOR_PRESETS, VISUAL_EFFECT_DEFINITIONS } from '../../engine/filterEngine';
import { useEditorDragDrop } from '../../context/DragDropContext';
import { Wand2, Palette, Search, GripVertical, Sparkles } from 'lucide-react';

interface EffectsTabProps {
  project: VideoProject;
  currentTime: number;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string | null) => void;
  onUpdateClipEffects?: (clipId: string, effects: Partial<ClipEffects>) => void;
  onAddEffectSegment?: (segment: Omit<EffectSegment, 'id' | 'createdAt'>) => EffectSegment;
}

export const EffectsTab: React.FC<EffectsTabProps> = ({
  project,
  currentTime,
  selectedClipId,
  onSelectClip,
  onUpdateClipEffects,
  onAddEffectSegment,
}) => {
  const { startDrag, isClickSuppressed } = useEditorDragDrop();
  const [subTab, setSubTab] = useState<'effects' | 'presets'>('effects');
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const filteredEffects = VISUAL_EFFECT_DEFINITIONS.filter(
    (eff) => category === 'all' || eff.category === category
  ).filter(
    (eff) =>
      !search.trim() ||
      eff.name.toLowerCase().includes(search.toLowerCase()) ||
      eff.description.toLowerCase().includes(search.toLowerCase()) ||
      eff.id.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPresets = COLOR_PRESETS.filter(
    (preset) =>
      !search.trim() ||
      preset.name.toLowerCase().includes(search.toLowerCase()) ||
      preset.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3 p-3 text-xs bg-[#111419]">
      {/* Subtab Switcher */}
      <div className="flex rounded-[3px] bg-[#0E1014] p-0.5 border border-[#292F39]">
        <button
          type="button"
          onClick={() => {
            setSubTab('effects');
            setCategory('all');
          }}
          className={`flex-1 py-1 rounded-[2px] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
            subTab === 'effects'
              ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
              : 'text-[#929AA8] hover:text-[#E7EAF0]'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Görsel Efektler</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('presets')}
          className={`flex-1 py-1 rounded-[2px] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
            subTab === 'presets'
              ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
              : 'text-[#929AA8] hover:text-[#E7EAF0]'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Renk Filtreleri</span>
        </button>
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
          placeholder={subTab === 'effects' ? 'Efekt ara...' : 'Filtre ara...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] placeholder-[#5A6270] text-xs outline-none focus:border-[#4f6bf5] transition-colors"
        />
      </div>

      {/* Category Pills for Effects */}
      {subTab === 'effects' && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: 'all', label: 'Tümü' },
            { id: 'light', label: 'Işık & Parıltı' },
            { id: 'glitch', label: 'Glitch & Siber' },
            { id: 'blur', label: 'Bulanıklık' },
            { id: 'motion', label: 'Hareket' },
            { id: 'retro', label: 'Retro & VHS' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-2.5 py-1 rounded-[2px] text-[11px] font-medium whitespace-nowrap transition-colors ${
                category === cat.id
                  ? 'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]'
                  : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid of Cards */}
      <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 custom-scrollbar">
        {subTab === 'effects' &&
          filteredEffects.map((eff) => (
            <div
              key={eff.id}
              data-effect-card={eff.id}
              onPointerDown={(e) => {
                if (e.button === 0) {
                  startDrag(
                    {
                      type: 'video-effect',
                      id: eff.id,
                      name: eff.name,
                      icon: 'Wand2',
                      duration: eff.defaultDuration || 3.0,
                      category: eff.category,
                      data: eff,
                    },
                    e.clientX,
                    e.clientY
                  );
                }
              }}
              onClick={() => {
                if (isClickSuppressed()) return;
                if (onAddEffectSegment) {
                  onAddEffectSegment({
                    effectId: eff.id,
                    effectKind: (eff.category as any) || 'filter',
                    name: eff.name,
                    startTime: currentTime,
                    duration: eff.defaultDuration || 3.0,
                    enabled: true,
                    parameters: { intensity: eff.defaultIntensity ?? 1.0 },
                  });
                  setStatusBanner(`"${eff.name}" zaman çizelgesine eklendi!`);
                  setTimeout(() => setStatusBanner(null), 3000);
                }
              }}
              className="group relative flex flex-col justify-between p-2 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] transition-all cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-6 h-6 rounded-[2px] bg-[#0E1014] flex items-center justify-center border border-[#292F39]">
                  <Wand2 className="w-3 h-3 text-[#4f6bf5]" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-[#929AA8]">
                    {(eff.defaultDuration || 3.0).toFixed(1)}s
                  </span>
                  <GripVertical className="w-3.5 h-3.5 text-[#5A6270] group-hover:text-[#929AA8] transition-colors" />
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#E7EAF0] group-hover:text-white truncate">
                  {eff.name}
                </p>
                <p className="text-[10px] text-[#929AA8] truncate mt-0.5">
                  {eff.description || eff.category}
                </p>
              </div>
            </div>
          ))}

        {subTab === 'presets' &&
          filteredPresets.map((preset) => (
            <div
              key={preset.id}
              data-filter-preset={preset.id}
              onPointerDown={(e) => {
                if (e.button === 0) {
                  startDrag(
                    {
                      type: 'filter-preset',
                      id: preset.id,
                      name: preset.name,
                      icon: 'Palette',
                      duration: 3,
                      category: 'filter',
                      data: preset,
                    },
                    e.clientX,
                    e.clientY
                  );
                }
              }}
              onClick={() => {
                if (isClickSuppressed()) return;
                const allClips = project.tracks.flatMap((t) => t.clips);
                const targetClip =
                  (selectedClipId && allClips.find((c) => c.id === selectedClipId)) ||
                  allClips.find((c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration) ||
                  allClips[0];

                if (!targetClip) {
                  setStatusBanner('Lütfen filtre uygulamak için bir klip seçin.');
                  setTimeout(() => setStatusBanner(null), 3000);
                  return;
                }

                if (onUpdateClipEffects) {
                  onUpdateClipEffects(targetClip.id, {
                    ...preset.effects,
                  });
                  setStatusBanner(`"${preset.name}" filtresi seçili klibe uygulandı!`);
                  setTimeout(() => setStatusBanner(null), 3000);
                }
              }}
              className="group relative flex flex-col justify-between p-2 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] transition-all cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-6 h-6 rounded-[2px] bg-[#0E1014] flex items-center justify-center border border-[#292F39]">
                  <Palette className="w-3 h-3 text-[#38bdf8]" />
                </div>
                <GripVertical className="w-3.5 h-3.5 text-[#5A6270] group-hover:text-[#929AA8] transition-colors" />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#E7EAF0] group-hover:text-white truncate">
                  {preset.name}
                </p>
                <p className="text-[10px] text-[#929AA8] truncate mt-0.5">
                  Renk Filtresi
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
