import React from 'react';
import { Volume2, VolumeX, Lock, Unlock, Eye, EyeOff, Video, Music, Type } from 'lucide-react';
import { TrackType } from '../../types';

interface TimelineTrackHeaderProps {
  id: string;
  name: string;
  type: TrackType;
  index: number;
  isMuted: boolean;
  isLocked: boolean;
  isHidden: boolean;
  onToggleMute: () => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
  onDeleteTrack?: () => void;
  clipCount: number;
  className?: string;
}

export const TimelineTrackHeader: React.FC<TimelineTrackHeaderProps> = ({
  name,
  type,
  index,
  isMuted,
  isLocked,
  isHidden,
  onToggleMute,
  onToggleLock,
  onToggleVisibility,
  clipCount,
  className = '',
}) => {
  const getTrackIcon = () => {
    switch (type) {
      case 'video':
        return <Video size={13} className="text-[#6ba1df]" />;
      case 'audio':
        return <Music size={13} className="text-[#4ade94]" />;
      case 'text':
      case 'subtitle':
        return <Type size={13} className="text-[#c084fc]" />;
      default:
        return <Video size={13} className="text-[#929AA8]" />;
    }
  };

  const getTrackShortCode = () => {
    switch (type) {
      case 'video':
        return `V${index + 1}`;
      case 'audio':
        return `A${index + 1}`;
      case 'text':
        return `T${index + 1}`;
      case 'subtitle':
        return `S${index + 1}`;
      default:
        return `K${index + 1}`;
    }
  };

  return (
    <div
      data-testid={`track-header-${type}-${index}`}
      className={`w-[160px] h-16 shrink-0 border-b border-[#292F39] bg-[#111419] px-2 py-1.5 flex flex-col justify-between select-none relative group ${
        isLocked ? 'bg-[#0E1014] opacity-80' : ''
      } ${className}`}
    >
      {/* Top Row: Track Code & Name */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-5 h-4 rounded-[2px] bg-[#171B21] border border-[#292F39] flex items-center justify-center text-[10px] font-mono font-bold text-[#E7EAF0] shrink-0">
            {getTrackShortCode()}
          </span>
          <span className="truncate text-xs font-medium text-[#E7EAF0]" title={name}>
            {name}
          </span>
        </div>

        <span className="text-[10px] text-[#5A6270] font-mono shrink-0">
          {clipCount}
        </span>
      </div>

      {/* Bottom Row: Mute, Lock, Visibility actions */}
      <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#1C212A]">
        <div className="flex items-center gap-0.5">
          {type === 'audio' || type === 'video' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute();
              }}
              title={isMuted ? 'Sesi Aç' : 'Sessize Al (M)'}
              className={`w-5 h-5 rounded-[2px] flex items-center justify-center transition-colors ${
                isMuted
                  ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                  : 'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21]'
              }`}
            >
              {isMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
            </button>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center">
              {getTrackIcon()}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            title={isLocked ? 'Kilidi Aç' : 'Kanalı Kilitle (L)'}
            className={`w-5 h-5 rounded-[2px] flex items-center justify-center transition-colors ${
              isLocked
                ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                : 'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21]'
            }`}
          >
            {isLocked ? <Lock size={11} /> : <Unlock size={11} />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            title={isHidden ? 'Kanalı Göster' : 'Kanalı Gizle (V)'}
            className={`w-5 h-5 rounded-[2px] flex items-center justify-center transition-colors ${
              isHidden
                ? 'bg-gray-800 text-gray-500 border border-gray-700'
                : 'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21]'
            }`}
          >
            {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
        </div>

        <div className="text-[#5A6270] flex items-center">
          {getTrackIcon()}
        </div>
      </div>
    </div>
  );
};
