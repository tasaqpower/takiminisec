import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { VideoProject, VideoClip, TrackType } from '../../types';
import { BUILTIN_SFX_LIST, playSfxPreview, generateSfxBlob, SfxType } from '../../engine/sfxGenerator';
import { assetCatalog, CatalogAssetItem } from '../../engine/assetCatalog';
import { saveAssetBlob } from '../../db';
import { useEditorDragDrop } from '../../context/DragDropContext';
import {
  Music,
  Play,
  Pause,
  Plus,
  Search,
  GripVertical,
  Sparkles,
  Heart,
  Volume2,
  Clock,
  Radio,
  SlidersHorizontal,
  Flame,
  Zap,
  CheckCircle2,
} from 'lucide-react';

export interface AudioTabProps {
  project: VideoProject;
  currentTime: number;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  findTrack: (type: 'video' | 'audio' | 'text' | 'subtitle') => string;
  getNextClipStartTime: (trackId: string) => number;
  onAddTrack?: (type: 'video' | 'audio' | 'text' | 'subtitle', name?: string) => void;
}

export interface UnifiedAudioItem {
  id: string;
  name: string;
  description: string;
  duration: number;
  category: 'sfx' | 'music' | 'loop';
  subCategory?: string;
  isProcedural?: boolean;
  proceduralType?: SfxType;
  sourceUrl?: string;
  author?: string;
  license?: string;
  tags?: string[];
}

