import React, { useState } from 'react';
import { VideoProject, VideoClip, TextAnimationSegment } from '../../types';
import { TEXT_STYLE_PRESETS, TEXT_ANIMATION_DEFINITIONS } from '../../engine/textRasterizer';
import { useEditorDragDrop } from '../../context/DragDropContext';
import { Type, Plus, Search, GripVertical, Sparkles, Play } from 'lucide-react';

interface TextTabProps {
  project: VideoProject;
  currentTime: number;
  selectedClipId?: string | null;
  onAddTextClip: (text?: string) => void;
  onPreviewAnimation?: (target: string | number, duration?: number) => void;
  onAddTextAnimationSegment?: (clipId: string, segment: Omit<TextAnimationSegment, 'id'>) => TextAnimationSegment;
}

export const TextTab: React.FC<TextTabProps> = ({
  project,
  currentTime,
  selectedClipId,
  onAddTextClip,
  onPreviewAnimation,
  onAddTextAnimationSegment,
}) => {
  const { startDrag, isClickSuppressed } = useEditorDragDrop();
  const [subTab, setSubTab] = useState<'styles' | 'animations'>('styles');
  const [animType, setAnimType] = useState<'in' | 'loop' | 'out'>('in');
  const [search, setSearch] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const filteredStyles = TEXT_STYLE_PRESETS.filter(
    (style) =>
      !search.trim() ||
      style.name.toLowerCase().includes(search.toLowerCase()) ||
      style.id.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAnimations = TEXT_ANIMATION_DEFINITIONS.filter(
    (anim) => anim.type === animType
  ).filter(
    (anim) =>
      !search.trim() ||
      anim.name.toLowerCase().includes(search.toLowerCase()) ||
      anim.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3 p-3 text-xs bg-[#111419]">
      {/* Quick Add Button */}
      <button
        type="button"
        onClick={() => onAddTextClip()}
        className="w-full py-2 px-3 rounded-[3px] bg-[#4f6bf5] hover:bg-[#3d57d6] text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Yeni Metin Katmanı Ekle</span>
      </button>

      {/* Subtab Switcher */}
      <div className="flex rounded-[3px] bg-[#0E1014] p-0.5 border border-[#292F39]">
        <button
          type="button"
          onClick={() => setSubTab('styles')}
          className={`flex-1 py-1 rounded-[2px] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
            subTab === 'styles'
              ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
              : 'text-[#929AA8] hover:text-[#E7EAF0]'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Metin Şablonları</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('animations')}
          className={`flex-1 py-1 rounded-[2px] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
            subTab === 'animations'
              ? 'bg-[#202631] text-[#E7EAF0] shadow-sm'
              : 'text-[#929AA8] hover:text-[#E7EAF0]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Metin Animasyonları</span>
        </button>
      </div>

      {statusBanner && (
        <div className="p-2 rounded-[3px] bg-[#171B21] border border-[#4f6bf5]/40 text-[#93c5fd] text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
          <Sparkles className="w-3.5 h-3.5 text-[#4f6bf5] shrink-0" />
          <span className="truncate">{statusBanner}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#929AA8] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Metin şablonu veya animasyon ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] placeholder-[#5A6270] text-xs outline-none focus:border-[#4f6bf5] transition-colors"
        />
      </div>

      {/* Animation Type Switcher */}
      {subTab === 'animations' && (
        <div className="flex items-center gap-1">
          {[
            { id: 'in', label: 'Giriş' },
            { id: 'loop', label: 'Döngü' },
            { id: 'out', label: 'Çıkış' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setAnimType(t.id as any)}
              className={`flex-1 py-1 rounded-[2px] text-[11px] font-medium transition-colors ${
                animType === t.id
                  ? 'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]'
                  : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-310px)] overflow-y-auto pr-1 custom-scrollbar">
        {subTab === 'styles' &&
          filteredStyles.map((style) => (
            <div
              key={style.id}
              data-text-style={style.id}
              onPointerDown={(e) => {
                if (e.button === 0) {
                  startDrag(
                    {
                      type: 'title-template',
                      id: style.id,
                      name: style.name,
                      icon: 'Type',
                      duration: 3,
                      category: 'text',
                      data: style,
                    },
                    e.clientX,
                    e.clientY
                  );
                }
              }}
              onClick={() => {
                if (isClickSuppressed()) return;
                onAddTextClip(style.name);
                setStatusBanner(`"${style.name}" metin katmanı eklendi!`);
                setTimeout(() => setStatusBanner(null), 3000);
              }}
              className="group relative flex flex-col justify-between p-2 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] transition-all cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-6 h-6 rounded-[2px] bg-[#0E1014] flex items-center justify-center border border-[#292F39]">
                  <Type className="w-3 h-3 text-[#c084fc]" />
                </div>
                <GripVertical className="w-3.5 h-3.5 text-[#5A6270] group-hover:text-[#929AA8] transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#E7EAF0] group-hover:text-white truncate">
                  {style.name}
                </p>
                <p className="text-[10px] text-[#929AA8] truncate mt-0.5">
                  {style.description || 'Hazır Stil'}
                </p>
              </div>
            </div>
          ))}

        {subTab === 'animations' &&
          filteredAnimations.map((anim) => (
            <div
              key={anim.id}
              data-text-animation={anim.id}
              onPointerDown={(e) => {
                if (e.button === 0) {
                  startDrag(
                    {
                      type: 'text-animation',
                      id: anim.id,
                      name: anim.name,
                      icon: 'Sparkles',
                      duration: anim.defaultDuration || 1.5,
                      category: anim.type,
                      data: anim,
                    },
                    e.clientX,
                    e.clientY
                  );
                }
              }}
              onClick={() => {
                if (isClickSuppressed()) return;
                if (selectedClipId && onAddTextAnimationSegment) {
                  onAddTextAnimationSegment(selectedClipId, {
                    type: anim.type,
                    animationName: anim.id,
                    startTime: 0,
                    duration: anim.defaultDuration || 1.5,
                  });
                  setStatusBanner(`"${anim.name}" animasyonu seçili metne eklendi!`);
                  setTimeout(() => setStatusBanner(null), 3000);
                } else if (onPreviewAnimation) {
                  onPreviewAnimation(currentTime, anim.defaultDuration || 1.5);
                }
              }}
              className="group relative flex flex-col justify-between p-2 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] transition-all cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-6 h-6 rounded-[2px] bg-[#0E1014] flex items-center justify-center border border-[#292F39]">
                  <Sparkles className="w-3 h-3 text-[#c084fc]" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-[#929AA8]">
                    {(anim.defaultDuration || 1.5).toFixed(1)}s
                  </span>
                  <GripVertical className="w-3.5 h-3.5 text-[#5A6270] group-hover:text-[#929AA8] transition-colors" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#E7EAF0] group-hover:text-white truncate">
                  {anim.name}
                </p>
                <p className="text-[10px] text-[#929AA8] truncate mt-0.5">
                  {anim.description || anim.type}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
