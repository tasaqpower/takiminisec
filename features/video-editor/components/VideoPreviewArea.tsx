import React, { useRef, useEffect, useState, useCallback } from 'react';
import { VideoProject, VideoClip, Transform2D } from '../types';
import { renderFrameToCanvas, registerRedrawCallback } from '../engine/previewRenderer';
import { exportEngine } from '../engine/exportEngine';
import { audioMixer } from '../engine/audioMixer';
import { calculateClipBounds, isPointInClip, getGizmoHandleAt, GizmoHandleType } from '../engine/clipBounds';
import { preloadPopularFonts } from '../engine/fontCatalog';

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
  onSelectClip?: (clipId: string | null) => void;
  onUpdateClipText?: (clipId: string, text: string) => void;
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
  onSelectClip,
  onUpdateClipText,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showSafeZones, setShowSafeZones] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false);
  const dragInfoRef = useRef<{
    mode: GizmoHandleType;
    startCanvasX: number;
    startCanvasY: number;
    initialClipX: number;
    initialClipY: number;
    initialScaleX: number;
    initialScaleY: number;
    initialRotation: number;
    centerX: number;
    centerY: number;
    startAngle: number;
    startDist: number;
    boundsW: number;
    boundsH: number;
  } | null>(null);

  // In-canvas Direct Text Editing
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Preload top typography on mount
  useEffect(() => {
    preloadPopularFonts();
  }, []);

  // Reactive subscription to video decoder ready / seeked events and web font loading
  const [renderVersion, setRenderVersion] = useState(0);
  useEffect(() => {
    const unsubRedraw = registerRedrawCallback(() => {
      setRenderVersion((v) => (v + 1) % 1_000_000);
    });

    const onFontsDone = () => {
      setRenderVersion((v) => (v + 1) % 1_000_000);
    };

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.addEventListener('loadingdone', onFontsDone);
    }

    return () => {
      unsubRedraw();
      if (typeof document !== 'undefined' && document.fonts) {
        document.fonts.removeEventListener('loadingdone', onFontsDone);
      }
    };
  }, []);

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
  }, [project, currentTime, selectedClip, isPlaying, renderVersion]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editingClipId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingClipId]);

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

  // Commit inline text editing
  const handleCommitInlineText = useCallback(() => {
    if (editingClipId && onUpdateClipText) {
      onUpdateClipText(editingClipId, editingText);
    }
    setEditingClipId(null);
  }, [editingClipId, editingText, onUpdateClipText]);

  // Canvas Mouse Down: hit test handles, rotation pin, or clip body
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    // If editing text, commit first
    if (editingClipId) {
      handleCommitInlineText();
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const canvasX = (clickX / rect.width) * project.resolution.width;
    const canvasY = (clickY / rect.height) * project.resolution.height;

    // 1. If currently selected clip has an active gizmo handle or body clicked
    if (selectedClip) {
      const bounds = calculateClipBounds(selectedClip, project.resolution.width, project.resolution.height);
      const handle = getGizmoHandleAt(canvasX, canvasY, bounds);
      if (handle) {
        dragInfoRef.current = {
          mode: handle,
          startCanvasX: canvasX,
          startCanvasY: canvasY,
          initialClipX: selectedClip.transform?.x || 0,
          initialClipY: selectedClip.transform?.y || 0,
          initialScaleX: selectedClip.transform?.scaleX ?? selectedClip.scaleX ?? 1,
          initialScaleY: selectedClip.transform?.scaleY ?? selectedClip.scaleY ?? 1,
          initialRotation: selectedClip.transform?.rotation ?? selectedClip.rotation ?? 0,
          centerX: bounds.centerX,
          centerY: bounds.centerY,
          startAngle: Math.atan2(canvasY - bounds.centerY, canvasX - bounds.centerX),
          startDist: Math.hypot(canvasX - bounds.centerX, canvasY - bounds.centerY),
          boundsW: bounds.width,
          boundsH: bounds.height,
        };
        setIsDraggingGizmo(true);
        if (handle === 'rotate') {
          canvasRef.current.style.cursor = 'grabbing';
        }
        return;
      }
    }

    // 2. Hit test foreground interactive clips to select & start moving
    let clickedClip: VideoClip | null = null;
    for (const track of project.tracks) {
      if (track.muted || track.visible === false || track.type === 'video' || track.type === 'audio') continue;
      for (const clip of track.clips) {
        const start = clip.startTime ?? clip.start ?? 0;
        if (currentTime >= start && currentTime <= start + clip.duration) {
          const bounds = calculateClipBounds(clip, project.resolution.width, project.resolution.height);
          if (isPointInClip(canvasX, canvasY, bounds)) {
            clickedClip = clip;
            break;
          }
        }
      }
      if (clickedClip) break;
    }

    if (clickedClip) {
      onSelectClip?.(clickedClip.id);
      const bounds = calculateClipBounds(clickedClip, project.resolution.width, project.resolution.height);
      dragInfoRef.current = {
        mode: 'move',
        startCanvasX: canvasX,
        startCanvasY: canvasY,
        initialClipX: clickedClip.transform?.x || 0,
        initialClipY: clickedClip.transform?.y || 0,
        initialScaleX: clickedClip.transform?.scaleX ?? clickedClip.scaleX ?? 1,
        initialScaleY: clickedClip.transform?.scaleY ?? clickedClip.scaleY ?? 1,
        initialRotation: clickedClip.transform?.rotation ?? clickedClip.rotation ?? 0,
        centerX: bounds.centerX,
        centerY: bounds.centerY,
        startAngle: Math.atan2(canvasY - bounds.centerY, canvasX - bounds.centerX),
        startDist: Math.hypot(canvasX - bounds.centerX, canvasY - bounds.centerY),
        boundsW: bounds.width,
        boundsH: bounds.height,
      };
      setIsDraggingGizmo(true);
      return;
    }

    // 3. Clicked empty space outside active elements -> DESELECT ALL
    onSelectClip?.(null);
    dragInfoRef.current = null;
    setIsDraggingGizmo(false);
  };

  // Canvas Double Click: activate direct in-canvas text editing
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const canvasX = (clickX / rect.width) * project.resolution.width;
    const canvasY = (clickY / rect.height) * project.resolution.height;

    // Find clicked text clip
    let textClip: VideoClip | null = null;
    for (const track of project.tracks) {
      if (track.type !== 'text' || track.muted || track.visible === false) continue;
      for (const clip of track.clips) {
        const start = clip.startTime ?? clip.start ?? 0;
        if (currentTime >= start && currentTime <= start + clip.duration && clip.textData) {
          const bounds = calculateClipBounds(clip, project.resolution.width, project.resolution.height);
          if (isPointInClip(canvasX, canvasY, bounds)) {
            textClip = clip;
            break;
          }
        }
      }
      if (textClip) break;
    }

    if (!textClip && selectedClip?.type === 'text') {
      textClip = selectedClip;
    }

    if (textClip && textClip.textData) {
      onSelectClip?.(textClip.id);
      setEditingClipId(textClip.id);
      setEditingText(textClip.textData.text || '');
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const canvasX = (clickX / rect.width) * project.resolution.width;
    const canvasY = (clickY / rect.height) * project.resolution.height;

    // A. Active Dragging Operation
    if (isDraggingGizmo && dragInfoRef.current && selectedClip) {
      const info = dragInfoRef.current;

      if (info.mode === 'rotate') {
        const curAngle = Math.atan2(canvasY - info.centerY, canvasX - info.centerX);
        let deltaDeg = ((curAngle - info.startAngle) * 180) / Math.PI;
        let newRot = Math.round((info.initialRotation + deltaDeg) % 360);
        if (newRot < 0) newRot += 360;
        // Snap to cardinal angles (0, 90, 180, 270) if within 4 degrees
        for (const snap of [0, 90, 180, 270, 360]) {
          if (Math.abs(newRot - snap) <= 4) {
            newRot = snap % 360;
            break;
          }
        }
        onUpdateClipTransform(selectedClip.id, { rotation: newRot });
      } else if (info.mode.startsWith('resize')) {
        const curDist = Math.hypot(canvasX - info.centerX, canvasY - info.centerY);
        const scaleRatio = Math.max(0.1, curDist / Math.max(1, info.startDist));
        const newScaleX = Number((info.initialScaleX * scaleRatio).toFixed(3));
        const newScaleY = Number((info.initialScaleY * scaleRatio).toFixed(3));
        onUpdateClipTransform(selectedClip.id, {
          scaleX: Math.max(0.1, Math.min(10, newScaleX)),
          scaleY: Math.max(0.1, Math.min(10, newScaleY)),
        });
      } else if (info.mode === 'move') {
        const deltaX = canvasX - info.startCanvasX;
        const deltaY = canvasY - info.startCanvasY;
        onUpdateClipTransform(selectedClip.id, {
          x: Math.round(info.initialClipX + deltaX),
          y: Math.round(info.initialClipY + deltaY),
        });
      }
      return;
    }

    // B. Idle Hover: dynamic cursor feedback
    if (selectedClip && !isPlaying) {
      const bounds = calculateClipBounds(selectedClip, project.resolution.width, project.resolution.height);
      const handle = getGizmoHandleAt(canvasX, canvasY, bounds);
      if (handle === 'rotate') {
        canvasRef.current.style.cursor = 'grab';
      } else if (handle === 'resize-nw' || handle === 'resize-se') {
        canvasRef.current.style.cursor = 'nwse-resize';
      } else if (handle === 'resize-ne' || handle === 'resize-sw') {
        canvasRef.current.style.cursor = 'nesw-resize';
      } else if (handle === 'resize-n' || handle === 'resize-s') {
        canvasRef.current.style.cursor = 'ns-resize';
      } else if (handle === 'resize-e' || handle === 'resize-w') {
        canvasRef.current.style.cursor = 'ew-resize';
      } else if (handle === 'move') {
        canvasRef.current.style.cursor = 'move';
      } else {
        canvasRef.current.style.cursor = 'default';
      }
    } else {
      canvasRef.current.style.cursor = 'default';
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingGizmo(false);
    dragInfoRef.current = null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  };

  // Find active editing clip
  const editingClip = editingClipId
    ? project.tracks.flatMap((t) => t.clips).find((c) => c.id === editingClipId)
    : null;

  const editingBounds = editingClip
    ? calculateClipBounds(editingClip, project.resolution.width, project.resolution.height)
    : null;

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
            onDoubleClick={handleCanvasDoubleClick}
            className="w-full h-full object-contain cursor-default"
          />

          {/* IN-CANVAS DIRECT TEXT EDITING OVERLAY */}
          {editingClip && editingBounds && editingClip.textData && (
            <div
              className="absolute z-30 flex flex-col items-center"
              style={{
                left: `${(editingBounds.centerX / project.resolution.width) * 100}%`,
                top: `${(editingBounds.centerY / project.resolution.height) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${editingBounds.rotation}deg)`,
                width: `${Math.max(16, (editingBounds.width / project.resolution.width) * 100 * 1.1)}%`,
                minWidth: '220px',
              }}
            >
              {/* Floating Action Controls */}
              <div className="flex items-center gap-1 mb-1.5 bg-[#0d1117]/95 px-2 py-1 rounded-md border border-indigo-500 shadow-xl text-[11px]">
                <span className="text-indigo-400 font-semibold text-[10px] mr-1">Metni Düzenle:</span>
                <button
                  type="button"
                  onClick={handleCommitInlineText}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[10px] transition-colors flex items-center gap-1 shadow"
                  title="Değişiklikleri Kaydet (Enter)"
                >
                  <span>✓</span>
                  <span>Tamam</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingClipId(null)}
                  className="px-1.5 py-0.5 rounded text-gray-400 hover:text-white hover:bg-white/10 text-[10px] transition-colors"
                  title="İptal (Esc)"
                >
                  ✕
                </button>
              </div>

              {/* Editable Textarea Matching Canvas Text Appearance */}
              <textarea
                ref={textareaRef}
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommitInlineText();
                  } else if (e.key === 'Escape') {
                    setEditingClipId(null);
                  }
                }}
                rows={Math.max(2, editingText.split('\n').length)}
                className="w-full p-2.5 rounded-lg border-2 border-indigo-500 bg-[#0d1117]/95 text-white outline-none shadow-2xl resize-none font-medium transition-all"
                style={{
                  fontFamily: editingClip.textData.fontFamily || 'Plus Jakarta Sans, sans-serif',
                  textAlign: editingClip.textData.textAlign || editingClip.textData.alignment || 'center',
                  color: editingClip.textData.fillColor || editingClip.textData.color || '#ffffff',
                }}
                placeholder="Metin girin..."
              />
            </div>
          )}

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

          {/* Playback speed selector */}
          <div className="flex items-center ml-2 border-l border-[#21262d] pl-2 gap-1 text-[11px]">
            {[1, 1.5, 2].map((r) => (
              <button
                key={r}
                onClick={() => onSetPlaybackRate(r)}
                className={`px-1.5 py-0.5 rounded font-mono ${
                  playbackRate === r ? 'bg-[#21262d] text-white font-bold' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Master Volume Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isMuted) {
                setIsMuted(false);
                audioMixer.setMasterVolume(masterVolume > 0 ? masterVolume : 1.0);
              } else {
                setIsMuted(true);
                audioMixer.setMasterVolume(0);
              }
            }}
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
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setMasterVolume(val);
              setIsMuted(val === 0);
              audioMixer.setMasterVolume(val);
            }}
            className="w-16 accent-indigo-500 h-1 cursor-pointer"
            title={`Genel Ses: ${Math.round((isMuted ? 0 : masterVolume) * 100)}%`}
          />
        </div>
      </div>
    </div>
  );
};
