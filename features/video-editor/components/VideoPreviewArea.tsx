import React, { useRef, useEffect, useState, useCallback } from 'react';
import { VideoProject, VideoClip, Transform2D } from '../types';
import { renderFrameToCanvas } from '../engine/previewRenderer';
import { exportEngine } from '../engine/exportEngine';
import { audioMixer } from '../engine/audioMixer';

interface PreviewProps {
  project: VideoProject;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  isLooping: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStepForward: (seconds: number) => void;
  onStepBackward: (seconds: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetIsLooping: (loop: boolean) => void;
  selectedClip: VideoClip | null;
  onUpdateClipTransform: (clipId: string, transform: Partial<Transform2D>) => void;
}

export const VideoPreviewArea: React.FC<PreviewProps> = ({
  project,
  currentTime,
  isPlaying,
  playbackRate,
  isLooping,
  onTogglePlay,
  onSeek,
  onStepForward,
  onStepBackward,
  onSetPlaybackRate,
  onSetIsLooping,
  selectedClip,
  onUpdateClipTransform,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [showSafeZones, setShowSafeZones] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number; initialClipX: number; initialClipY: number } | null>(null);

  // Timecode formatter: HH:MM:SS:FF
  const formatTimecode = useCallback((seconds: number, fps = 30) => {
    const s = Math.max(0, seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const frames = Math.floor((s % 1) * fps);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  }, []);

  // Continuous render loop for canvas preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== project.resolution.width || canvas.height !== project.resolution.height) {
      canvas.width = project.resolution.width;
      canvas.height = project.resolution.height;
    }

    let isMounted = true;
    renderFrameToCanvas(canvas, project, currentTime, selectedClip?.id, isPlaying).catch((err) => {
      if (isMounted) console.warn('Preview render frame error:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [project, currentTime, selectedClip, isPlaying]);

  // Handle PNG Snapshot
  const handleCaptureSnapshot = async () => {
    const blob = await exportEngine.exportProject(
      project,
      {
        format: 'png',
        resolution: project.resolution,
        fps: project.fps,
        quality: 'high',
        filename: `${project.name}_kare_${Math.round(currentTime * 100)}.png`,
      },
      currentTime,
      () => {}
    );
    if (blob) {
      exportEngine.downloadBlob(blob, `${project.name}_kare.png`);
    }
  };

  // Canvas Mouse Down for interactive gizmo movement
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedClip || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    setIsDraggingGizmo(true);
    dragStartPos.current = {
      x: clickX,
      y: clickY,
      initialClipX: selectedClip.transform?.x || 0,
      initialClipY: selectedClip.transform?.y || 0,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingGizmo || !dragStartPos.current || !selectedClip || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    const scaleX = project.resolution.width / rect.width;
    const scaleY = project.resolution.height / rect.height;

    const deltaX = (curX - dragStartPos.current.x) * scaleX;
    const deltaY = (curY - dragStartPos.current.y) * scaleY;

    onUpdateClipTransform(selectedClip.id, {
      x: Math.round(dragStartPos.current.initialClipX + deltaX),
      y: Math.round(dragStartPos.current.initialClipY + deltaY),
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingGizmo(false);
    dragStartPos.current = null;
  };

  // Volume toggle
  const handleVolumeChange = (newVol: number) => {
    setMasterVolume(newVol);
    setIsMuted(newVol === 0);
    audioMixer.setMasterVolume(newVol);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      audioMixer.setMasterVolume(masterVolume > 0 ? masterVolume : 1.0);
    } else {
      setIsMuted(true);
      audioMixer.setMasterVolume(0);
    }
  };

  const isVertical = project.resolution.height > project.resolution.width;

  return (
    <div className="flex-1 flex flex-col bg-[#090d13] overflow-hidden relative select-none">
      {/* Top Preview Bar */}
      <div className="h-9 px-4 flex items-center justify-between border-b border-[#21262d] bg-[#0d1117]/80 text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <span className="font-mono text-gray-300">
            {project.resolution.width} x {project.resolution.height}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161b22] text-gray-400 border border-[#30363d]">
            {isVertical ? 'Dikey (9:16)' : 'Yatay (16:9)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Safe Zones Toggle */}
          <button
            onClick={() => setShowSafeZones(!showSafeZones)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
              showSafeZones
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                : 'text-gray-400 hover:text-gray-200 border-[#30363d]'
            }`}
            title="Güvenli Alan Kılavuzları (Action & Title Safe)"
          >
            Güvenli Alan
          </button>

          {/* Quick Snapshot */}
          <button
            onClick={handleCaptureSnapshot}
            className="px-2 py-0.5 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-[#21262d] border border-[#30363d] flex items-center gap-1 transition-colors"
            title="Mevcut Kareyi PNG Olarak Kaydet"
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            <span>Kareyi Al</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-6 relative overflow-hidden"
      >
        <div
          className="relative shadow-2xl rounded-sm overflow-hidden flex items-center justify-center border border-[#30363d]"
          style={{
            aspectRatio: `${project.resolution.width} / ${project.resolution.height}`,
            maxHeight: '100%',
            maxWidth: '100%',
            backgroundColor: project.backgroundColor || '#000000',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="w-full h-full object-contain cursor-crosshair"
          />

          {/* Safe Zones Guides Overlay */}
          {showSafeZones && (
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Action Safe (93%) */}
              <div className="absolute inset-[3.5%] border border-dashed border-emerald-400/50 pointer-events-none flex items-start justify-start p-1">
                <span className="text-[9px] font-mono text-emerald-400/80 bg-black/60 px-1 rounded">
                  Eylem Güvenli (%93)
                </span>
              </div>
              {/* Title Safe (90%) */}
              <div className="absolute inset-[5%] border border-dashed border-cyan-400/60 pointer-events-none flex items-start justify-end p-1">
                <span className="text-[9px] font-mono text-cyan-400/80 bg-black/60 px-1 rounded">
                  Başlık Güvenli (%90)
                </span>
              </div>
              {/* Center Crosshair */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/20 -translate-x-1/2 pointer-events-none" />
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/20 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Playback Controls Footer */}
      <div className="h-12 bg-[#0d1117] border-t border-[#21262d] px-4 flex items-center justify-between text-xs text-gray-300">
        {/* Left: Timecode */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-white font-semibold">{formatTimecode(currentTime, project.fps)}</span>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400">{formatTimecode(project.duration, project.fps)}</span>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2">
          {/* Step Back 1 Frame */}
          <button
            onClick={() => onStepBackward(1 / project.fps)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#161b22] transition-colors"
            title="1 Kare Geri (Sol Ok)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-transform active:scale-95"
            title="Oynat / Duraklat (Boşluk Tuşu)"
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Step Forward 1 Frame */}
          <button
            onClick={() => onStepForward(1 / project.fps)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#161b22] transition-colors"
            title="1 Kare İleri (Sağ Ok)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>

          {/* Loop toggle */}
          <button
            onClick={() => onSetIsLooping(!isLooping)}
            className={`p-1.5 rounded-lg transition-colors ${
              isLooping ? 'text-indigo-400 bg-indigo-950/50' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Döngü (Loop)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Right: Speed & Volume */}
        <div className="flex items-center gap-3">
          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => onSetPlaybackRate(Number(e.target.value))}
            className="bg-[#161b22] border border-[#30363d] text-gray-300 rounded px-1.5 py-1 text-[11px] outline-none"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1.0x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2.0x</option>
          </select>

          {/* Master Volume */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="text-gray-400 hover:text-white"
              title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
            >
              {isMuted || masterVolume === 0 ? (
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : masterVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1 bg-[#21262d] accent-indigo-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
