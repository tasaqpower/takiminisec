import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TransitionDef, renderTransitionAB } from '../../engine/transitionEngine';
import { GripVertical, Star, Clock } from 'lucide-react';

interface TransitionCardProps {
  transition: TransitionDef;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onClick: () => void;
  onDoubleClick?: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  isCompact?: boolean;
}

export const TransitionCard: React.FC<TransitionCardProps> = ({
  transition,
  isSelected,
  isFavorite,
  onToggleFavorite,
  onClick,
  onDoubleClick,
  onPointerDown,
  isCompact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Render a specific frame on canvas
  const drawFrame = useCallback(
    (progress: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderTransitionAB(ctx, canvas.width, canvas.height, transition.id, progress);
    },
    [transition.id]
  );

  // Initial draw at resting state (progress = 0)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== 160 || canvas.height !== 90) {
      canvas.width = 160;
      canvas.height = 90;
    }
    drawFrame(0);
  }, [drawFrame]);

  // Live animation loop on hover
  useEffect(() => {
    if (!isHovered) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      drawFrame(0);
      return;
    }

    startTimeRef.current = performance.now();
    const DURATION_MS = 1200;

    const loop = (now: number) => {
      const elapsed = (now - startTimeRef.current) % DURATION_MS;
      const p = elapsed / DURATION_MS;
      drawFrame(p);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isHovered, drawFrame]);

  return (
    <div
      data-transition-card={transition.id}
      data-transition-id={transition.id}
      data-testid={`transition-card-${transition.id}`}
      title={`${transition.name} (${transition.technicalId}) — ${transition.description}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative rounded-[3px] border transition-all cursor-pointer select-none overflow-hidden ${
        isSelected
          ? 'bg-[#181D26] border-[#4f6bf5] ring-1 ring-[#4f6bf5]/50 shadow-md'
          : 'bg-[#141820] border-[#292F39] hover:border-[#4f6bf5]/60 hover:bg-[#181D26]'
      } ${isCompact ? 'p-1.5 flex items-center gap-2' : 'p-1.5 flex flex-col gap-1.5'}`}
    >
      {/* 16:9 Mini Canvas Preview */}
      <div
        className={`relative shrink-0 rounded-[2px] overflow-hidden bg-[#0A0D12] border border-[#202631] ${
          isCompact ? 'w-20 aspect-video' : 'w-full aspect-video'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={160}
          height={90}
          className="w-full h-full object-cover block"
        />

        {/* Hover Animation Indicator Badge */}
        {isHovered && (
          <div className="absolute bottom-1 right-1 px-1 py-0.2 rounded-[2px] bg-black/75 border border-white/20 text-[8px] font-mono text-[#E7EAF0]">
            A ▶ B
          </div>
        )}

        {/* Drag Handle Overlay */}
        <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-[2px] bg-black/60 text-[#929AA8] hover:text-[#E7EAF0] cursor-grab">
          <GripVertical size={11} />
        </div>

        {/* Favorite Star Button */}
        <button
          type="button"
          onClick={(e) => onToggleFavorite(transition.id, e)}
          className={`absolute top-1 right-1 p-0.5 rounded-[2px] transition-opacity ${
            isFavorite
              ? 'opacity-100 text-amber-400 bg-black/60'
              : 'opacity-0 group-hover:opacity-100 text-[#929AA8] hover:text-amber-400 bg-black/60'
          }`}
          title={isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
        >
          <Star size={11} className={isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
        </button>
      </div>

      {/* Info Block */}
      <div className="flex-1 min-w-0 flex flex-col justify-between overflow-hidden">
        {/* Name (max 2 lines, no English suffix on card) */}
        <div className="flex items-start justify-between gap-1 min-w-0">
          <span
            className="text-[11px] font-medium text-[#E7EAF0] leading-tight line-clamp-2 truncate"
            title={transition.name}
          >
            {transition.name}
          </span>
        </div>

        {/* Meta row: Category & Duration */}
        <div className="flex items-center justify-between gap-1 mt-1 text-[10px] text-[#929AA8]">
          <span className="truncate max-w-[65px] font-sans text-[#7E889B]">
            {transition.categoryName}
          </span>
          <span className="font-mono text-[#5A6270] flex items-center gap-0.5 shrink-0 bg-[#0E1117] px-1 py-0.2 rounded-[2px] border border-[#202631]">
            <Clock size={9} />
            {transition.defaultDuration.toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );
};
