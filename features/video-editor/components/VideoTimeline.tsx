import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VideoProject, TimelineTrack, VideoClip, TrackType } from '../types';

interface TimelineProps {
  project: VideoProject;
  currentTime: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onSeek: (time: number) => void;
  onSplitClip: (clipId: string, splitTime: number) => void;
  onDeleteClip: (clipId: string) => void;
  onRippleDeleteClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onMoveClip: (clipId: string, targetTrackId: string, newStartTime: number) => void;
  onTrimClip: (clipId: string, newTrimIn: number, newTrimOut: number, newStartTime: number, newDuration: number) => void;
  onAddTrack: (type: TrackType) => void;
  onDeleteTrack: (trackId: string) => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackLock: (trackId: string) => void;
  onToggleTrackVisibility: (trackId: string) => void;
}

export const VideoTimeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  selectedClipId,
  onSelectClip,
  onSeek,
  onSplitClip,
  onDeleteClip,
  onRippleDeleteClip,
  onDuplicateClip,
  onMoveClip,
  onTrimClip,
  onAddTrack,
  onDeleteTrack,
  onToggleTrackMute,
  onToggleTrackLock,
  onToggleTrackVisibility,
}) => {
  const [zoom, setZoom] = useState<number>(40); // pixels per second
  const [snapping, setSnapping] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draggingClip, setDraggingClip] = useState<{
    clipId: string;
    initialStartTime: number;
    initialMouseX: number;
    trackId: string;
  } | null>(null);

  const [trimmingClip, setTrimmingClip] = useState<{
    clipId: string;
    edge: 'left' | 'right';
    initialStartTime: number;
    initialDuration: number;
    initialTrimIn: number;
    initialTrimOut: number;
    initialMouseX: number;
  } | null>(null);

  // Helper for snapping
  const snapTime = useCallback(
    (time: number, thresholdSec = 0.25): number => {
      if (!snapping) return Math.max(0, time);

      // Snap to 0 or playhead
      if (Math.abs(time - 0) < thresholdSec) return 0;
      if (Math.abs(time - currentTime) < thresholdSec) return currentTime;

      // Snap to any clip edges
      for (const t of project.tracks) {
        for (const c of t.clips) {
          if (Math.abs(time - c.startTime) < thresholdSec) return c.startTime;
          const end = c.startTime + c.duration;
          if (Math.abs(time - end) < thresholdSec) return end;
        }
      }

      return Math.max(0, time);
    },
    [snapping, currentTime, project.tracks]
  );

  // Convert mouse X inside track area to time (seconds)
  const clientXToTime = useCallback(
    (clientX: number): number => {
      if (!scrollContainerRef.current) return 0;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const offsetX = clientX - rect.left + scrollLeft;
      return Math.max(0, offsetX / zoom);
    },
    [zoom]
  );

  // Global mouse handlers for scrubbing, dragging, and trimming
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        const time = clientXToTime(e.clientX);
        onSeek(Math.min(project.duration, Math.max(0, time)));
      } else if (draggingClip) {
        const deltaX = e.clientX - draggingClip.initialMouseX;
        const deltaSec = deltaX / zoom;
        let newStartTime = Math.max(0, draggingClip.initialStartTime + deltaSec);
        newStartTime = snapTime(newStartTime);
        onMoveClip(draggingClip.clipId, draggingClip.trackId, newStartTime);
      } else if (trimmingClip) {
        const deltaX = e.clientX - trimmingClip.initialMouseX;
        const deltaSec = deltaX / zoom;

        if (trimmingClip.edge === 'left') {
          // Adjust trimIn and startTime
          let newStart = Math.max(0, trimmingClip.initialStartTime + deltaSec);
          newStart = snapTime(newStart);
          const actualShift = newStart - trimmingClip.initialStartTime;
          const newDuration = Math.max(0.2, trimmingClip.initialDuration - actualShift);
          const newTrimIn = Math.max(0, trimmingClip.initialTrimIn + actualShift);
          onTrimClip(trimmingClip.clipId, newTrimIn, trimmingClip.initialTrimOut, newStart, newDuration);
        } else {
          // Adjust duration and trimOut
          let newDuration = Math.max(0.2, trimmingClip.initialDuration + deltaSec);
          const newEnd = snapTime(trimmingClip.initialStartTime + newDuration);
          newDuration = Math.max(0.2, newEnd - trimmingClip.initialStartTime);
          const newTrimOut = trimmingClip.initialTrimIn + newDuration;
          onTrimClip(trimmingClip.clipId, trimmingClip.initialTrimIn, newTrimOut, trimmingClip.initialStartTime, newDuration);
        }
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) setIsScrubbing(false);
      if (draggingClip) setDraggingClip(null);
      if (trimmingClip) setTrimmingClip(null);
    };

    if (isScrubbing || draggingClip || trimmingClip) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, draggingClip, trimmingClip, zoom, clientXToTime, snapTime, onSeek, onMoveClip, onTrimClip, project.duration]);

  const totalWidth = Math.max(1200, (project.duration + 5) * zoom);

  // Time ruler ticks
  const renderRulerTicks = () => {
    const ticks: React.ReactNode[] = [];
    const stepSeconds = zoom < 25 ? 5 : zoom < 60 ? 1 : 0.5;
    const maxSeconds = Math.ceil(totalWidth / zoom);

    for (let s = 0; s <= maxSeconds; s += stepSeconds) {
      const left = s * zoom;
      const isMajor = s % 5 === 0;

      ticks.push(
        <div
          key={s}
          className="absolute top-0 bottom-0 pointer-events-none flex flex-col justify-end"
          style={{ left }}
        >
          <div className={`w-[1px] bg-[#30363d] ${isMajor ? 'h-3.5 bg-gray-400' : 'h-2'}`} />
          {isMajor && (
            <span className="text-[10px] font-mono text-gray-400 -translate-x-1/2 select-none mb-1">
              {Math.floor(s / 60)}:{(s % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
      );
    }
    return ticks;
  };

  return (
    <div
      ref={containerRef}
      className="h-72 bg-[#090d13] border-t border-[#21262d] flex flex-col select-none shrink-0 z-10"
    >
      {/* Timeline Action Toolbar */}
      <div className="h-10 px-4 border-b border-[#21262d] bg-[#0d1117] flex items-center justify-between text-xs">
        {/* Left operations */}
        <div className="flex items-center gap-1.5">
          {/* Split / Böl Button */}
          <button
            onClick={() => {
              if (selectedClipId) {
                onSplitClip(selectedClipId, currentTime);
              }
            }}
            disabled={!selectedClipId}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 border transition-colors ${
              selectedClipId
                ? 'bg-[#161b22] text-gray-200 border-[#30363d] hover:border-indigo-500 hover:text-white'
                : 'text-gray-600 border-transparent cursor-not-allowed'
            }`}
            title="Klibi Oynatma Çizgisinden İkiye Böl (S)"
          >
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
            <span className="font-semibold text-xs">Böl (S)</span>
          </button>

          {/* Delete Button */}
          <button
            onClick={() => {
              if (selectedClipId) onDeleteClip(selectedClipId);
            }}
            disabled={!selectedClipId}
            className={`p-1.5 rounded border transition-colors ${
              selectedClipId
                ? 'bg-[#161b22] text-gray-300 border-[#30363d] hover:border-red-500 hover:text-red-400'
                : 'text-gray-600 border-transparent cursor-not-allowed'
            }`}
            title="Seçili Klibi Sil (Delete)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          {/* Ripple Delete Button */}
          <button
            onClick={() => {
              if (selectedClipId) onRippleDeleteClip(selectedClipId);
            }}
            disabled={!selectedClipId}
            className={`px-2 py-1 rounded flex items-center gap-1 border transition-colors ${
              selectedClipId
                ? 'bg-[#161b22] text-amber-300 border-[#30363d] hover:border-amber-500'
                : 'text-gray-600 border-transparent cursor-not-allowed'
            }`}
            title="Boşluksuz Sil (Shift+Delete)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="text-[11px] font-medium">Boşluksuz Sil</span>
          </button>

          {/* Duplicate Button */}
          <button
            onClick={() => {
              if (selectedClipId) onDuplicateClip(selectedClipId);
            }}
            disabled={!selectedClipId}
            className={`p-1.5 rounded border transition-colors ${
              selectedClipId
                ? 'bg-[#161b22] text-gray-300 border-[#30363d] hover:border-indigo-500 hover:text-white'
                : 'text-gray-600 border-transparent cursor-not-allowed'
            }`}
            title="Kopyasını Oluştur (Ctrl+D)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          <div className="h-4 w-[1px] bg-[#30363d] mx-1" />

          {/* Add Track dropdown */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAddTrack('video')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#161b22] text-gray-300 hover:text-white border border-[#30363d] hover:border-gray-500 transition-colors"
            >
              + Video Kanalı
            </button>
            <button
              onClick={() => onAddTrack('audio')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#161b22] text-gray-300 hover:text-white border border-[#30363d] hover:border-gray-500 transition-colors"
            >
              + Ses Kanalı
            </button>
            <button
              onClick={() => onAddTrack('text')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#161b22] text-gray-300 hover:text-white border border-[#30363d] hover:border-gray-500 transition-colors"
            >
              + Metin Kanalı
            </button>
          </div>
        </div>

        {/* Right operations: Snapping & Zoom */}
        <div className="flex items-center gap-3">
          {/* Snapping */}
          <button
            onClick={() => setSnapping(!snapping)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
              snapping
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
            title="Mıknatıs / Yapışma (Snapping)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Mıknatıs</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom((z) => Math.max(15, z - 10))}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#161b22]"
              title="Uzaklaş (-)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="range"
              min="15"
              max="150"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="w-20 h-1 bg-[#21262d] accent-indigo-500 rounded cursor-pointer"
            />
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#161b22]"
              title="Yakınlaş (+)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Multi-track area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Fixed: Track Headers */}
        <div className="w-48 bg-[#0d1117] border-r border-[#21262d] flex flex-col shrink-0">
          {/* Header spacer corresponding to ruler */}
          <div className="h-6 border-b border-[#21262d] bg-[#161b22]/50 px-2 flex items-center justify-between text-[10px] text-gray-400 font-semibold uppercase">
            <span>Kanallar</span>
            <span>{project.tracks.length}</span>
          </div>

          {/* Track Headers List */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {project.tracks.map((track) => (
              <div
                key={track.id}
                className="h-16 px-2.5 border-b border-[#21262d] bg-[#0d1117] flex items-center justify-between group hover:bg-[#161b22]/60 transition-colors"
              >
                <div className="min-w-0 flex-1 mr-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">
                      {track.type === 'video'
                        ? '📹'
                        : track.type === 'audio'
                        ? '🎵'
                        : track.type === 'subtitle'
                        ? '💬'
                        : '🔤'}
                    </span>
                    <span className="text-xs font-semibold text-gray-200 truncate">{track.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase font-mono tracking-tight">
                    {track.clips.length} Klip
                  </span>
                </div>

                {/* Track controls: Mute, Lock, Hide, Delete */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleTrackMute(track.id)}
                    className={`p-1 rounded transition-colors ${
                      track.muted ? 'text-red-400 bg-red-950/40' : 'text-gray-500 hover:text-gray-300'
                    }`}
                    title={track.muted ? 'Sesi Aç' : 'Sessize Al'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => onToggleTrackLock(track.id)}
                    className={`p-1 rounded transition-colors ${
                      track.locked ? 'text-amber-400 bg-amber-950/40' : 'text-gray-500 hover:text-gray-300'
                    }`}
                    title={track.locked ? 'Kilidi Aç' : 'Kanalı Kilitle'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </button>

                  {project.tracks.length > 1 && (
                    <button
                      onClick={() => onDeleteTrack(track.id)}
                      className="p-1 rounded text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Kanalı Sil"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Scrollable: Ruler & Track Lanes & Playhead */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#090d13]"
        >
          <div style={{ width: totalWidth }} className="relative min-h-full">
            {/* 1. Time Ruler Bar */}
            <div
              onClick={(e) => {
                const time = clientXToTime(e.clientX);
                onSeek(Math.min(project.duration, Math.max(0, time)));
              }}
              onMouseDown={() => setIsScrubbing(true)}
              className="h-6 bg-[#0d1117] border-b border-[#21262d] sticky top-0 z-30 cursor-pointer overflow-hidden"
            >
              {renderRulerTicks()}
            </div>

            {/* 2. Track Lanes */}
            <div className="relative">
              {project.tracks.map((track) => (
                <div
                  key={track.id}
                  className="h-16 border-b border-[#21262d] relative bg-[#090d13] flex items-center"
                >
                  {/* Background grid line ticks */}
                  <div className="absolute inset-0 pointer-events-none opacity-5">
                    {renderRulerTicks()}
                  </div>

                  {/* Clips on this track */}
                  {track.clips.map((clip) => {
                    const isSelected = clip.id === selectedClipId;
                    const left = clip.startTime * zoom;
                    const width = Math.max(20, clip.duration * zoom);

                    // Dynamic colors based on clip type
                    let bgStyle = 'bg-blue-600/30 border-blue-500/70 text-blue-200';
                    if (clip.type === 'audio') {
                      bgStyle = 'bg-emerald-600/30 border-emerald-500/70 text-emerald-200';
                    } else if (clip.type === 'text') {
                      bgStyle = 'bg-purple-600/30 border-purple-500/70 text-purple-200';
                    } else if (clip.type === 'image') {
                      bgStyle = 'bg-amber-600/30 border-amber-500/70 text-amber-200';
                    }

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip.id);
                        }}
                        onMouseDown={(e) => {
                          if (e.button === 0 && !track.locked) {
                            e.stopPropagation();
                            onSelectClip(clip.id);
                            setDraggingClip({
                              clipId: clip.id,
                              initialStartTime: clip.startTime,
                              initialMouseX: e.clientX,
                              trackId: track.id,
                            });
                          }
                        }}
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                        }}
                        className={`absolute top-1.5 bottom-1.5 rounded-md border flex items-center justify-between px-2 cursor-grab active:cursor-grabbing overflow-hidden group select-none transition-shadow ${bgStyle} ${
                          isSelected
                            ? 'ring-2 ring-white border-white shadow-lg shadow-indigo-500/30 z-20'
                            : 'hover:brightness-110 z-10'
                        }`}
                      >
                        {/* Left Trim Handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (!track.locked) {
                              setTrimmingClip({
                                clipId: clip.id,
                                edge: 'left',
                                initialStartTime: clip.startTime,
                                initialDuration: clip.duration,
                                initialTrimIn: clip.trimIn,
                                initialTrimOut: clip.trimOut,
                                initialMouseX: e.clientX,
                              });
                            }
                          }}
                          className="absolute left-0 top-0 bottom-0 w-2.5 bg-white/20 hover:bg-white/60 cursor-ew-resize flex items-center justify-center"
                          title="Başlangıcı Kırp"
                        >
                          <div className="w-[2px] h-3 bg-white/70" />
                        </div>

                        {/* Clip Content Label & Visuals */}
                        <div className="flex-1 min-w-0 mx-2 pointer-events-none flex flex-col justify-center">
                          <p className="text-xs font-semibold truncate text-white drop-shadow-sm">
                            {clip.name}
                          </p>
                          <p className="text-[9px] opacity-75 font-mono truncate">
                            {clip.duration.toFixed(1)} sn
                            {clip.speed && clip.speed !== 1 ? ` • ${clip.speed}x` : ''}
                          </p>
                        </div>

                        {/* Right Trim Handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (!track.locked) {
                              setTrimmingClip({
                                clipId: clip.id,
                                edge: 'right',
                                initialStartTime: clip.startTime,
                                initialDuration: clip.duration,
                                initialTrimIn: clip.trimIn,
                                initialTrimOut: clip.trimOut,
                                initialMouseX: e.clientX,
                              });
                            }
                          }}
                          className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/20 hover:bg-white/60 cursor-ew-resize flex items-center justify-center"
                          title="Bitişi Kırp"
                        >
                          <div className="w-[2px] h-3 bg-white/70" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 3. Playhead Line & Scrubber Scraper */}
            <div
              style={{ left: `${currentTime * zoom}px` }}
              className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-40 pointer-events-none shadow-md shadow-red-500/50"
            >
              {/* Scrubber diamond head */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsScrubbing(true);
                }}
                className="w-3.5 h-3.5 bg-red-500 transform rotate-45 -translate-x-[6px] -translate-y-1 pointer-events-auto cursor-ew-resize shadow-md"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
