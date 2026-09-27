import React from 'react';
import { GripVertical, Film, Music, Image as ImageIcon, Type, Sparkles } from 'lucide-react';

interface MediaBrowserItemProps {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'text' | 'transition' | 'effect';
  duration?: number;
  thumbnailUrl?: string;
  tag?: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

export const MediaBrowserItem: React.FC<MediaBrowserItemProps> = ({
  name,
  type,
  duration,
  thumbnailUrl,
  tag,
  onPointerDown,
  onClick,
  onDoubleClick,
  isSelected = false,
  className = '',
}) => {
  const getTypeIcon = () => {
    switch (type) {
      case 'video':
        return <Film size={12} className="text-[#6ba1df]" />;
      case 'audio':
        return <Music size={12} className="text-[#4ade94]" />;
      case 'image':
        return <ImageIcon size={12} className="text-[#f59e0b]" />;
      case 'text':
        return <Type size={12} className="text-[#c084fc]" />;
      default:
        return <Sparkles size={12} className="text-[#4f6bf5]" />;
    }
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={`${name}${duration ? ` (${duration}s)` : ''} — Zaman çizelgesine sürükleyin`}
      className={`group relative flex items-center gap-2 p-1.5 rounded-[3px] bg-[#171B21] hover:bg-[#1D222B] border transition-all cursor-grab active:cursor-grabbing select-none ${
        isSelected
          ? 'border-[#4f6bf5] bg-[#202631]'
          : 'border-[#292F39] hover:border-[#3B4351]'
      } ${className}`}
    >
      {/* Thumbnail / Icon preview */}
      <div className="w-10 h-7 rounded-[2px] bg-[#0E1014] border border-[#292F39] shrink-0 flex items-center justify-center overflow-hidden relative">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          getTypeIcon()
        )}
      </div>

      {/* Info: Name & Duration */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#E7EAF0] group-hover:text-white truncate leading-tight">
          {name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {tag && (
            <span className="text-[9px] px-1 py-0.2 rounded-[2px] bg-[#111419] border border-[#292F39] text-[#929AA8] leading-none">
              {tag}
            </span>
          )}
          {duration !== undefined && (
            <span className="text-[10px] text-[#5A6270] font-mono leading-none">
              {duration.toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* Hover Drag Grip */}
      <div className="shrink-0 text-[#5A6270] group-hover:text-[#929AA8] opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical size={13} />
      </div>
    </div>
  );
};
