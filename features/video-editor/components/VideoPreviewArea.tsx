import React, { useRef, useEffect, useState, useCallback } from 'react';
import { VideoProject, VideoClip, Transform2D, TextLayerData } from '../types';
import { renderFrameToCanvas, registerRedrawCallback } from '../engine/previewRenderer';
import { exportEngine } from '../engine/exportEngine';
import { audioMixer } from '../engine/audioMixer';
import { calculateClipBounds, isPointInClip, getGizmoHandleAt, GizmoHandleType } from '../engine/clipBounds';
import { preloadPopularFonts, loadGoogleFont } from '../engine/fontCatalog';
import { useEditorDragDrop, DragPayload } from '../context/DragDropContext';
import { parseTimecode } from '../utils/timecode';
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Repeat,
  Volume2,
  VolumeX,
  Grid,
  Camera,
  Maximize2,
  Sparkles,
  Check,
  X,
  Film,
  FolderOpen,
} from 'lucide-react';

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
  onAddClip?: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  onUpdateClip?: (clipId: string, updates: Partial<VideoClip>) => void;
  onOpenMediaImport?: () => void;
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
  onOpenMediaImport,
  onUpdateClipTransform,
  onSelectClip,
  onUpdateClipText,
  onAddClip,
  onUpdateClip,
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

  // Interactive timecode jumping state
  const [isEditingTimecode, setIsEditingTimecode] = useState(false);
  const [timecodeInput, setTimecodeInput] = useState('');

  const { isDragging, activePayload, endDrag, updateDragPosition, registerDropTarget } = useEditorDragDrop();
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

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
    renderFrameToCanvas(canvas, project, currentTime, selectedClip?.id, isPlaying, undefined, playbackRate).catch((err) => {
      if (isMounted) console.warn('Preview render frame error:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [project, currentTime, selectedClip, isPlaying, playbackRate, renderVersion]);

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

  const handleCanvasDrop = useCallback(
    (payload: DragPayload, clientX: number, clientY: number) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const canvasX = (clickX / rect.width) * project.resolution.width;
      const canvasY = (clickY / rect.height) * project.resolution.height;
      const centerOffsetX = canvasX - project.resolution.width / 2;
      const centerOffsetY = canvasY - project.resolution.height / 2;

      if (payload.type === 'title-template' || payload.type === 'font' || payload.type === 'text-animation') {
        const textTrack = project.tracks.find((t) => t.type === 'text') || project.tracks[0];
        if (textTrack && onAddClip) {
          const rawTextData = payload.data?.textData || payload.data?.metadata?.textData || payload.data?.data || {};
          const resolvedText = rawTextData.text || payload.data?.defaultText || payload.data?.name || payload.name;
          const resolvedFont = rawTextData.fontFamily || (payload.type === 'font' ? (payload.data?.fontFamily || payload.name.replace(/\s+Font$/i, '').trim()) : 'Plus Jakarta Sans');

          if (resolvedFont) {
            loadGoogleFont(resolvedFont).catch(() => {});
          }

          const resolvedTextData: Partial<TextLayerData> = {
            text: resolvedText,
            fontSize: rawTextData.fontSize || 54,
            fontWeight: rawTextData.fontWeight || 'bold',
            color: rawTextData.color || '#ffffff',
            fillColor: rawTextData.fillColor || rawTextData.color || '#ffffff',
            fontFamily: resolvedFont,
            backgroundColor: rawTextData.backgroundColor,
            backgroundOpacity: rawTextData.backgroundOpacity,
            paddingX: rawTextData.paddingX,
            paddingY: rawTextData.paddingY,
            borderRadius: rawTextData.borderRadius,
            strokeColor: rawTextData.strokeColor,
            strokeWidth: rawTextData.strokeWidth,
            shadowColor: rawTextData.shadowColor,
            shadowBlur: rawTextData.shadowBlur,
            shadowOffsetX: rawTextData.shadowOffsetX,
            shadowOffsetY: rawTextData.shadowOffsetY,
            letterSpacing: rawTextData.letterSpacing,
            textAlign: rawTextData.textAlign || 'center',
            alignment: rawTextData.alignment || rawTextData.textAlign || 'center',
            inAnimation: rawTextData.inAnimation,
            inDuration: rawTextData.inDuration,
            outAnimation: rawTextData.outAnimation,
            outDuration: rawTextData.outDuration,
            loopAnimation: rawTextData.loopAnimation,
          };

          const newClip = onAddClip(textTrack.id, {
            name: payload.name,
            type: 'text',
            startTime: currentTime,
            duration: payload.duration || 4.0,
            sourceDuration: payload.duration || 4.0,
            transform: {
              x: centerOffsetX,
              y: centerOffsetY,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
              opacity: 1,
            },
            textData: resolvedTextData as TextLayerData,
          });
          if (newClip) onSelectClip?.(newClip.id);
        }
      } else if (payload.type === 'overlay') {
        const videoTrack = project.tracks.find((t) => t.type === 'video') || project.tracks[0];
        if (videoTrack && onAddClip) {
          const newClip = onAddClip(videoTrack.id, {
            name: payload.name,
            type: 'image',
            startTime: currentTime,
            duration: payload.duration || 4.0,
            sourceDuration: payload.duration || 4.0,
            transform: {
              x: centerOffsetX,
              y: centerOffsetY,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
              opacity: 1,
            },
          });
          if (newClip) onSelectClip?.(newClip.id);
        }
      } else if (payload.type === 'filter-preset') {
        const target =
          selectedClip ||
          project.tracks
            .flatMap((t) => t.clips)
            .find((c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration);
        if (target && payload.data?.effects && onUpdateClip) {
          onUpdateClip(target.id, { effects: payload.data.effects });
        }
      } else if (payload.type === 'transition') {
        const target =
          selectedClip ||
          project.tracks
            .flatMap((t) => t.clips)
            .find((c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration);
        if (target && onUpdateClip) {
          onUpdateClip(target.id, {
            transitionIn: { type: payload.id as any, duration: payload.duration || 1.0 },
          });
        }
      }
      endDrag();
      setIsDragOverCanvas(false);
    },
    [project, currentTime, onAddClip, onSelectClip, selectedClip, onUpdateClip, endDrag]
  );

  // Register canvas drop zone with global DragDropContext
  useEffect(() => {
    return registerDropTarget({
      id: 'canvas',
      getBounds: () => {
        if (!canvasWrapperRef.current) return null;
        return canvasWrapperRef.current.getBoundingClientRect();
      },
      onPointerMove: (e, payload) => {
        setIsDragOverCanvas(true);
        return {
          targetType: 'canvas',
          isValid: true,
          label: `Tuval (${payload.name})`,
        };
      },
      onDrop: async (payload, e) => {
        handleCanvasDrop(payload, e.clientX, e.clientY);
        return true;
      },
      onPointerLeave: () => {
        setIsDragOverCanvas(false);
      },
    });
  }, [registerDropTarget, handleCanvasDrop]);

  const isVertical = project.resolution.height > project.resolution.width;

  return (
    <div className="flex-1 flex flex-col bg-[#0B0D10] overflow-hidden relative select-none">
      {/* Top Preview Status Bar (Compact 30px) */}
      <div className="h-7.5 px-3 flex items-center justify-between border-b border-[#292F39] bg-[#111419] text-xs text-[#929AA8] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono forma-tnum text-[11px] text-[#E7EAF0] font-medium">
            {project.resolution.width} × {project.resolution.height}
          </span>
          <span className="text-[#5A6270] text-[10px]">•</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-[2px] bg-[#171B21] text-[#929AA8] border border-[#292F39] font-mono forma-tnum">
            {project.fps} fps
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-[2px] bg-[#171B21] text-[#929AA8] border border-[#292F39] font-mono">
            {isVertical ? '9:16 Dikey' : '16:9 Yatay'}
          </span>
          {selectedClip && (
            <span className="text-[10px] px-2 py-0.5 rounded-[2px] bg-[#171B21] text-[#E7EAF0] border border-[#292F39] font-medium flex items-center gap-1.5 truncate max-w-[200px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f6bf5]" />
              <span className="truncate">{selectedClip.name}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Safe Zones Toggle */}
          <button
            type="button"
            onClick={() => setShowSafeZones(!showSafeZones)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium border transition-colors ${
              showSafeZones
                ? 'bg-[#202631] text-[#E7EAF0] border-[#4f6bf5]'
                : 'text-[#929AA8] hover:text-[#E7EAF0] border-[#292F39] hover:bg-[#171B21]'
            }`}
            title="Güvenli Alan Kılavuzları"
          >
            <Grid size={11} />
            <span className="hidden sm:inline">Kılavuz</span>
          </button>

          {/* Quick Snapshot */}
          <button
            type="button"
            onClick={handleCaptureSnapshot}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] border border-[#292F39] transition-colors"
            title="Mevcut Kareyi PNG Olarak Kaydet"
          >
            <Camera size={11} />
            <span className="hidden sm:inline">Kareyi Al</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-6 relative overflow-hidden"
      >
        <div
          ref={canvasWrapperRef}
          onPointerMove={(e) => {
            if (!isDragging) return;
            if (canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const clickY = e.clientY - rect.top;
              const canvasX = (clickX / rect.width) * project.resolution.width;
              const canvasY = (clickY / rect.height) * project.resolution.height;
              setIsDragOverCanvas(true);
              updateDragPosition(e.clientX, e.clientY, {
                targetType: 'canvas',
                isValid: true,
                label: `Tuval (${Math.round(canvasX)}, ${Math.round(canvasY)})`,
              });
            }
          }}
          onPointerLeave={() => {
            if (isDragging) setIsDragOverCanvas(false);
          }}
          onPointerUp={(e) => {
            if (isDragging && activePayload) {
              handleCanvasDrop(activePayload, e.clientX, e.clientY);
            }
          }}
          className={`relative shadow-2xl rounded-sm overflow-hidden flex items-center justify-center border transition-all ${
            isDragOverCanvas
              ? 'border-indigo-500 ring-4 ring-indigo-500/50 shadow-indigo-500/30'
              : 'border-[#30363d]'
          }`}
          style={{
            aspectRatio: `${project.resolution.width} / ${project.resolution.height}`,
            maxHeight: '100%',
            maxWidth: '100%',
            backgroundColor: project.backgroundColor || '#000000',
          }}
        >
          <canvas
            ref={canvasRef}
            data-testid="main-preview-canvas"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onDoubleClick={handleCanvasDoubleClick}
            className="w-full h-full object-contain cursor-default"
          />

          {/* Empty State Overlay — UI only, never affects canvas/export */}
          {project.tracks.every(t => t.clips.length === 0) && !isDragOverCanvas && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-auto bg-black/40 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3 p-8 rounded-xl">
                <div className="w-16 h-16 rounded-2xl bg-[#171B21]/80 border border-[#292F39] flex items-center justify-center shadow-lg">
                  <Film size={28} className="text-[#4f6bf5]" />
                </div>
                <h3 className="text-[#E7EAF0] text-base font-semibold tracking-tight">
                  🎬 Kurguya Başlamak İçin Medya Ekleyin
                </h3>
                <p className="text-[#929AA8] text-xs text-center max-w-[280px] leading-relaxed">
                  Sol panelden bir video/stok klip seçin veya bilgisayarınızdan dosya sürükleyin
                </p>
                <button
                  type="button"
                  data-testid="empty-state-import-btn"
                  onClick={() => {
                    if (onOpenMediaImport) {
                      onOpenMediaImport();
                    } else {
                      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                      if (fileInput) fileInput.click();
                    }
                  }}
                  className="mt-1 px-4 py-2 rounded-lg bg-[#4f6bf5] hover:bg-[#3b55d9] text-white text-xs font-semibold shadow-lg transition-colors flex items-center gap-2"
                >
                  <FolderOpen size={14} />
                  <span>📁 Medya İçe Aktar</span>
                </button>
              </div>
            </div>
          )}

          {/* Drag Overlay Indicator */}
          {isDragOverCanvas && (
            <div className="absolute inset-0 border-2 border-dashed border-[#4f6bf5] bg-[#4f6bf5]/10 pointer-events-none flex items-center justify-center z-40">
              <div className="px-3 py-1.5 rounded-[3px] bg-[#111419]/95 border border-[#4f6bf5] text-[#E7EAF0] text-xs font-semibold shadow-2xl flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#4f6bf5]" />
                <span>Öğeyi Bu Konuma Bırak</span>
              </div>
            </div>
          )}

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
              <div className="flex items-center gap-1 mb-1.5 bg-[#111419]/95 px-2 py-1 rounded-[3px] border border-[#4f6bf5] shadow-xl text-[11px]">
                <span className="text-[#4f6bf5] font-semibold text-[10px] mr-1">Metni Düzenle:</span>
                <button
                  type="button"
                  onClick={handleCommitInlineText}
                  className="px-2 py-0.5 rounded-[2px] bg-[#4f6bf5] hover:bg-[#3b55d9] text-white font-medium text-[10px] transition-colors flex items-center gap-1 shadow"
                  title="Değişiklikleri Kaydet (Enter)"
                >
                  <Check size={10} />
                  <span>Tamam</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingClipId(null)}
                  className="p-1 rounded-[2px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] transition-colors"
                  title="İptal (Esc)"
                >
                  <X size={11} />
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

      {/* Playback Controls Footer (Compact 34px NLE bar) */}
      <div className="h-[34px] bg-[#111419] border-t border-[#292F39] px-3 flex items-center justify-between text-xs text-[#929AA8] shrink-0">
        {/* Left: Interactive Monospace Timecode with Direct Jumping & Stepping */}
        <div className="flex items-center gap-1.5 font-mono forma-tnum text-xs">
          {isEditingTimecode ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={timecodeInput}
                onChange={(e) => setTimecodeInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseTimecode(timecodeInput, project.fps);
                  if (parsed !== null) onSeek(Math.min(project.duration, Math.max(0, parsed)));
                  setIsEditingTimecode(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const parsed = parseTimecode(timecodeInput, project.fps);
                    if (parsed !== null) onSeek(Math.min(project.duration, Math.max(0, parsed)));
                    setIsEditingTimecode(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingTimecode(false);
                  }
                }}
                className="w-24 h-5 px-1.5 bg-[#171B21] border border-[#4f6bf5] rounded-[2px] text-white font-mono text-[11px] outline-none"
                placeholder="00:00:00:00"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTimecodeInput(formatTimecode(currentTime, project.fps));
                setIsEditingTimecode(true);
              }}
              className="px-1 py-0.5 rounded-[2px] hover:bg-[#171B21] hover:text-[#4f6bf5] transition-colors flex items-center gap-1 group text-left cursor-text"
              title="Tam zamana atlamak için tıklayın (Örn: 05.20 veya 00:01:10)"
            >
              <span className="text-[#E7EAF0] font-semibold group-hover:text-[#4f6bf5]">
                {formatTimecode(currentTime, project.fps)}
              </span>
            </button>
          )}
          <span className="text-[#5A6270]">/</span>
          <span className="text-[#929AA8]">{formatTimecode(project.duration, project.fps)}</span>

          {/* Quick Step Buttons right beside timecode */}
          <div className="hidden sm:flex items-center gap-0.5 ml-2 border-l border-[#292F39] pl-2 text-[10px]">
            <button
              type="button"
              onClick={() => onStepBackward(1.0)}
              className="px-1 py-0.5 rounded-[2px] text-[#929AA8] hover:text-white hover:bg-[#171B21] transition-colors"
              title="1 Saniye Geri"
            >
              -1s
            </button>
            <button
              type="button"
              onClick={() => onStepBackward(1 / project.fps)}
              className="px-1 py-0.5 rounded-[2px] text-[#929AA8] hover:text-white hover:bg-[#171B21] transition-colors font-medium"
              title="1 Kare Geri"
            >
              -1k
            </button>
            <button
              type="button"
              onClick={() => onStepForward(1 / project.fps)}
              className="px-1 py-0.5 rounded-[2px] text-[#929AA8] hover:text-white hover:bg-[#171B21] transition-colors font-medium"
              title="1 Kare İleri"
            >
              +1k
            </button>
            <button
              type="button"
              onClick={() => onStepForward(1.0)}
              className="px-1 py-0.5 rounded-[2px] text-[#929AA8] hover:text-white hover:bg-[#171B21] transition-colors"
              title="1 Saniye İleri"
            >
              +1s
            </button>
          </div>
        </div>

        {/* Center: Desktop Playback Controls */}
        <div className="flex items-center gap-1">
          {/* Step Back 1 Frame */}
          <button
            type="button"
            onClick={() => onStepBackward(1 / project.fps)}
            className="w-6 h-6 flex items-center justify-center rounded-[3px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] transition-colors"
            title="1 Kare Geri (Sol Ok)"
          >
            <SkipBack size={12} />
          </button>

          {/* Play / Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            className={`w-7 h-7 rounded-[3px] flex items-center justify-center transition-colors select-none ${
              isPlaying
                ? 'bg-[#202631] text-[#f59e0b] border border-[#f59e0b]/40 hover:bg-[#283040]'
                : 'bg-[#4f6bf5] text-white hover:bg-[#3b55d9] border border-[#4f6bf5]/60 shadow-sm'
            }`}
            title="Oynat / Duraklat (Boşluk)"
          >
            {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
          </button>

          {/* Step Forward 1 Frame */}
          <button
            type="button"
            onClick={() => onStepForward(1 / project.fps)}
            className="w-6 h-6 flex items-center justify-center rounded-[3px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] transition-colors"
            title="1 Kare İleri (Sağ Ok)"
          >
            <SkipForward size={12} />
          </button>

          {/* Loop toggle */}
          <button
            type="button"
            onClick={() => onSetIsLooping(!isLooping)}
            className={`w-6 h-6 flex items-center justify-center rounded-[3px] transition-colors ${
              isLooping
                ? 'text-[#4f6bf5] bg-[#171B21] border border-[#4f6bf5]/40'
                : 'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21]'
            }`}
            title="Döngü (Loop)"
          >
            <Repeat size={12} />
          </button>

          {/* Playback speed selector */}
          <div className="flex items-center ml-2 border-l border-[#292F39] pl-2 gap-0.5 font-mono text-[10px]">
            {[1, 1.5, 2, 4].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onSetPlaybackRate(r)}
                className={`px-1.5 py-0.5 rounded-[2px] transition-colors ${
                  playbackRate === r
                    ? 'bg-[#202631] text-[#E7EAF0] font-semibold border border-[#292F39]'
                    : 'text-[#5A6270] hover:text-[#929AA8]'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>

          {/* Active Shuttle Badge (J-K-L) */}
          {isPlaying && (
            <div
              className={`flex items-center gap-1 ml-2 px-2 py-0.5 rounded text-[10px] font-mono font-medium border shadow-sm ${
                playbackRate < 0
                  ? 'bg-amber-950/60 text-amber-300 border-amber-600/70'
                  : playbackRate > 1.0
                  ? 'bg-blue-950/60 text-blue-300 border-blue-600/70'
                  : 'bg-[#171B21] text-[#929AA8] border-[#292F39]'
              }`}
              title="J-K-L Shuttle Kontrolleri: J = Geri Sar / Yavaşlat, K = Duraklat, L = İleri / Hızlandır (1x -> 1.5x -> 2x -> 4x)"
            >
              <span>{playbackRate < 0 ? '◀◀' : playbackRate > 1.0 ? '▶▶' : '▶'}</span>
              <span className="font-bold">{playbackRate > 0 ? `${playbackRate}x` : `${playbackRate}x`}</span>
              <span className="text-[9px] opacity-75">J-K-L</span>
            </div>
          )}
        </div>

        {/* Right: Master Volume Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (isMuted) {
                setIsMuted(false);
                audioMixer.setMasterVolume(masterVolume > 0 ? masterVolume : 1.0);
              } else {
                setIsMuted(true);
                audioMixer.setMasterVolume(0);
              }
            }}
            className="w-6 h-6 flex items-center justify-center text-[#929AA8] hover:text-[#E7EAF0] transition-colors"
            title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {isMuted || masterVolume === 0 ? (
              <VolumeX size={13} className="text-red-400" />
            ) : (
              <Volume2 size={13} />
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
            className="w-14 accent-[#4f6bf5] h-1 cursor-pointer"
            title={`Genel Ses: ${Math.round((isMuted ? 0 : masterVolume) * 100)}%`}
          />
        </div>
      </div>
    </div>
  );
};