export const AudioTab: React.FC<AudioTabProps> = ({
  project,
  currentTime,
  onAddClip,
  findTrack,
  getNextClipStartTime,
  onAddTrack,
}) => {
  const { startDrag, isClickSuppressed } = useEditorDragDrop();

  // Subtabs: 'all' | 'sfx' | 'music' | 'loops' | 'favorites'
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'sfx' | 'music' | 'loops' | 'favorites'>('sfx');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [catalogVersion, setCatalogVersion] = useState(0);

  // Audio preview playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const audioStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('forma_favorite_audio');
      return saved ? JSON.parse(saved) : ['whoosh-fast', 'cinematic-boom', 'calm-piano', 'ui-notification'];
    } catch {
      return ['whoosh-fast', 'cinematic-boom', 'calm-piano', 'ui-notification'];
    }
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('forma_favorite_audio', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Load catalog on mount
  useEffect(() => {
    assetCatalog.loadCatalog().then(() => setCatalogVersion((v) => v + 1));
    const unsub = assetCatalog.subscribe(() => setCatalogVersion((v) => v + 1));
    return () => {
      unsub();
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      if (audioStopTimerRef.current) {
        clearTimeout(audioStopTimerRef.current);
      }
    };
  }, []);

  const showBanner = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 3000);
  };

  // Combine built-in procedural SFX and asset catalog items into unified list
  const allAudioItems = useMemo<UnifiedAudioItem[]>(() => {
    const list: UnifiedAudioItem[] = [];

    // 1. Built-in Procedural SFX & BGM (58 items)
    for (const sfx of BUILTIN_SFX_LIST) {
      list.push({
        id: sfx.id,
        name: sfx.name,
        description: sfx.description || 'Yerleşik Ses Efekti',
        duration: sfx.duration,
        category: sfx.category === 'bgm' ? 'music' : 'sfx',
        subCategory: sfx.category,
        isProcedural: true,
        proceduralType: sfx.id as SfxType,
        sourceUrl: undefined,
        author: 'Forma Audio Engine',
        license: 'CC0-1.0',
        tags: [sfx.category, 'procedural', 'wav', sfx.name.toLowerCase()],
      });
    }

    // 2. Catalog Audio Items (Ses Efektleri, Müzik ve Ambiyans, Müzik Döngüleri)
    const rawCatalog = assetCatalog.getRawCatalog();
    for (const a of rawCatalog) {
      if (
        a.type === 'audio' ||
        a.category === 'Ses Efektleri' ||
        a.category === 'Müzik ve Ambiyans' ||
        a.category === 'Müzik Döngüleri'
      ) {
        let isMusic =
          a.category === 'Müzik ve Ambiyans' ||
          a.category === 'Müzik Döngüleri' ||
          a.tags?.includes('music') ||
          a.tags?.includes('bgm');
        let isLoop = a.category === 'Müzik Döngüleri' || a.loopable;

        let resolvedUrl = a.sourceUrl || a.previewUrl;
        if (a.id.startsWith('forma-original-music-')) {
          resolvedUrl = `/video-assets/audio/music/${a.id}.wav`;
        } else if (a.id.startsWith('music-')) {
          const name = a.id.replace('music-', '');
          resolvedUrl = `/video-assets/audio/music/${name}.wav`;
        } else if (a.id.startsWith('sfx-')) {
          const name = a.id.replace('sfx-', '');
          resolvedUrl = `/video-assets/audio/sfx/${name}.wav`;
        }

        list.push({
          id: a.id,
          name: a.localizedName || a.name,
          description: a.tags?.slice(0, 3).join(', ') || a.category,
          duration: a.duration || (isMusic ? 60.0 : 2.5),
          category: isLoop ? 'loop' : isMusic ? 'music' : 'sfx',
          subCategory: a.category,
          isProcedural: false,
          sourceUrl: resolvedUrl,
          author: a.author || 'Forma',
          license: a.licenseName || 'CC0-1.0',
          tags: a.tags || [],
        });
      }
    }

    return list;
  }, [catalogVersion]);

  // Counts for subtab badges
  const counts = useMemo(() => {
    let sfx = 0;
    let music = 0;
    let loops = 0;
    for (const item of allAudioItems) {
      if (item.category === 'sfx') sfx++;
      else if (item.category === 'music') music++;
      else if (item.category === 'loop') loops++;
    }
    return {
      all: allAudioItems.length,
      sfx,
      music,
      loops,
      favorites: favorites.length,
    };
  }, [allAudioItems, favorites]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    let list = allAudioItems;

    // Subtab filter
    if (activeSubTab === 'sfx') {
      list = list.filter((i) => i.category === 'sfx');
    } else if (activeSubTab === 'music') {
      list = list.filter((i) => i.category === 'music');
    } else if (activeSubTab === 'loops') {
      list = list.filter((i) => i.category === 'loop');
    } else if (activeSubTab === 'favorites') {
      list = list.filter((i) => favorites.includes(i.id));
    }

    // Category pill filter
    if (categoryFilter !== 'all') {
      list = list.filter((item) => {
        if (categoryFilter === 'whoosh') return item.id.includes('whoosh') || item.name.toLowerCase().includes('whoosh') || item.subCategory === 'whoosh';
        if (categoryFilter === 'impact') return item.id.includes('boom') || item.id.includes('hit') || item.id.includes('bass') || item.id.includes('impact') || item.name.toLowerCase().includes('vuruş') || item.name.toLowerCase().includes('darbe');
        if (categoryFilter === 'ui') return item.id.includes('pop') || item.id.includes('bubble') || item.id.includes('click') || item.id.includes('ding') || item.id.includes('chime') || item.name.toLowerCase().includes('bildirim') || item.name.toLowerCase().includes('zil');
        if (categoryFilter === 'mechanical') return item.id.includes('keyboard') || item.id.includes('typewriter') || item.id.includes('shutter') || item.id.includes('switch') || item.name.toLowerCase().includes('mekanik');
        if (categoryFilter === 'meme') return item.id.includes('horn') || item.id.includes('trombone') || item.id.includes('quack') || item.id.includes('dun') || item.name.toLowerCase().includes('viral') || item.name.toLowerCase().includes('meme');
        if (categoryFilter === 'glitch') return item.id.includes('glitch') || item.id.includes('laser') || item.id.includes('radio') || item.name.toLowerCase().includes('glitch');
        if (categoryFilter === 'piano') return item.id.includes('piano') || item.name.toLowerCase().includes('piyano');
        if (categoryFilter === 'cinematic') return item.id.includes('cinematic') || item.id.includes('strings') || item.name.toLowerCase().includes('sinematik');
        if (categoryFilter === 'lofi') return item.id.includes('lofi') || item.name.toLowerCase().includes('lo-fi') || item.name.toLowerCase().includes('chill');
        if (categoryFilter === 'ambient') return item.id.includes('ambient') || item.id.includes('drone') || item.id.includes('nature') || item.name.toLowerCase().includes('ambiyans') || item.name.toLowerCase().includes('doğa');
        if (categoryFilter === 'upbeat') return item.id.includes('upbeat') || item.id.includes('acoustic') || item.name.toLowerCase().includes('neşeli') || item.name.toLowerCase().includes('akustik');
        return true;
      });
    }

    // Search query filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          (i.tags && i.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    return list;
  }, [allAudioItems, activeSubTab, categoryFilter, search, favorites]);

  // Audio Preview Handler
  const handleTogglePlay = useCallback(
    async (item: UnifiedAudioItem) => {
      if (playingAudioId === item.id) {
        if (audioPreviewRef.current) {
          audioPreviewRef.current.pause();
        }
        if (audioStopTimerRef.current) {
          clearTimeout(audioStopTimerRef.current);
          audioStopTimerRef.current = null;
        }
        setPlayingAudioId(null);
        return;
      }

      // Stop previous
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      if (audioStopTimerRef.current) {
        clearTimeout(audioStopTimerRef.current);
        audioStopTimerRef.current = null;
      }

      setPlayingAudioId(item.id);

      // Procedural audio preview
      if (item.isProcedural && item.proceduralType) {
        try {
          playSfxPreview(item.proceduralType);
          audioStopTimerRef.current = setTimeout(() => {
            setPlayingAudioId((cur) => (cur === item.id ? null : cur));
          }, Math.min(item.duration * 1000 + 200, 15000));
        } catch {
          setPlayingAudioId(null);
        }
        return;
      }

      // Catalog / file preview
      if (!audioPreviewRef.current) {
        audioPreviewRef.current = new Audio();
        audioPreviewRef.current.onended = () => setPlayingAudioId(null);
        audioPreviewRef.current.onerror = () => {
          // Fallback to procedural synth if file missing
          setPlayingAudioId(null);
        };
      }

      if (item.sourceUrl) {
        audioPreviewRef.current.src = item.sourceUrl;
        audioPreviewRef.current.currentTime = 0;
        try {
          await audioPreviewRef.current.play();
        } catch (e) {
          // If playback failed, fallback to built-in whoosh or bell
          console.warn('Audio preview error, using fallback:', e);
          playSfxPreview('apple-chime');
          setTimeout(() => setPlayingAudioId(null), 1200);
        }
      } else {
        playSfxPreview('apple-chime');
        setTimeout(() => setPlayingAudioId(null), 1200);
      }
    },
    [playingAudioId]
  );

  // Add Audio to Timeline
  const handleAddToTimeline = async (item: UnifiedAudioItem) => {
    setAddingId(item.id);
    try {
      let targetTrackId = findTrack('audio');
      if (!targetTrackId) {
        if (onAddTrack) {
          onAddTrack('audio', 'Ses Kanalı');
          const updated = project.tracks.find((t) => t.type === 'audio');
          targetTrackId = updated?.id || project.tracks[0]?.id || '';
        } else {
          targetTrackId = project.tracks.find((t) => t.type === 'audio')?.id || project.tracks[0]?.id || '';
        }
      }

      const startTime = currentTime > 0 ? currentTime : getNextClipStartTime(targetTrackId);
      let sourceUrl = item.sourceUrl;
      let finalAssetId = item.id;

      // If procedural, synthesize guaranteed WAV blob
      if (item.isProcedural || !sourceUrl) {
        const pType = item.proceduralType || 'whoosh';
        const blob = await generateSfxBlob(pType as SfxType);
        finalAssetId = 'sfx-blob-' + item.id + '-' + Date.now();
        await saveAssetBlob(finalAssetId, blob);
        sourceUrl = URL.createObjectURL(blob);
      }

      onAddClip(targetTrackId, {
        assetId: finalAssetId,
        name: item.name,
        type: 'audio',
        sourceUrl,
        startTime,
        duration: item.duration,
        sourceDuration: item.duration,
        volume: 0.9,
      });

      showBanner(`"${item.name}" ses kanalına eklendi!`);
    } catch (err) {
      console.error('Ses eklenirken hata oluştu:', err);
      showBanner(`Hata: ${item.name} eklenemedi.`);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111419] text-xs select-none">
      {/* 1. TOP HEADER & METRICS */}
      <div className="p-2.5 border-b border-[#292F39] bg-[#0E1014] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Music className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-[#E7EAF0]">Ses & Müzik Stüdyosu</span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono bg-[#161a22] px-2 py-0.5 rounded border border-[#232936]">
            {filteredItems.length} / {counts.all} Parça
          </span>
        </div>

        {/* Subtabs Switcher */}
        <div className="flex rounded-[3px] bg-[#090B0E] p-0.5 border border-[#232936]">
          {[
            { id: 'sfx', label: `Ses Efektleri (${counts.sfx})` },
            { id: 'music', label: `Müzik (${counts.music})` },
            { id: 'loops', label: `Döngüler (${counts.loops})` },
            { id: 'all', label: `Tümü (${counts.all})` },
            { id: 'favorites', label: `★ (${counts.favorites})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveSubTab(tab.id as any);
                setCategoryFilter('all');
              }}
              className={`flex-1 py-1 rounded-[2px] text-[10px] font-medium transition-colors truncate px-1 text-center ${
                activeSubTab === tab.id
                  ? 'bg-[#202631] text-[#E7EAF0] shadow-sm font-semibold'
                  : 'text-[#929AA8] hover:text-[#E7EAF0]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Banner */}
        {statusBanner && (
          <div className="p-1.5 rounded-[2px] bg-[#161f2e] border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{statusBanner}</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#5A6270] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={
              activeSubTab === 'music'
                ? 'Müzik ara (lo-fi, piyano, sinematik, akustik)...'
                : 'Ses efekti ara (whoosh, bas, bildirim, mekanik)...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] placeholder-[#5A6270] text-xs outline-none focus:border-[#10b981] transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[10px]">
          {activeSubTab === 'music' ? (
            [
              { id: 'all', label: 'Tümü' },
              { id: 'piano', label: '🎹 Sakin Piyano' },
              { id: 'cinematic', label: '🎻 Sinematik' },
              { id: 'lofi', label: '☕ Lo-Fi & Chill' },
              { id: 'acoustic', label: '🎸 Akustik' },
              { id: 'ambient', label: '🌫️ Ambiyans' },
              { id: 'upbeat', label: '🥁 Upbeat' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`px-2 py-0.5 rounded-[2px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                  categoryFilter === c.id
                    ? 'bg-[#202631] text-[#E7EAF0] border border-emerald-500'
                    : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
                }`}
              >
                {c.label}
              </button>
            ))
          ) : (
            [
              { id: 'all', label: 'Tümü' },
              { id: 'whoosh', label: '💨 Whoosh (18)' },
              { id: 'impact', label: '💥 Vuruş & Bas (22)' },
              { id: 'ui', label: '🫧 Pop & Bildirim (28)' },
              { id: 'mechanical', label: '⌨️ Mekanik (14)' },
              { id: 'glitch', label: '⚡ Glitch & Sci-Fi (12)' },
              { id: 'meme', label: '🔥 Viral & Meme (16)' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`px-2 py-0.5 rounded-[2px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                  categoryFilter === c.id
                    ? 'bg-[#202631] text-[#E7EAF0] border border-emerald-500'
                    : 'bg-[#171B21] text-[#929AA8] hover:text-[#E7EAF0] border border-[#292F39]'
                }`}
              >
                {c.label}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. AUDIO ITEM LIST */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-[#5A6270]">
            <Music className="w-8 h-8 mb-2 opacity-40 text-emerald-400" />
            <p className="text-xs font-medium text-gray-400">Aramanıza uygun ses veya müzik bulunamadı</p>
            <p className="text-[10px] mt-1 text-gray-500">Filtreleri temizleyip tekrar deneyin.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isPlaying = playingAudioId === item.id;
            const isFav = favorites.includes(item.id);

            return (
              <div
                key={item.id}
                data-audio-item={item.id}
                onPointerDown={(e) => {
                  if (e.button === 0) {
                    startDrag(
                      {
                        type: 'audio-sfx',
                        id: item.id,
                        name: item.name,
                        icon: 'Music',
                        duration: item.duration,
                        category: item.category,
                        data: {
                          ...item,
                          sourceUrl: item.sourceUrl,
                        },
                      },
                      e.clientX,
                      e.clientY
                    );
                  }
                }}
                className={`flex items-center justify-between p-2 rounded-[3px] border transition-all group cursor-grab active:cursor-grabbing select-none ${
                  isPlaying
                    ? 'bg-[#14231b] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-[#171B21] hover:bg-[#202631] border-[#292F39] hover:border-[#3B4351]'
                }`}
              >
                {/* Left: Play/Pause button + Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePlay(item);
                    }}
                    className={`w-7 h-7 rounded-[3px] flex items-center justify-center transition-all shrink-0 border ${
                      isPlaying
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm animate-pulse'
                        : 'bg-[#0E1014] hover:bg-[#13231a] text-emerald-400 border-[#292F39] hover:border-emerald-500/50'
                    }`}
                    title={isPlaying ? 'Durdur' : 'Önizlemeyi Dinle'}
                  >
                    {isPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-[11px] font-medium truncate ${
                          isPlaying ? 'text-emerald-300 font-semibold' : 'text-[#E7EAF0] group-hover:text-white'
                        }`}
                        title={item.name}
                      >
                        {item.name}
                      </p>
                      {item.isProcedural && (
                        <span className="text-[9px] bg-[#0E1014] text-emerald-400/90 border border-emerald-500/30 px-1 rounded font-mono shrink-0">
                          Synth
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#7E889B] font-mono">
                      <span className="flex items-center gap-0.5 text-[#929AA8]">
                        <Clock size={9} />
                        {item.duration < 60
                          ? `${item.duration.toFixed(1)}s`
                          : `${Math.floor(item.duration / 60)}:${Math.floor(item.duration % 60).toString().padStart(2, '0')}`}
                      </span>
                      <span>•</span>
                      <span className="truncate text-[#64748B]">{item.description}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Favorite, Add button, Drag handle */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(item.id, e)}
                    className={`p-1 rounded-[2px] transition-colors ${
                      isFav
                        ? 'text-amber-400 hover:text-amber-300'
                        : 'text-[#5A6270] hover:text-amber-400 opacity-0 group-hover:opacity-100'
                    }`}
                    title={isFav ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                  >
                    <Heart size={12} className={isFav ? 'fill-amber-400' : ''} />
                  </button>

                  <button
                    type="button"
                    disabled={addingId === item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isClickSuppressed()) return;
                      handleAddToTimeline(item);
                    }}
                    className="px-2 py-1 rounded-[2px] bg-[#202631] hover:bg-emerald-600 text-[#E7EAF0] hover:text-white text-[10px] font-medium border border-[#292F39] hover:border-emerald-500 transition-colors flex items-center gap-1"
                    title="Ses Kanalına Ekle"
                  >
                    <Plus size={11} />
                    <span>{addingId === item.id ? '...' : 'Ekle'}</span>
                  </button>

                  <GripVertical className="w-3.5 h-3.5 text-[#5A6270] group-hover:text-[#929AA8] transition-colors cursor-grab" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
