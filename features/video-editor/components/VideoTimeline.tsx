import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  VideoProject,
  TimelineTrack,
  VideoClip,
  TrackType,
  Transition,
  TimelineTransition,
  EffectSegment,
  TextAnimationSegment,
  TransitionType,
} from '../types';
import { TRANSITION_DEFINITIONS } from '../engine/transitionEngine';
import { useEditorDragDrop, DragPayload, DragTargetInfo } from '../context/DragDropContext';
import { generateSfxBlob } from '../engine/sfxGenerator';
import { saveAssetBlob } from '../db';
import {
  Scissors,
  Trash2,
  Copy,
  Plus,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Video,
  Music,
  Type,
  MessageSquare,
  Sparkles,
  Zap,
  Palette,
  Shuffle,
  X,
  Layers,
  ArrowLeftRight,
  ChevronDown,
} from 'lucide-react';
import { TimelineTrackHeader } from './ui/TimelineTrackHeader';

interface TimelineProps {
  project: VideoProject;
  currentTime: number;
  selectedClipId: string | null;
  selectedTransitionId?: string | null;
  selectedEffectSegmentId?: string | null;
  onSelectClip: (clipId: string | null) => void;
  onSelectTransition?: (transitionId: string | null) => void;
  onSelectEffectSegment?: (segmentId: string | null) => void;
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
  onDetachAudio?: (clipId: string) => void;
  onUpdateClipSpeed?: (clipId: string, speed: number) => void;
  onToggleClipMute?: (clipId: string) => void;
  onUpdateClip?: (clipId: string, updates: Partial<VideoClip>) => void;
  onAddClip?: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  onAddTimelineTransition?: (transition: Omit<TimelineTransition, 'id'>) => TimelineTransition;
  onUpdateTimelineTransition?: (id: string, updates: Partial<TimelineTransition>) => void;
  onDeleteTimelineTransition?: (id: string) => void;
  onAddEffectSegment?: (segment: Omit<EffectSegment, 'id' | 'createdAt'>) => EffectSegment;
  onUpdateEffectSegment?: (segmentId: string, updates: Partial<EffectSegment>) => void;
  onDeleteEffectSegment?: (segmentId: string) => void;
  onMoveEffectSegment?: (segmentId: string, newStartTime: number) => void;
  onResizeEffectSegment?: (segmentId: string, newDuration: number) => void;
  onAddTextAnimationSegment?: (clipId: string, segment: Omit<TextAnimationSegment, 'id'>) => TextAnimationSegment;
  onUpdateTextAnimationSegment?: (clipId: string, segmentId: string, updates: Partial<TextAnimationSegment>) => void;
  onDeleteTextAnimationSegment?: (clipId: string, segmentId: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const VideoTimeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  selectedClipId,
  selectedTransitionId,
  selectedEffectSegmentId,
  onSelectClip,
  onSelectTransition,
  onSelectEffectSegment,
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
  onDetachAudio,
  onUpdateClipSpeed,
  onToggleClipMute,
  onUpdateClip,
  onAddClip,
  onAddTimelineTransition,
  onUpdateTimelineTransition,
  onDeleteTimelineTransition,
  onAddEffectSegment,
  onUpdateEffectSegment,
  onDeleteEffectSegment,
  onMoveEffectSegment,
  onResizeEffectSegment,
  onAddTextAnimationSegment,
  onUpdateTextAnimationSegment,
  onDeleteTextAnimationSegment,
  className,
  style,
}) => {
  const [zoom, setZoom] = useState<number>(40); // pixels per second
  const [snapping, setSnapping] = useState<boolean>(true);
  const [isAddTrackMenuOpen, setIsAddTrackMenuOpen] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clip: VideoClip;
    track: TimelineTrack;
  } | null>(null);
  const [transitionMenu, setTransitionMenu] = useState<{
    clipId: string;
    side: 'in' | 'out';
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  // Synchronize vertical scrolling between track headers and timeline lanes
  const handleTimelineScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current && headerScrollRef.current.scrollTop !== e.currentTarget.scrollTop) {
      headerScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  const handleHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop !== e.currentTarget.scrollTop) {
      scrollContainerRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

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

  const { isDragging, activePayload, updateDragPosition, endDrag, registerDropTarget } = useEditorDragDrop();

  const [resizingTransition, setResizingTransition] = useState<{
    transitionId: string;
    initialDuration: number;
    initialMouseX: number;
    edge: 'left' | 'right';
  } | null>(null);

  const [resizingEffect, setResizingEffect] = useState<{
    segmentId: string;
    initialDuration: number;
    initialStartTime: number;
    initialMouseX: number;
    edge: 'left' | 'right';
  } | null>(null);

  const [dropHoverTime, setDropHoverTime] = useState<number | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const [hoveredCutPoint, setHoveredCutPoint] = useState<{
    trackId: string;
    cutTime: number;
    leftClipId?: string;
    rightClipId?: string;
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
      } else if (resizingTransition) {
        const deltaX = e.clientX - resizingTransition.initialMouseX;
        const deltaSec = (resizingTransition.edge === 'right' ? deltaX : -deltaX) / zoom;
        const newDuration = Math.max(0.2, Math.min(5.0, resizingTransition.initialDuration + deltaSec));
        onUpdateTimelineTransition?.(resizingTransition.transitionId, { duration: newDuration });
      } else if (resizingEffect) {
        const deltaX = e.clientX - resizingEffect.initialMouseX;
        const deltaSec = (resizingEffect.edge === 'right' ? deltaX : -deltaX) / zoom;
        const newDuration = Math.max(0.2, resizingEffect.initialDuration + deltaSec);
        onResizeEffectSegment?.(resizingEffect.segmentId, newDuration);
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) setIsScrubbing(false);
      if (draggingClip) setDraggingClip(null);
      if (trimmingClip) setTrimmingClip(null);
      if (resizingTransition) setResizingTransition(null);
      if (resizingEffect) setResizingEffect(null);
    };

    if (isScrubbing || draggingClip || trimmingClip || resizingTransition || resizingEffect) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isScrubbing,
    draggingClip,
    trimmingClip,
    resizingTransition,
    resizingEffect,
    zoom,
    clientXToTime,
    snapTime,
    onSeek,
    onMoveClip,
    onTrimClip,
    onUpdateTimelineTransition,
    onResizeEffectSegment,
    project.duration,
  ]);

  const executeTimelineDrop = useCallback(
    async (payload: DragPayload, clientX: number, clientY: number, altKey = false) => {
      const rawSec = clientXToTime(clientX);
      const dropTime = altKey ? rawSec : snapTime(rawSec);

      // Detect track index from clientY
      let targetTrackId: string | null = null;
      if (scrollContainerRef.current) {
        const rect = scrollContainerRef.current.getBoundingClientRect();
        const relativeY = clientY - rect.top + scrollContainerRef.current.scrollTop - 24;
        const trackIdx = Math.floor(relativeY / 64);
        if (trackIdx >= 0 && trackIdx < project.tracks.length) {
          targetTrackId = project.tracks[trackIdx].id;
        }
      }

      // Detect nearest cut point between two clips
      let nearestCut: { trackId: string; cutTime: number; leftClipId?: string; rightClipId?: string } | null = null;
      let minCutDist = Infinity;
      for (const track of project.tracks) {
        const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
        for (let i = 0; i < sorted.length - 1; i++) {
          const c1 = sorted[i];
          const c2 = sorted[i + 1];
          const c1End = c1.startTime + c1.duration;
          if (Math.abs(c1End - c2.startTime) < 0.4) {
            const dist = Math.abs(dropTime - c1End);
            if (dist < minCutDist && dist < Math.max(1.8, 60 / zoom)) {
              minCutDist = dist;
              nearestCut = {
                trackId: track.id,
                cutTime: c1End,
                leftClipId: c1.id,
                rightClipId: c2.id,
              };
            }
          }
        }
      }

      // Detect clip at dropTime
      let hitClip: VideoClip | null = null;
      for (const track of project.tracks) {
        for (const clip of track.clips) {
          if (dropTime >= clip.startTime && dropTime <= clip.startTime + clip.duration) {
            hitClip = clip;
            if (!targetTrackId) targetTrackId = track.id;
            break;
          }
        }
        if (hitClip) break;
      }

      // If no hit clip, find closest clip within 2.5 seconds
      if (!hitClip && !nearestCut) {
        let minClipDist = Infinity;
        for (const track of project.tracks) {
          for (const clip of track.clips) {
            const distStart = Math.abs(dropTime - clip.startTime);
            const distEnd = Math.abs(dropTime - (clip.startTime + clip.duration));
            const d = Math.min(distStart, distEnd);
            if (d < minClipDist && d < 2.5) {
              minClipDist = d;
              hitClip = clip;
              if (!targetTrackId) targetTrackId = track.id;
            }
          }
        }
      }

      setDropHoverTime(null);
      setHoveredCutPoint(null);
      setHoveredClipId(null);
      setHoveredTrackId(null);

      if (payload.type === 'transition') {
        const cut = hoveredCutPoint || nearestCut;
        if (cut && onAddTimelineTransition) {
          onAddTimelineTransition({
            trackId: cut.trackId,
            type: payload.id as TransitionType,
            duration: payload.duration || 1.0,
            cutTime: cut.cutTime,
            leftClipId: cut.leftClipId,
            rightClipId: cut.rightClipId,
            alignment: 'between',
          });
        } else {
          const target =
            hitClip ||
            (hoveredClipId ? project.tracks.flatMap((t) => t.clips).find((c) => c.id === hoveredClipId) : null) ||
            project.tracks.flatMap((t) => t.clips)[0];
          if (target && onUpdateClip) {
            onUpdateClip(target.id, {
              transitionIn: { type: payload.id as TransitionType, duration: payload.duration || 1.0 },
            });
          }
        }
      } else if (payload.type === 'video-effect') {
        const target =
          hitClip ||
          (hoveredClipId ? project.tracks.flatMap((t) => t.clips).find((c) => c.id === hoveredClipId) : null);
        if (target && onAddEffectSegment) {
          onAddEffectSegment({
            effectId: payload.id,
            effectKind: payload.category as any,
            name: payload.name,
            targetClipId: target.id,
            startTime: target.startTime,
            duration: Math.min(payload.duration || 3.0, target.duration),
            parameters: {},
            enabled: true,
          });
        } else if (onAddEffectSegment) {
          const videoTrack =
            project.tracks.find((t) => t.id === targetTrackId && t.type === 'video') ||
            project.tracks.find((t) => t.type === 'video') ||
            project.tracks[0];
          if (videoTrack) {
            onAddEffectSegment({
              effectId: payload.id,
              effectKind: payload.category as any,
              name: payload.name,
              trackId: videoTrack.id,
              startTime: dropTime,
              duration: payload.duration || 3.0,
              parameters: {},
              enabled: true,
            });
          }
        }
      } else if (payload.type === 'text-animation') {
        const target =
          hitClip ||
          (hoveredClipId ? project.tracks.flatMap((t) => t.clips).find((c) => c.id === hoveredClipId) : null);
        if (target && (target.type === 'text' || target.type === 'subtitle')) {
          if (onAddTextAnimationSegment) {
            onAddTextAnimationSegment(target.id, {
              type: payload.category as any,
              animationName: payload.id,
              startTime: 0,
              duration: payload.duration || 0.8,
            });
          }
        } else if (onAddClip) {
          const textTrack = project.tracks.find((t) => t.type === 'text') || project.tracks[0];
          if (textTrack) {
            const newClip = onAddClip(textTrack.id, {
              name: payload.name,
              type: 'text',
              startTime: dropTime,
              duration: 4.0,
              sourceDuration: 4.0,
              textData: {
                text: 'Yeni Metin',
                fontSize: 54,
                fontWeight: 'bold',
                color: '#ffffff',
                inAnimation: payload.category === 'in' ? (payload.id as any) : undefined,
                inDuration: payload.category === 'in' ? payload.duration || 0.8 : undefined,
                loopAnimation: payload.category === 'loop' ? (payload.id as any) : undefined,
                outAnimation: payload.category === 'out' ? (payload.id as any) : undefined,
                outDuration: payload.category === 'out' ? payload.duration || 0.8 : undefined,
              },
            });
            if (newClip) onSelectClip?.(newClip.id);
          }
        }
      } else if (payload.type === 'filter-preset') {
        const target =
          hitClip ||
          (hoveredClipId ? project.tracks.flatMap((t) => t.clips).find((c) => c.id === hoveredClipId) : null) ||
          (selectedClipId ? project.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId) : null) ||
          project.tracks.flatMap((t) => t.clips)[0];
        if (target && payload.data?.effects && onUpdateClip) {
          onUpdateClip(target.id, { effects: payload.data.effects });
        }
      } else if (payload.type === 'audio-sfx') {
        const audioTrack =
          project.tracks.find((t) => t.id === targetTrackId && t.type === 'audio') ||
          project.tracks.find((t) => t.type === 'audio') ||
          project.tracks[0];
        if (audioTrack && onAddClip) {
          try {
            const blob = await generateSfxBlob(payload.id as any);
            const assetId = 'asset-sfx-' + payload.id + '-' + Date.now();
            await saveAssetBlob(assetId, blob);
            const url = URL.createObjectURL(blob);
            onAddClip(audioTrack.id, {
              assetId,
              sourceUrl: url,
              name: payload.name,
              type: 'audio',
              startTime: dropTime,
              duration: payload.duration || 3.0,
              sourceDuration: payload.duration || 3.0,
              volume: 0.9,
            });
          } catch (err) {
            console.warn('Failed to add SFX on drop:', err);
          }
        }
      } else if (payload.type === 'title-template') {
        const textTrack =
          project.tracks.find((t) => t.id === targetTrackId && t.type === 'text') ||
          project.tracks.find((t) => t.type === 'text') ||
          project.tracks[0];
        if (textTrack && onAddClip) {
          const newClip = onAddClip(textTrack.id, {
            name: payload.name,
            type: 'text',
            startTime: dropTime,
            duration: payload.duration || 4.0,
            sourceDuration: payload.duration || 4.0,
            textData: {
              text: payload.data?.text || payload.name,
              fontSize: payload.data?.data?.fontSize || 54,
              fontWeight: payload.data?.data?.fontWeight || 'bold',
              color: '#ffffff',
              ...payload.data?.data,
            },
          });
          if (newClip) onSelectClip?.(newClip.id);
        }
      } else if (payload.type === 'overlay') {
        const videoTrack =
          project.tracks.find((t) => t.id === targetTrackId && t.type === 'video') ||
          project.tracks.find((t) => t.type === 'video') ||
          project.tracks[0];
        if (videoTrack && onAddClip) {
          const newClip = onAddClip(videoTrack.id, {
            name: payload.name,
            type: 'image',
            startTime: dropTime,
            duration: payload.duration || 4.0,
            sourceDuration: payload.duration || 4.0,
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          });
          if (newClip) onSelectClip?.(newClip.id);
        }
      } else if (payload.type === 'video' || payload.type === 'audio' || payload.type === 'image') {
        const targetType = payload.type === 'audio' ? 'audio' : 'video';
        const targetTrack =
          project.tracks.find((t) => t.id === targetTrackId) ||
          project.tracks.find((t) => t.type === targetType) ||
          project.tracks[0];
        if (targetTrack && onAddClip) {
          const newClip = onAddClip(targetTrack.id, {
            assetId: payload.id,
            name: payload.name,
            type: payload.type,
            sourceUrl: payload.data?.url || (payload.data?.blob ? URL.createObjectURL(payload.data.blob) : undefined),
            startTime: dropTime,
            duration: payload.duration || (payload.type === 'image' ? 4 : 5),
            sourceDuration: payload.duration || (payload.type === 'image' ? 4 : 5),
            trimIn: 0,
            trimOut: payload.duration || (payload.type === 'image' ? 4 : 5),
          });
          if (newClip) onSelectClip?.(newClip.id);
        }
      }
    },
    [
      clientXToTime,
      snapTime,
      zoom,
      project.tracks,
      hoveredCutPoint,
      hoveredClipId,
      selectedClipId,
      onAddTimelineTransition,
      onUpdateClip,
      onAddEffectSegment,
      onAddTextAnimationSegment,
      onAddClip,
      onSelectClip,
    ]
  );

  // Register timeline drop zone with global DragDropContext
  useEffect(() => {
    return registerDropTarget({
      id: 'timeline',
      getBounds: () => {
        if (!containerRef.current) return null;
        return containerRef.current.getBoundingClientRect();
      },
      onPointerMove: (e, payload) => {
        const mouseSec = clientXToTime(e.clientX);
        const snappedSec = snapTime(mouseSec);
        setDropHoverTime(snappedSec);

        let detectedCut: { trackId: string; cutTime: number; leftClipId?: string; rightClipId?: string } | null = null;
        let detectedClip: string | null = null;
        let detectedTrack: string | null = null;

        if (scrollContainerRef.current) {
          const rect = scrollContainerRef.current.getBoundingClientRect();
          const relativeY = e.clientY - rect.top + scrollContainerRef.current.scrollTop - 24;
          const trackIdx = Math.floor(relativeY / 64);
          if (trackIdx >= 0 && trackIdx < project.tracks.length) {
            detectedTrack = project.tracks[trackIdx].id;
          }
        }

        for (const track of project.tracks) {
          const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
          for (let i = 0; i < sorted.length - 1; i++) {
            const c1 = sorted[i];
            const c2 = sorted[i + 1];
            const c1End = c1.startTime + c1.duration;
            if (Math.abs(c1End - c2.startTime) < 0.4) {
              if (Math.abs(mouseSec - c1End) < Math.max(0.4, 40 / zoom)) {
                detectedCut = {
                  trackId: track.id,
                  cutTime: c1End,
                  leftClipId: c1.id,
                  rightClipId: c2.id,
                };
                break;
              }
            }
          }
          if (detectedCut) break;
        }

        if (!detectedCut) {
          for (const track of project.tracks) {
            for (const clip of track.clips) {
              if (mouseSec >= clip.startTime && mouseSec <= clip.startTime + clip.duration) {
                detectedClip = clip.id;
                detectedTrack = track.id;
                break;
              }
            }
            if (detectedClip) break;
          }
        }

        setHoveredCutPoint(detectedCut);
        setHoveredClipId(detectedClip);
        setHoveredTrackId(detectedTrack);

        let targetType: DragTargetInfo['targetType'] = 'track';
        let label = 'Zaman Çizgisine Ekle';
        let isValid = true;

        if (payload.type === 'transition') {
          if (detectedCut) {
            targetType = 'cut-point';
            label = 'Kesim Noktasına Geçiş (Papyon)';
          } else if (detectedClip) {
            targetType = 'clip';
            label = 'Klibe Giriş Geçişi Uygula';
          } else {
            targetType = 'track';
            label = 'En Yakın Klibe Geçiş Ekle';
          }
        } else if (payload.type === 'video-effect') {
          if (detectedClip) {
            targetType = 'clip';
            label = 'Klibe Efekt Ekle';
          } else {
            targetType = 'track';
            label = 'Efekt Şeridi Ekle';
          }
        } else if (payload.type === 'text-animation') {
          if (detectedClip) {
            targetType = 'clip';
            label = 'Metne Animasyon Ekle';
          } else {
            targetType = 'track';
            label = 'Yeni Animasyonlu Metin Ekle';
          }
        } else if (payload.type === 'filter-preset') {
          targetType = detectedClip ? 'clip' : 'track';
          label = detectedClip ? 'Filtreyi Klibe Uygula' : 'Filtre Ekle';
        } else if (payload.type === 'audio-sfx') {
          targetType = 'track';
          label = 'Ses Efekti (SFX) Ekle';
        } else if (payload.type === 'title-template') {
          targetType = 'track';
          label = 'Başlık Şablonu Ekle';
        } else if (payload.type === 'overlay') {
          targetType = 'track';
          label = 'Öğe Ekle';
        } else if (payload.type === 'video' || payload.type === 'audio' || payload.type === 'image' || payload.type === 'media') {
          targetType = 'track';
          label = 'Medyayı İze Yerleştir';
        }

        return {
          targetType,
          isValid,
          time: snappedSec,
          label,
          trackId: detectedTrack || undefined,
          clipId: detectedClip || undefined,
        };
      },
      onDrop: async (payload, e) => {
        await executeTimelineDrop(payload, e.clientX, e.clientY, e.altKey);
        return true;
      },
      onPointerLeave: () => {
        setDropHoverTime(null);
        setHoveredCutPoint(null);
        setHoveredClipId(null);
        setHoveredTrackId(null);
      },
    });
  }, [registerDropTarget, executeTimelineDrop, clientXToTime, snapTime, zoom, project.tracks]);

  // Close context menu on external click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

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
      data-testid="video-timeline"
      style={style}
      className={`bg-[#0a0c10] border-t border-[#191d26] flex flex-col select-none shrink-0 z-10 ${
        className || 'h-72'
      }`}
    >
      {/* Timeline Action Toolbar */}
      <div className="h-[34px] px-3 border-b border-[#292F39] bg-[#111419] flex items-center justify-between text-xs shrink-0 select-none">
        {/* Left operations */}
        <div className="flex items-center gap-1.5">
          {/* Split / Böl Button */}
          <button
            type="button"
            onClick={() => {
              if (selectedClipId) {
                onSplitClip(selectedClipId, currentTime);
              }
            }}
            disabled={!selectedClipId}
            className={`h-6 px-2 rounded-[3px] flex items-center gap-1 border transition-colors ${
              selectedClipId
                ? 'bg-[#171B21] text-[#E7EAF0] border-[#292F39] hover:border-[#4f6bf5] hover:bg-[#202631]'
                : 'text-[#5A6270] border-transparent cursor-not-allowed opacity-50'
            }`}
            title="Klibi Oynatma Çizgisinden İkiye Böl (S)"
          >
            <Scissors size={12} className="text-[#4f6bf5]" />
            <span className="font-semibold text-xs">Böl (S)</span>
          </button>

          {/* Ripple Delete Button */}
          <button
            type="button"
            onClick={() => {
              if (selectedClipId) onRippleDeleteClip(selectedClipId);
            }}
            disabled={!selectedClipId}
            className={`h-6 px-2 rounded-[3px] flex items-center gap-1 border transition-colors ${
              selectedClipId
                ? 'bg-[#171B21] text-[#f59e0b] border-[#f59e0b]/40 hover:bg-[#202631]'
                : 'text-[#5A6270] border-transparent cursor-not-allowed opacity-50'
            }`}
            title="Boşluksuz Sil (Shift+Delete)"
          >
            <ArrowLeftRight size={12} className="text-[#f59e0b]" />
            <span className="text-[11px] font-medium">Boşluksuz Sil</span>
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => {
              if (selectedClipId) onDeleteClip(selectedClipId);
            }}
            disabled={!selectedClipId}
            className={`h-6 w-6 rounded-[3px] border flex items-center justify-center transition-colors ${
              selectedClipId
                ? 'bg-[#171B21] text-[#929AA8] border-[#292F39] hover:border-[#f87171] hover:text-[#f87171] hover:bg-[#202631]'
                : 'text-[#5A6270] border-transparent cursor-not-allowed opacity-50'
            }`}
            title="Seçili Klibi Sil (Delete)"
          >
            <Trash2 size={12} />
          </button>

          {/* Duplicate Button */}
          <button
            type="button"
            onClick={() => {
              if (selectedClipId) onDuplicateClip(selectedClipId);
            }}
            disabled={!selectedClipId}
            className={`h-6 w-6 rounded-[3px] border flex items-center justify-center transition-colors ${
              selectedClipId
                ? 'bg-[#171B21] text-[#929AA8] border-[#292F39] hover:border-[#4f6bf5] hover:text-[#E7EAF0] hover:bg-[#202631]'
                : 'text-[#5A6270] border-transparent cursor-not-allowed opacity-50'
            }`}
            title="Kopyasını Oluştur (Ctrl+D)"
          >
            <Copy size={12} />
          </button>

          <div className="h-4 w-[1px] bg-[#292F39] mx-1" />

          {/* Add Track Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddTrackMenuOpen((prev) => !prev)}
              className="h-6 px-2 rounded-[3px] text-[11px] font-medium bg-[#171B21] text-[#E7EAF0] hover:bg-[#202631] border border-[#292F39] hover:border-[#4f6bf5] transition-colors flex items-center gap-1"
            >
              <Plus size={12} className="text-[#4f6bf5]" />
              <span>Kanal Ekle</span>
              <ChevronDown size={10} className="text-[#929AA8]" />
            </button>

            {isAddTrackMenuOpen && (
              <div className="absolute left-0 bottom-full mb-1 w-36 bg-[#171B21] border border-[#292F39] rounded-[3px] shadow-2xl py-1 z-50">
                <button
                  type="button"
                  onClick={() => {
                    onAddTrack('video');
                    setIsAddTrackMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs text-[#E7EAF0] hover:bg-[#202631] flex items-center gap-2 transition-colors"
                >
                  <Video size={12} className="text-[#6ba1df]" />
                  <span>Video Kanalı</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddTrack('audio');
                    setIsAddTrackMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs text-[#E7EAF0] hover:bg-[#202631] flex items-center gap-2 transition-colors"
                >
                  <Music size={12} className="text-[#4ade94]" />
                  <span>Ses Kanalı</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddTrack('text');
                    setIsAddTrackMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs text-[#E7EAF0] hover:bg-[#202631] flex items-center gap-2 transition-colors"
                >
                  <Type size={12} className="text-[#c084fc]" />
                  <span>Metin Kanalı</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right operations: Snapping & Zoom */}
        <div className="flex items-center gap-2.5">
          {/* Snapping */}
          <button
            type="button"
            onClick={() => setSnapping(!snapping)}
            className={`h-6 flex items-center gap-1.5 px-2 rounded-[3px] text-[11px] font-medium border transition-colors ${
              snapping
                ? 'bg-[#202631] text-[#E7EAF0] border-[#4f6bf5]'
                : 'text-[#929AA8] border-[#292F39] hover:text-[#E7EAF0] bg-[#171B21]'
            }`}
            title="Mıknatıs / Yapışma (N)"
          >
            <Magnet size={12} className={snapping ? 'text-[#4f6bf5]' : 'text-[#929AA8]'} />
            <span>Mıknatıs</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(15, z - 10))}
              className="w-6 h-6 rounded-[3px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] flex items-center justify-center transition-colors"
              title="Uzaklaş (-)"
            >
              <ZoomOut size={12} />
            </button>
            <input
              type="range"
              min="15"
              max="150"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="w-20 h-1 bg-[#1C212A] accent-[#4f6bf5] rounded cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="w-6 h-6 rounded-[3px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] flex items-center justify-center transition-colors"
              title="Yakınlaş (+)"
            >
              <ZoomIn size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Multi-track area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Fixed: Track Headers (160px Desktop NLE standard) */}
        <div className="w-[160px] bg-[#111419] border-r border-[#292F39] flex flex-col shrink-0 select-none">
          {/* Header spacer corresponding to ruler */}
          <div className="h-6 border-b border-[#292F39] bg-[#111419] px-2.5 flex items-center justify-between text-[10px] text-[#929AA8] font-semibold uppercase">
            <div className="flex items-center gap-1.5">
              <Layers size={11} className="text-[#929AA8]" />
              <span>Kanallar</span>
            </div>
            <span className="font-mono text-[#929AA8] bg-[#171B21] px-1 rounded-[2px] text-[9px]">
              {project.tracks.length}
            </span>
          </div>

          {/* Track Headers List */}
          <div
            ref={headerScrollRef}
            onScroll={handleHeaderScroll}
            className="flex-1 overflow-y-auto no-scrollbar"
          >
            {project.tracks.map((track, index) => (
              <TimelineTrackHeader
                key={track.id}
                id={track.id}
                name={track.name}
                type={track.type}
                index={index}
                isMuted={track.muted}
                isLocked={track.locked}
                isHidden={track.isHidden ?? false}
                clipCount={track.clips.length}
                onToggleMute={() => onToggleTrackMute(track.id)}
                onToggleLock={() => onToggleTrackLock(track.id)}
                onToggleVisibility={() => onToggleTrackVisibility(track.id)}
                onDeleteTrack={() => onDeleteTrack(track.id)}
              />
            ))}
          </div>
        </div>

        {/* Right Scrollable: Ruler & Track Lanes & Playhead */}
        <div
          ref={scrollContainerRef}
          data-timeline-scroll-container="true"
          onPointerMove={(e) => {
            if (!isDragging) return;
            if (scrollContainerRef.current) {
              const rect = scrollContainerRef.current.getBoundingClientRect();
              if (e.clientX - rect.left < 60) {
                scrollContainerRef.current.scrollLeft -= 12;
              } else if (rect.right - e.clientX < 60) {
                scrollContainerRef.current.scrollLeft += 12;
              }
            }

            const mouseSec = clientXToTime(e.clientX);
            const snappedSec = snapTime(mouseSec);
            setDropHoverTime(snappedSec);

            // Cut point detection
            let detectedCut: { trackId: string; cutTime: number; leftClipId?: string; rightClipId?: string } | null = null;
            let detectedClip: string | null = null;
            let detectedTrack: string | null = null;

            if (scrollContainerRef.current) {
              const rect = scrollContainerRef.current.getBoundingClientRect();
              const relativeY = e.clientY - rect.top + scrollContainerRef.current.scrollTop - 24;
              const trackIdx = Math.floor(relativeY / 64);
              if (trackIdx >= 0 && trackIdx < project.tracks.length) {
                detectedTrack = project.tracks[trackIdx].id;
              }
            }

            for (const track of project.tracks) {
              const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
              for (let i = 0; i < sorted.length - 1; i++) {
                const c1 = sorted[i];
                const c2 = sorted[i + 1];
                const c1End = c1.startTime + c1.duration;
                if (Math.abs(c1End - c2.startTime) < 0.35) {
                  if (Math.abs(mouseSec - c1End) < Math.max(0.35, 35 / zoom)) {
                    detectedCut = {
                      trackId: track.id,
                      cutTime: c1End,
                      leftClipId: c1.id,
                      rightClipId: c2.id,
                    };
                    break;
                  }
                }
              }
              if (detectedCut) break;
            }

            if (!detectedCut) {
              for (const track of project.tracks) {
                for (const clip of track.clips) {
                  if (mouseSec >= clip.startTime && mouseSec <= clip.startTime + clip.duration) {
                    detectedClip = clip.id;
                    break;
                  }
                }
                if (detectedClip) break;
              }
            }

            setHoveredCutPoint(detectedCut);
            setHoveredClipId(detectedClip);
            setHoveredTrackId(detectedTrack);

            let isValid = true;
            if (activePayload?.type === 'transition') {
              isValid = Boolean(detectedCut || detectedClip);
            } else if (activePayload?.type === 'video-effect') {
              isValid = Boolean(detectedClip || detectedTrack);
            } else if (activePayload?.type === 'text-animation') {
              const targetClip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === detectedClip);
              isValid = Boolean(targetClip && (targetClip.type === 'text' || targetClip.type === 'subtitle'));
            } else if (activePayload?.type === 'filter-preset') {
              isValid = Boolean(detectedClip);
            }

            updateDragPosition(e.clientX, e.clientY, isValid);
          }}
          onPointerUp={(e) => {
            if (isDragging && activePayload) {
              executeTimelineDrop(activePayload, e.clientX, e.clientY, e.altKey);
            }
          }}
          onPointerLeave={() => {
            if (isDragging) {
              setDropHoverTime(null);
              setHoveredCutPoint(null);
              setHoveredClipId(null);
            }
          }}
          onScroll={handleTimelineScroll}
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

            {/* Drag Drop Hover Line Indicator */}
            {isDragging && dropHoverTime !== null && (
              <div
                style={{ left: `${dropHoverTime * zoom}px` }}
                className="absolute top-0 bottom-0 w-[2px] z-50 pointer-events-none transition-all duration-75"
              >
                <div
                  className={`h-full w-full shadow-lg ${
                    activePayload?.type === 'transition' && !hoveredCutPoint && !hoveredClipId
                      ? 'bg-red-500 shadow-red-500/80'
                      : 'bg-emerald-400 shadow-emerald-400/80'
                  }`}
                />
                <div className="absolute top-7 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#13161c] border border-[#202531] text-[10px] font-mono font-medium text-white shadow-xl flex items-center gap-1.5 whitespace-nowrap">
                  {hoveredCutPoint ? (
                    <>
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Kesim Noktası</span>
                    </>
                  ) : (
                    <span>{dropHoverTime.toFixed(2)}s</span>
                  )}
                </div>
              </div>
            )}

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
                    const isAdjacentToHoveredCut = Boolean(
                      isDragging &&
                      activePayload?.type === 'transition' &&
                      hoveredCutPoint &&
                      (hoveredCutPoint.leftClipId === clip.id || hoveredCutPoint.rightClipId === clip.id)
                    );
                    const left = clip.startTime * zoom;
                    const width = Math.max(20, clip.duration * zoom);

                    // Desaturated Desktop NLE Track Colors
                    let bgStyle = 'bg-[#141c27] border-[#25364e] text-[#93c5fd]';
                    if (clip.type === 'audio') {
                      bgStyle = 'bg-[#12241b] border-[#1d4430] text-[#86efac]';
                    } else if (clip.type === 'text' || clip.type === 'subtitle') {
                      bgStyle = 'bg-[#211626] border-[#42254e] text-[#d8b4fe]';
                    } else if (clip.type === 'image') {
                      bgStyle = 'bg-[#1c1d24] border-[#2f3340] text-[#cbd5e1]';
                    }

                    return (
                      <div
                        key={clip.id}
                        data-clip-id={clip.id}
                        data-clip-type={clip.type}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip.id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onSelectClip(clip.id);
                          setContextMenu({
                            x: Math.min(window.innerWidth - 230, e.clientX),
                            y: Math.min(window.innerHeight - 320, e.clientY),
                            clip,
                            track,
                          });
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
                        className={`absolute top-1.5 bottom-1.5 rounded-[3px] border flex items-center justify-between px-2 cursor-grab active:cursor-grabbing overflow-hidden group select-none transition-shadow ${bgStyle} ${
                          isSelected
                            ? 'ring-1 ring-[#4f6bf5] border-[#4f6bf5] shadow-md z-20'
                            : isAdjacentToHoveredCut
                            ? 'ring-2 ring-amber-400 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)] z-20 brightness-110'
                            : 'hover:brightness-110 z-10'
                        }`}
                      >
                        {/* 1. Background Visuals: Audio Waveform, Video Filmstrip, or Text Preview */}
                        {clip.type === 'audio' && (
                          <div className="absolute inset-0 opacity-45 pointer-events-none flex items-center overflow-hidden px-1 z-0">
                            <svg className="w-full h-8" preserveAspectRatio="none" viewBox="0 0 100 32">
                              {Array.from({ length: 48 }).map((_, i) => {
                                const seed = (clip.id.charCodeAt(clip.id.length - 1) || 1) * 31 + i * 17;
                                const heightRatio = 0.2 + 0.8 * Math.abs(Math.sin(seed * 0.45));
                                const barH = Math.max(3, heightRatio * 28);
                                const y = (32 - barH) / 2;
                                return (
                                  <rect
                                    key={i}
                                    x={i * 2.08}
                                    y={y}
                                    width={1.4}
                                    height={barH}
                                    rx={0.6}
                                    fill="#34d399"
                                  />
                                );
                              })}
                            </svg>
                          </div>
                        )}

                        {clip.type === 'video' && (
                          <>
                            {/* Filmstrip Sprockets Top & Bottom */}
                            <div className="absolute top-0 left-0 right-0 h-[5px] forma-filmstrip-sprockets opacity-40 z-10 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 right-0 h-[5px] forma-filmstrip-sprockets opacity-40 z-10 pointer-events-none" />

                            {/* Repeated Thumbnail Cards */}
                            {clip.sourceUrl ? (
                              <div className="absolute inset-0 opacity-25 pointer-events-none overflow-hidden flex z-0">
                                {Array.from({ length: Math.max(1, Math.ceil(width / 64)) }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="h-full w-[64px] shrink-0 bg-cover bg-center border-r border-black/40"
                                    style={{
                                      backgroundImage: `url(${clip.sourceUrl})`,
                                      backgroundColor: '#0f172a',
                                    }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden flex z-0">
                                {Array.from({ length: Math.max(1, Math.ceil(width / 64)) }).map((_, i) => (
                                  <div key={i} className="h-full w-[64px] shrink-0 border-r border-[#25364e]" />
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {/* Text Preview Snippet */}
                        {(clip.type === 'text' || clip.type === 'subtitle') && clip.textData?.text && (
                          <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center px-3 z-0 overflow-hidden">
                            <span className="text-[10px] font-sans italic truncate text-[#d8b4fe]">
                              &ldquo;{clip.textData.text}&rdquo;
                            </span>
                          </div>
                        )}

                        {/* 2. Transition Badges (Compact Corner Indicators) */}
                        {clip.transitionIn && clip.transitionIn.type !== 'cut' && clip.transitionIn.type !== 'none' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id);
                              setTransitionMenu({
                                clipId: clip.id,
                                side: 'in',
                                x: Math.min(window.innerWidth - 290, e.clientX),
                                y: Math.max(20, e.clientY - 220),
                              });
                            }}
                            className="absolute left-1 top-1 z-20 w-4 h-4 rounded-[2px] bg-amber-500/80 hover:bg-amber-400 text-black flex items-center justify-center shadow transition-transform active:scale-95 cursor-pointer"
                            title={`Giriş: ${clip.transitionIn.type} (${clip.transitionIn.duration}s)`}
                          >
                            <Shuffle className="w-2.5 h-2.5 text-black" />
                          </button>
                        )}

                        {clip.transitionOut && clip.transitionOut.type !== 'cut' && clip.transitionOut.type !== 'none' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id);
                              setTransitionMenu({
                                clipId: clip.id,
                                side: 'out',
                                x: Math.min(window.innerWidth - 290, e.clientX),
                                y: Math.max(20, e.clientY - 220),
                              });
                            }}
                            className="absolute right-1 top-1 z-20 w-4 h-4 rounded-[2px] bg-amber-500/80 hover:bg-amber-400 text-black flex items-center justify-center shadow transition-transform active:scale-95 cursor-pointer"
                            title={`Çıkış: ${clip.transitionOut.type} (${clip.transitionOut.duration}s)`}
                          >
                            <Shuffle className="w-2.5 h-2.5 text-black" />
                          </button>
                        )}

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
                          className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/30 cursor-ew-resize flex items-center justify-center z-20 group/handle"
                          title="Başlangıcı Kırp"
                        >
                          <div className="w-[1.5px] h-3.5 bg-white/40 group-hover/handle:bg-white/90 rounded-[0.5px]" />
                        </div>

                        {/* Clip Content Label & Visuals */}
                        <div className="flex-1 min-w-0 mx-2 pointer-events-none flex flex-col justify-center relative z-10">
                          <p className="text-xs font-semibold truncate text-[#E7EAF0] drop-shadow-sm flex items-center gap-1">
                            {clip.muted && (
                              <span title="Sessize Alındı" className="inline-flex items-center">
                                <VolumeX className="w-3 h-3 text-red-400 shrink-0" />
                              </span>
                            )}
                            <span>{clip.name}</span>
                          </p>
                          <p className="text-[9px] text-[#929AA8] font-mono truncate">
                            {clip.duration.toFixed(1)} sn
                            {clip.speed && clip.speed !== 1 ? ` • ${clip.speed}x` : ''}
                          </p>

                          {/* Text Animation Badges */}
                          {clip.animationSegments && clip.animationSegments.length > 0 && (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap z-20 pointer-events-auto">
                              {clip.animationSegments.map((anim) => (
                                <span
                                  key={anim.id}
                                  className={`px-1 py-0.2 rounded text-[8px] font-bold flex items-center gap-1 shadow-sm border ${
                                    anim.type === 'in'
                                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60'
                                      : anim.type === 'loop'
                                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60'
                                      : 'bg-amber-950/80 text-amber-300 border-amber-500/60'
                                  }`}
                                  title={`${anim.type.toUpperCase()}: ${anim.animationName}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      anim.type === 'in'
                                        ? 'bg-emerald-400'
                                        : anim.type === 'loop'
                                        ? 'bg-cyan-400'
                                        : 'bg-amber-400'
                                    }`}
                                  />
                                  <span className="truncate max-w-[45px]">{anim.animationName}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteTextAnimationSegment?.(clip.id, anim.id);
                                    }}
                                    className="hover:text-red-400 ml-0.5 cursor-pointer font-bold"
                                    title="Animasyonu Kaldır"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Clip Effect Segment Ribbons */}
                          {clip.effectSegments && clip.effectSegments.length > 0 && (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap z-20 pointer-events-auto">
                              {clip.effectSegments.map((eff) => (
                                <span
                                  key={eff.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectEffectSegment?.(eff.id);
                                  }}
                                  className={`px-1 py-0.2 rounded text-[8px] font-bold flex items-center gap-1 shadow-sm border bg-indigo-950/80 text-indigo-300 border-indigo-500/60 cursor-pointer hover:bg-indigo-900 ${
                                    selectedEffectSegmentId === eff.id ? 'ring-1 ring-white' : ''
                                  }`}
                                  title={`Efekt: ${eff.name} — Tıkla: Düzenle`}
                                >
                                  <Palette className="w-2.5 h-2.5 text-indigo-300 shrink-0" />
                                  <span className="truncate max-w-[45px]">{eff.name}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteEffectSegment?.(eff.id);
                                    }}
                                    className="hover:text-red-400 ml-0.5 cursor-pointer font-bold"
                                    title="Efekti Kaldır"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Keyframe Diamond Markers */}
                        {clip.keyframes && clip.keyframes.length > 0 && (
                          <div className="absolute inset-x-0 bottom-1 h-3 pointer-events-none z-20 overflow-hidden">
                            {clip.keyframes.map((kf) => {
                              const kfPercent = Math.min(100, Math.max(0, (kf.time / (clip.duration || 1)) * 100));
                              return (
                                <div
                                  key={kf.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSeek(clip.startTime + kf.time);
                                  }}
                                  className="absolute bottom-0 w-2.5 h-2.5 bg-amber-400 border border-amber-950 transform rotate-45 -translate-x-1/2 pointer-events-auto cursor-pointer hover:scale-125 hover:bg-yellow-200 transition-transform shadow-sm"
                                  style={{ left: `${kfPercent}%` }}
                                  title={`Keyframe: ${(clip.startTime + kf.time).toFixed(2)}s (Tıkla ve Git)`}
                                />
                              );
                            })}
                          </div>
                        )}

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
                          className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/30 cursor-ew-resize flex items-center justify-center z-20 group/handle"
                          title="Bitişi Kırp"
                        >
                          <div className="w-[1.5px] h-3.5 bg-white/40 group-hover/handle:bg-white/90 rounded-[0.5px]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 2.4 Cut Point Snap Highlight on Drag */}
            {isDragging && hoveredCutPoint && activePayload?.type === 'transition' && (
              <div className="absolute inset-0 pointer-events-none z-40">
                {/* Semi-transparent duration box preview */}
                <div
                  style={{
                    left: `${(hoveredCutPoint.cutTime - (activePayload.duration || 1.0) / 2) * zoom}px`,
                    width: `${(activePayload.duration || 1.0) * zoom}px`,
                  }}
                  className="absolute top-6 bottom-0 bg-amber-500/25 border-x-2 border-dashed border-amber-400 pointer-events-none z-40 flex items-center justify-center backdrop-blur-[1px]"
                >
                  <span className="text-[10px] font-mono font-bold text-amber-200 bg-black/90 px-2 py-0.5 rounded border border-amber-400 shadow-xl">
                    {(activePayload.duration || 1.0).toFixed(1)}s
                  </span>
                </div>

                {/* Glowing vertical cut line */}
                <div
                  style={{ left: `${hoveredCutPoint.cutTime * zoom}px` }}
                  className="absolute top-6 bottom-0 w-0.5 -translate-x-1/2 bg-amber-400 shadow-[0_0_16px_#f59e0b] pointer-events-none z-50"
                />

                {/* Snap Badge */}
                <div
                  style={{
                    left: `${hoveredCutPoint.cutTime * zoom}px`,
                    top: '32px',
                  }}
                  className="absolute w-28 -translate-x-1/2 flex items-center justify-center pointer-events-none z-50"
                >
                  <div className="px-2.5 py-1 rounded bg-amber-500 text-black text-[10px] font-extrabold shadow-2xl flex items-center gap-1.5 border border-amber-300 ring-2 ring-black/40">
                    <Zap className="w-3.5 h-3.5 fill-black text-black" />
                    <span>BURAYA BIRAKIN</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2.5 Bowtie / Butterfly Transitions Layer */}
            {project.transitions && project.transitions.length > 0 && (
              <div className="absolute inset-0 pointer-events-none z-30">
                {project.transitions.map((tr) => {
                  const isSelected = selectedTransitionId === tr.id;
                  const trWidth = Math.max(36, tr.duration * zoom);
                  const trLeft = (tr.cutTime - tr.duration / 2) * zoom;
                  const trDef = TRANSITION_DEFINITIONS.find((d) => d.id === tr.type);

                  const trackIdx = project.tracks.findIndex((t) => t.id === tr.trackId);
                  const topOffset = (trackIdx >= 0 ? trackIdx * 64 : 0) + 24 + 14;

                  return (
                    <div
                      key={tr.id}
                      data-transition-id={tr.id}
                      data-testid="timeline-transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(null);
                        onSelectTransition?.(tr.id);
                      }}
                      style={{
                        left: `${trLeft}px`,
                        width: `${trWidth}px`,
                        top: `${topOffset}px`,
                        height: '36px',
                      }}
                      className={`absolute pointer-events-auto group flex items-center justify-center select-none cursor-pointer transition-all ${
                        isSelected
                          ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black z-40'
                          : 'hover:brightness-125'
                      }`}
                      title={`${trDef?.name || tr.type} (${tr.duration.toFixed(2)}s) — Tıkla: Özellikler, Sürükle: Süre`}
                    >
                      {/* Duration Region Overlay */}
                      <div className="absolute inset-0 bg-amber-500/10 border-t border-b border-amber-500/30 rounded-[2px] pointer-events-none" />

                      {/* Compact Center Bowtie (24x22 px) */}
                      <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
                        <div className="w-6 h-4 relative flex items-center justify-center">
                          <svg viewBox="0 0 24 14" className="w-6 h-3.5 drop-shadow">
                            <defs>
                              <linearGradient id={`bowtie-grad-${tr.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
                                <stop offset="100%" stopColor="#d97706" stopOpacity="0.95" />
                              </linearGradient>
                            </defs>
                            <polygon points="0,1 11,7 0,13" fill={`url(#bowtie-grad-${tr.id})`} stroke="#fef08a" strokeWidth="0.75" />
                            <polygon points="24,1 13,7 24,13" fill={`url(#bowtie-grad-${tr.id})`} stroke="#fef08a" strokeWidth="0.75" />
                            <line x1="12" y1="0" x2="12" y2="14" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="1 1" />
                          </svg>
                        </div>
                        <span className="text-[8px] font-mono text-amber-300 font-bold px-1 py-0 bg-black/80 rounded leading-none border border-amber-500/40 shadow-sm mt-0.5">
                          {tr.duration.toFixed(1)} sn
                        </span>
                      </div>

                      {/* Left Duration Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizingTransition({
                            transitionId: tr.id,
                            initialDuration: tr.duration,
                            initialMouseX: e.clientX,
                            edge: 'left',
                          });
                        }}
                        className="absolute left-0 top-0 bottom-0 w-1.5 hover:w-2 bg-amber-400/40 hover:bg-amber-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-all z-20 rounded-l"
                        title="Geçiş süresini ayarla (Sol)"
                      />

                      {/* Right Duration Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizingTransition({
                            transitionId: tr.id,
                            initialDuration: tr.duration,
                            initialMouseX: e.clientX,
                            edge: 'right',
                          });
                        }}
                        className="absolute right-0 top-0 bottom-0 w-1.5 hover:w-2 bg-amber-400/40 hover:bg-amber-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-all z-20 rounded-r"
                        title="Geçiş süresini ayarla (Sağ)"
                      />

                      {/* Delete button on hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTimelineTransition?.(tr.id);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 shadow transition-opacity z-30"
                        title="Geçişi Sil"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2.6 Independent Effect Segments Layer */}
            {project.effectSegments && project.effectSegments.length > 0 && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {project.effectSegments.filter((eff) => !eff.targetClipId).map((eff) => {
                  const isSelected = selectedEffectSegmentId === eff.id;
                  const effLeft = eff.startTime * zoom;
                  const effWidth = Math.max(30, eff.duration * zoom);
                  const trackIdx = project.tracks.findIndex((t) => t.id === eff.trackId);
                  const topOffset = (trackIdx >= 0 ? trackIdx * 64 : 0) + 24 + 40;

                  return (
                    <div
                      key={eff.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(null);
                        onSelectEffectSegment?.(eff.id);
                      }}
                      style={{
                        left: `${effLeft}px`,
                        width: `${effWidth}px`,
                        top: `${topOffset}px`,
                        height: '20px',
                      }}
                      className={`absolute pointer-events-auto z-20 rounded bg-indigo-600/70 hover:bg-indigo-600/90 border border-indigo-400 text-indigo-100 text-[9px] px-1.5 flex items-center justify-between cursor-pointer group shadow ${
                        isSelected ? 'ring-2 ring-white border-white' : ''
                      }`}
                      title={`Efekt: ${eff.name} — Tıkla: Düzenle`}
                    >
                      <span className="truncate flex items-center gap-1">
                        <Palette className="w-2.5 h-2.5 text-indigo-200 shrink-0" />
                        <span className="font-semibold">{eff.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEffectSegment?.(eff.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 ml-1 font-bold"
                        title="Efekti Sil"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

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

      {/* 4. Floating Clip Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[210px] bg-[#0e1014] border border-[#202531] rounded-lg shadow-2xl p-1 text-xs text-gray-200 select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold text-gray-400 border-b border-[#191d26] uppercase truncate mb-1">
            {contextMenu.clip.name}
          </div>

          <button
            onClick={() => {
              onSplitClip(contextMenu.clip.id, currentTime);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#1a1f29] hover:text-white transition-colors text-left"
          >
            <span className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-indigo-400" />
              <span>Buradan Böl</span>
            </span>
            <kbd className="text-[10px] text-gray-400 font-mono">S</kbd>
          </button>

          <button
            onClick={() => {
              onDuplicateClip(contextMenu.clip.id);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#1a1f29] hover:text-white transition-colors text-left"
          >
            <span className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-indigo-400" />
              <span>Kopyasını Oluştur</span>
            </span>
            <kbd className="text-[10px] text-gray-400 font-mono">Ctrl+D</kbd>
          </button>

          {contextMenu.clip.type === 'video' && onDetachAudio && (
            <button
              onClick={() => {
                onDetachAudio(contextMenu.clip.id);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#1a1f29] hover:text-white transition-colors text-emerald-400 text-left"
            >
              <Music className="w-3.5 h-3.5" />
              <span>Sesi Videodan Ayır</span>
            </button>
          )}

          {onToggleClipMute && (
            <button
              onClick={() => {
                onToggleClipMute(contextMenu.clip.id);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#1a1f29] hover:text-white transition-colors text-left"
            >
              {contextMenu.clip.muted ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>Sesi Aç</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                  <span>Sessize Al</span>
                </>
              )}
            </button>
          )}

          {contextMenu.clip.type === 'video' && onUpdateClipSpeed && (
            <div className="px-2.5 py-1.5 border-t border-b border-[#191d26] my-1">
              <span className="text-[10px] text-gray-400 block mb-1">Oynatma Hızı</span>
              <div className="flex items-center gap-1">
                {[0.5, 1.0, 1.5, 2.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onUpdateClipSpeed(contextMenu.clip.id, s);
                      setContextMenu(null);
                    }}
                    className={`flex-1 py-0.5 rounded text-[10px] font-mono border ${
                      (contextMenu.clip.speed || 1) === s
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-[#13161c] text-gray-300 border-[#202531] hover:bg-[#181c24]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              onDeleteClip(contextMenu.clip.id);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-red-950/40 hover:text-white text-red-400 transition-colors text-left"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Klibi Sil</span>
            </span>
            <kbd className="text-[10px] font-mono">Del</kbd>
          </button>

          <button
            onClick={() => {
              onRippleDeleteClip(contextMenu.clip.id);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-red-950/40 hover:text-white text-red-400 transition-colors text-left"
          >
            <span className="flex items-center gap-2">
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
              <span>Boşluğu Kapatıp Sil</span>
            </span>
            <kbd className="text-[10px] font-mono">Shift+Del</kbd>
          </button>
        </div>
      )}

      {/* 3. Transition Quick Selector Popover */}
      {transitionMenu && (
        <div
          style={{ left: `${transitionMenu.x}px`, top: `${transitionMenu.y}px` }}
          className="fixed z-50 bg-[#0e1014] border border-[#202531] rounded-lg shadow-2xl p-3 w-72 text-xs select-none backdrop-blur-md"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#191d26] mb-2">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Shuffle className="w-3.5 h-3.5 text-indigo-400" />
              <span>{transitionMenu.side === 'in' ? 'Giriş Geçişi (In)' : 'Çıkış Geçişi (Out)'}</span>
            </span>
            <button
              onClick={() => setTransitionMenu(null)}
              className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mb-2">
            13 profesyonel geçiş arasından birini seçin veya kaldırın:
          </p>
          <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto mb-2 pr-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                if (onUpdateClip) {
                  const field = transitionMenu.side === 'in' ? 'transitionIn' : 'transitionOut';
                  onUpdateClip(transitionMenu.clipId, { [field]: undefined });
                }
                setTransitionMenu(null);
              }}
              className="p-1.5 rounded-md bg-[#13161c] hover:bg-red-950/40 text-red-400 border border-[#202531] hover:border-red-500/50 text-left text-[10px] flex items-center gap-1.5 col-span-2 justify-center font-medium transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Geçişi Kaldır (Sert Kesim)</span>
            </button>
            {TRANSITION_DEFINITIONS.filter((t) => t.id !== 'cut' && t.id !== 'none').map((tr) => (
              <button
                key={tr.id}
                type="button"
                onClick={() => {
                  if (onUpdateClip) {
                    const field = transitionMenu.side === 'in' ? 'transitionIn' : 'transitionOut';
                    onUpdateClip(transitionMenu.clipId, {
                      [field]: { type: tr.id, duration: 0.8 },
                    });
                  }
                  setTransitionMenu(null);
                }}
                className="p-1.5 rounded-md bg-[#13161c] hover:bg-indigo-600/20 text-gray-200 border border-[#202531] hover:border-indigo-500/50 text-left text-[10px] flex items-center gap-1.5 truncate transition-colors"
                title={tr.description}
              >
                <Shuffle className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="truncate">{tr.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
