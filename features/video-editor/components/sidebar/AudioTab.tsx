import React, { useState } from 'react';
import { VideoProject, VideoClip } from '../../types';
import { BUILTIN_SFX_LIST, playSfxPreview, generateSfxBlob, SfxType } from '../../engine/sfxGenerator';
import { saveAssetBlob } from '../../db';
import { useEditorDragDrop } from '../../context/DragDropContext';
import { Music, Play, Volume2, Plus, Search, GripVertical, Sparkles } from 'lucide-react';

interface AudioTabProps {
  project: VideoProject;
  currentTime: number;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  findTrack: (type: 'video' | 'audio' | 'text' | 'subtitle') => string;
  getNextClipStartTime: (trackId: string) => number;
}

export const AudioTab: React.FC<AudioTabProps> = ({
  project,
  currentTime,
  onAddClip,
  findTrack,
  getNextClipStartTime,
}) => {
  const { startDrag, isClickSuppressed } = useEditorDragDrop();
  const [category, setCategory] = useState<'all' | 'sfx' | 'bgm'>('all');
  const [search, setSearch] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const filteredSfx = BUILTIN_SFX_LIST.filter(
    (item) => category === 'all' || item.category === category
  ).filter(
    (item) =>
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddSfx = async (sfxItem: typeof BUILTIN_SFX_LIST[0]) => {
    setAddingId(sfxItem.id);
    try {
      const blob = await generateSfxBlob(sfxItem.id as SfxType);
      const assetId = 'sfx-' + sfxItem.id + '-' + Date.now();
      await saveAssetBlob(assetId, blob);

      const objectUrl = URL.createObjectURL(blob);
      const targetTrackId = findTrack('audio');
      const startTime = getNextClipStartTime(targetTrackId);

      onAddClip(targetTrackId, {
        assetId,
        name: sfxItem.name,
        type: 'audio',
        sourceUrl: objectUrl,
        startTime,
        duration: sfxItem.duration,
        sourceDuration: sfxItem.duration,
        volume: 1,
      });

      setStatusBanner(`"${sfxItem.name}" ses kanalına eklendi!`);
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err) {
      console.error('SFX eklenemedi:', err);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-3 p-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Music className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-gray-200">Ses Efektleri & BGM</span>
        </div>
        <span className="text-[10px] text-gray-400 font-mono bg-[#161a22] px-2 py-0.5 rounded border border-[#232936]">
          {filteredSfx.length} Parça
        </span>
      </div>

      {statusBanner && (
        <div className="p-2 rounded-md bg-[#161f2e] border border-indigo-500/40 text-indigo-300 text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">{statusBanner}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Ses efekti veya müzik ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] placeholder-[#5A6270] text-xs outline-none focus:border-[#4f6bf5] transition-colors"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1">
        {[
          { id: 'all', label: 'Tümü' },
          { id: 'sfx', label: 'Ses Efektleri' },
          { id: 'bgm', label: 'Fon Müziği' },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id as any)}
            className={`flex-1 py-1 rounded-[2px] text-[11px] font-medium transition-colors ${
              category === c.id
                ? 'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]'
                : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* SFX List */}
      <div className="space-y-1.5 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 custom-scrollbar">
        {filteredSfx.map((item) => (
          <div
            key={item.id}
            data-audio-item={item.id}
            onPointerDown={(e) => {
              if (e.button === 0) {
                startDrag(
                  {
                    type: 'audio',
                    id: item.id,
                    name: item.name,
                    icon: 'Music',
                    duration: item.duration,
                    category: item.category,
                    data: item,
                  },
                  e.clientX,
                  e.clientY
                );
              }
            }}
            className="flex items-center justify-between p-1.5 rounded-[3px] bg-[#171B21] hover:bg-[#202631] border border-[#292F39] hover:border-[#3B4351] transition-all group cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playSfxPreview(item.id as SfxType);
                }}
                className="w-6 h-6 rounded-[2px] bg-[#0E1014] hover:bg-[#12241b] text-[#86efac] flex items-center justify-center transition-colors border border-[#292F39]"
                title="Önizlemeyi Dinle"
              >
                <Play className="w-3 h-3 ml-0.5" />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#E7EAF0] group-hover:text-white truncate">
                  {item.name}
                </p>
                <p className="text-[10px] text-[#929AA8] font-mono">
                  {item.duration.toFixed(1)}s • {item.category === 'bgm' ? 'Müzik' : 'SFX'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={addingId === item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddSfx(item);
                }}
                className="px-2 py-0.5 rounded-[2px] bg-[#202631] hover:bg-[#4f6bf5] text-[#E7EAF0] hover:text-white text-[10px] font-medium border border-[#292F39] hover:border-[#4f6bf5] transition-colors"
                title="Kanalına Ekle"
              >
                {addingId === item.id ? '...' : '+ Ekle'}
              </button>
              <GripVertical className="w-3.5 h-3.5 text-[#5A6270] group-hover:text-[#929AA8] transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
