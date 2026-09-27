import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VideoProject, TimelineTransition } from '../../types';
import { TRANSITION_DEFINITIONS, TransitionDef, renderTransitionAB } from '../../engine/transitionEngine';
import { useEditorDragDrop } from '../../context/DragDropContext';
import { TransitionCard } from './TransitionCard';
import {
  Shuffle,
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  Info,
  Clock,
  Play,
  RotateCcw,
} from 'lucide-react';

interface TransitionsTabProps {
  project: VideoProject;
  currentTime: number;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string | null) => void;
  onUpdateClip?: (clipId: string, updates: any) => void;
  onAddTimelineTransition?: (transition: Omit<TimelineTransition, 'id'>) => TimelineTransition;
}

const CATEGORIES = [
  { id: 'all', label: 'Tümü' },
  { id: 'basic', label: 'Temel' },
  { id: 'slide-push', label: 'Kaydırma' },
  { id: 'wipe-mask', label: 'Silme' },
  { id: 'camera-motion', label: 'Kamera' },
  { id: 'cinematic', label: 'Sinematik' },
  { id: 'digital', label: 'Dijital' },
  { id: 'favorites', label: 'Favoriler' },
  { id: 'recent', label: 'Son Kullanılanlar' },
];

export const TransitionsTab: React.FC<TransitionsTabProps> = ({
  project,
  currentTime,
  onAddTimelineTransition,
}) => {
  const { startDrag } = useEditorDragDrop();
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'default' | 'name-asc' | 'name-desc' | 'duration-asc' | 'duration-desc'>('default');
  const [selectedTrId, setSelectedTrId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Responsive column detection
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState<boolean>(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < 340);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('forma_favorite_transitions');
      return saved ? JSON.parse(saved) : ['crossfade', 'fade-black', 'whip-pan-left', 'glitch'];
    } catch {
      return ['crossfade', 'fade-black', 'whip-pan-left', 'glitch'];
    }
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('forma_favorite_transitions', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Recent transitions state
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('forma_recent_transitions');
      return saved ? JSON.parse(saved) : ['crossfade', 'slide-left', 'circle-reveal'];
    } catch {
      return ['crossfade', 'slide-left', 'circle-reveal'];
    }
  });

  const addRecent = (id: string) => {
    setRecent((prev) => {
      const updated = [id, ...prev.filter((item) => item !== id)].slice(0, 12);
      try {
        localStorage.setItem('forma_recent_transitions', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Filtered & Sorted Transitions
  const filteredTransitions = useMemo(() => {
    let list = TRANSITION_DEFINITIONS.filter((tr) => {
      if (category === 'all') return true;
      if (category === 'favorites') return favorites.includes(tr.id);
      if (category === 'recent') return recent.includes(tr.id);
      if (category === 'cinematic') {
        return (
          tr.id === 'light-leak' ||
          tr.id === 'film-burn' ||
          tr.id === 'lens-flare' ||
          tr.id === 'blur-dissolve' ||
          tr.id === 'flash'
        );
      }
      if (category === 'digital') {
        return (
          tr.id === 'glitch' ||
          tr.id === 'rgb-split' ||
          tr.id === 'pixel-dissolve' ||
          tr.id === 'vhs-distortion' ||
          tr.id === 'prism-dissolve'
        );
      }
      return tr.category === category;
    });

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      list = list.filter(
        (tr) =>
          tr.name.toLowerCase().includes(query) ||
          tr.technicalId.toLowerCase().includes(query) ||
          tr.description.toLowerCase().includes(query) ||
          tr.id.toLowerCase().includes(query)
      );
    }

    // Sort order
    if (sortOrder === 'name-asc') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    } else if (sortOrder === 'name-desc') {
      list = [...list].sort((a, b) => b.name.localeCompare(a.name, 'tr'));
    } else if (sortOrder === 'duration-asc') {
      list = [...list].sort((a, b) => a.defaultDuration - b.defaultDuration);
    } else if (sortOrder === 'duration-desc') {
      list = [...list].sort((a, b) => b.defaultDuration - a.defaultDuration);
    }

    return list;
  }, [category, search, sortOrder, favorites, recent]);

  // Selected transition details for preview drawer
  const selectedDef = useMemo(() => {
    if (!selectedTrId) return null;
    return TRANSITION_DEFINITIONS.find((t) => t.id === selectedTrId) || null;
  }, [selectedTrId]);

  // Double-click to apply to closest cut point
  const handleDoubleClick = (tr: TransitionDef) => {
    addRecent(tr.id);

    // Find unlocked video track
    const videoTracks = project.tracks.filter((t) => !t.locked && (t.type === 'video' || t.type === 'image'));
    let bestCut: { trackId: string; cutTime: number; leftClipId?: string; rightClipId?: string } | null = null;
    let minDistance = Infinity;

    for (const track of videoTracks) {
      const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
      for (let i = 0; i < sorted.length - 1; i++) {
        const c1 = sorted[i];
        const c2 = sorted[i + 1];
        const cutTime = c1.startTime + c1.duration;
        const dist = Math.abs(currentTime - cutTime);
        if (dist < minDistance) {
          minDistance = dist;
          bestCut = {
            trackId: track.id,
            cutTime,
            leftClipId: c1.id,
            rightClipId: c2.id,
          };
        }
      }
    }

    if (bestCut && onAddTimelineTransition) {
      onAddTimelineTransition({
        trackId: bestCut.trackId,
        cutTime: bestCut.cutTime,
        leftClipId: bestCut.leftClipId,
        rightClipId: bestCut.rightClipId,
        type: tr.id,
        duration: tr.defaultDuration,
        alignment: 'between',
        easing: tr.defaultEasing || 'linear',
      });
      setStatusBanner(`"${tr.name}" geçişi kesim noktasına uygulandı.`);
      setTimeout(() => setStatusBanner(null), 3000);
    } else {
      setStatusBanner('Oynatma kafasına yakın iki video arasında kesim noktası bulunamadı. Lütfen geçişi doğrudan kesim çizgisine sürükleyin.');
      setTimeout(() => setStatusBanner(null), 4000);
    }
  };

  // Preview Drawer Canvas Ref & Scrub state
  const bigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [bigScrub, setBigScrub] = useState<number>(0.5);
  const [isBigPlaying, setIsBigPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedDef || !bigCanvasRef.current) return;
    const canvas = bigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderTransitionAB(ctx, canvas.width, canvas.height, selectedDef.id, bigScrub);
  }, [selectedDef, bigScrub]);

  useEffect(() => {
    if (!isBigPlaying || !selectedDef) return;
    let start = performance.now();
    let frameId: number;
    const DURATION = 1500;

    const tick = (now: number) => {
      const elapsed = (now - start) % DURATION;
      const p = elapsed / DURATION;
      setBigScrub(p);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isBigPlaying, selectedDef]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-[#111419] text-[#E7EAF0] text-xs select-none overflow-x-hidden w-full max-w-full"
    >
      {/* 1. Header Toolbar */}
      <div className="p-3 pb-2 space-y-2.5 border-b border-[#202631] shrink-0 overflow-x-hidden">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5 text-[#4f6bf5]" />
            <span className="font-semibold text-xs text-[#E7EAF0]">Geçişler</span>
          </div>
          <span
            data-testid="transitions-count"
            className="text-[10px] text-[#929AA8] font-mono bg-[#171B21] px-2 py-0.5 rounded-[2px] border border-[#292F39]"
          >
            {filteredTransitions.length} / {TRANSITION_DEFINITIONS.length}
          </span>
        </div>

        {/* Search & Sort row */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-[#5A6270] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Geçiş ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] placeholder-[#5A6270] text-xs outline-none focus:border-[#4f6bf5] transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#929AA8] hover:text-[#E7EAF0]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="h-7 px-1.5 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#929AA8] text-[10px] outline-none focus:border-[#4f6bf5] shrink-0 cursor-pointer"
            title="Sıralama"
          >
            <option value="default">Varsayılan</option>
            <option value="name-asc">A - Z</option>
            <option value="name-desc">Z - A</option>
            <option value="duration-asc">Süre (Kısa)</option>
            <option value="duration-desc">Süre (Uzun)</option>
          </select>
        </div>

        {/* Categories Bar */}
        {isCompact ? (
          <div className="w-full">
            <select
              data-testid="category-select-compact"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-7 px-2 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] text-[11px] outline-none focus:border-[#4f6bf5] cursor-pointer"
              title="Kategori Seç"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 w-full">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                data-testid={`category-tab-${cat.id}`}
                onClick={() => setCategory(cat.id)}
                className={`px-2 py-1 rounded-[2px] text-[10px] font-medium whitespace-nowrap transition-colors ${
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
      </div>

      {/* Status banner */}
      {statusBanner && (
        <div className="mx-3 mt-2 p-2 rounded-[3px] bg-[#181D26] border border-[#4f6bf5]/40 text-[#93c5fd] text-[11px] flex items-center gap-2 animate-in fade-in shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-[#4f6bf5] shrink-0" />
          <span className="truncate">{statusBanner}</span>
        </div>
      )}

      {/* 2. Transition Cards Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
        {filteredTransitions.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-[#5A6270]">
            <SlidersHorizontal size={24} className="mb-2 opacity-50" />
            <p className="text-xs text-[#929AA8]">Sonuç bulunamadı</p>
            <p className="text-[10px] text-[#5A6270] mt-1">Arama terimini veya filtreyi değiştirin</p>
          </div>
        ) : (
          <div
            className={
              isCompact
                ? 'flex flex-col gap-1.5'
                : 'grid grid-cols-2 gap-2'
            }
          >
            {filteredTransitions.map((tr) => (
              <TransitionCard
                key={tr.id}
                transition={tr}
                isCompact={isCompact}
                isSelected={selectedTrId === tr.id}
                isFavorite={favorites.includes(tr.id)}
                onToggleFavorite={toggleFavorite}
                onClick={() => {
                  setSelectedTrId(tr.id);
                  addRecent(tr.id);
                }}
                onDoubleClick={() => handleDoubleClick(tr)}
                onPointerDown={(e) => {
                  if (e.button === 0) {
                    addRecent(tr.id);
                    startDrag(
                      {
                        type: 'transition',
                        id: tr.id,
                        name: tr.name,
                        icon: 'transition',
                        duration: tr.defaultDuration || 1.0,
                        category: tr.category,
                        data: tr,
                      },
                      e.clientX,
                      e.clientY
                    );
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. Selected Transition Inspector Detail (Bottom Drawer) */}
      {selectedDef && (
        <div className="border-t border-[#202631] bg-[#0E1117] p-2.5 shrink-0 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f6bf5]" />
              <span className="font-semibold text-xs text-[#E7EAF0] truncate">
                {selectedDef.name}
              </span>
              <span className="text-[9px] font-mono text-[#5A6270]">
                ({selectedDef.technicalId})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTrId(null)}
              className="text-[#929AA8] hover:text-[#E7EAF0] p-0.5"
            >
              <X size={12} />
            </button>
          </div>

          {/* Interactive Scrub Canvas */}
          <div className="relative w-full aspect-video rounded-[2px] overflow-hidden bg-[#000] border border-[#202631] mb-2">
            <canvas ref={bigCanvasRef} width={280} height={157} className="w-full h-full object-cover block" />
            <button
              type="button"
              onClick={() => setIsBigPlaying((v) => !v)}
              className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-[2px] bg-black/75 border border-white/20 text-[9px] text-[#E7EAF0] flex items-center gap-1 hover:bg-[#4f6bf5] transition-colors"
            >
              <Play size={8} />
              {isBigPlaying ? 'Durdur' : 'Oynat'}
            </button>
            <button
              type="button"
              onClick={() => setBigScrub(0.5)}
              className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-[2px] bg-black/75 border border-white/20 text-[9px] text-[#E7EAF0] flex items-center gap-1 hover:bg-[#202631] transition-colors"
            >
              <RotateCcw size={8} />
              %50 Orta Kare
            </button>
          </div>

          {/* Scrub Slider */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono text-[#5A6270]">0%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={bigScrub}
              onChange={(e) => {
                setIsBigPlaying(false);
                setBigScrub(parseFloat(e.target.value));
              }}
              className="flex-1 h-1 bg-[#1F2633] rounded-lg appearance-none cursor-pointer accent-[#4f6bf5]"
            />
            <span className="text-[9px] font-mono text-[#5A6270]">100%</span>
          </div>

          <p className="text-[10px] text-[#929AA8] leading-tight mb-2">
            {selectedDef.description}
          </p>

          <div className="flex items-center justify-between text-[10px] text-[#5A6270] pt-1.5 border-t border-[#1C212A]">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              Varsayılan: {selectedDef.defaultDuration.toFixed(1)}s
            </span>
            <span className="text-[#4f6bf5] font-medium flex items-center gap-1">
              <Info size={10} />
              Zaman çizgisine sürükleyin
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
