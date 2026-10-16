import { useState, useEffect, useRef, useCallback } from 'react';
import {
  VideoProject,
  TimelineTrack,
  VideoClip,
  TrackType,
  TextLayerData,
  ClipEffects,
  Transform2D,
  Transition,
  TimelineTransition,
  EffectSegment,
  TextAnimationSegment,
  TransitionType,
  SpeedRampPreset,
  CameraMotionPreset,
  ProceduralSfxType,
} from '../types';
import { saveProjectMetadata, loadLatestProject, deleteProjectMetadata } from '../db';

const MAX_HISTORY = 50;

export function migrateProject(raw: any): VideoProject {
  if (!raw) return createDefaultProject();
  return {
    ...raw,
    transitions: Array.isArray(raw.transitions) ? raw.transitions : [],
    effectSegments: Array.isArray(raw.effectSegments) ? raw.effectSegments : [],
    tracks: Array.isArray(raw.tracks)
      ? raw.tracks.map((t: any) => ({
          ...t,
          transitions: Array.isArray(t.transitions) ? t.transitions : [],
          effectSegments: Array.isArray(t.effectSegments) ? t.effectSegments : [],
          clips: Array.isArray(t.clips)
            ? t.clips.map((c: any) => ({
                ...c,
                startTime: typeof c.startTime === 'number' ? c.startTime : (typeof c.start === 'number' ? c.start : 0),
                effectSegments: Array.isArray(c.effectSegments) ? c.effectSegments : [],
                animationSegments: Array.isArray(c.animationSegments) ? c.animationSegments : [],
              }))
            : [],
        }))
      : [],
  };
}

function createDefaultProject(): VideoProject {
  const videoTrackId = 'track-video-' + Math.random().toString(36).substring(2, 9);
  const audioTrackId = 'track-audio-' + Math.random().toString(36).substring(2, 9);
  const textTrackId = 'track-text-' + Math.random().toString(36).substring(2, 9);

  return {
    id: 'proj-' + Date.now(),
    name: 'Yeni Video Projesi',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    duration: 10,
    backgroundColor: '#000000',
    transitions: [],
    effectSegments: [],
    tracks: [
      {
        id: textTrackId,
        name: 'Metin & Efektler',
        type: 'text',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        transitions: [],
        effectSegments: [],
      },
      {
        id: videoTrackId,
        name: 'Video & Görsel 1',
        type: 'video',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        transitions: [],
        effectSegments: [],
      },
      {
        id: audioTrackId,
        name: 'Ses & Müzik 1',
        type: 'audio',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        transitions: [],
        effectSegments: [],
      },
    ],
  };
}

export function useVideoProject() {
  const [project, setProject] = useState<VideoProject>(createDefaultProject);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [selectedEffectSegmentId, setSelectedEffectSegmentId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [hasAutosavePrompt, setHasAutosavePrompt] = useState(false);
  const [recoveredProject, setRecoveredProject] = useState<VideoProject | null>(null);

  const undoStackRef = useRef<VideoProject[]>([]);
  const redoStackRef = useRef<VideoProject[]>([]);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clipboardRef = useRef<VideoClip | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);
  const isInitialMount = useRef(true);

  // Check for existing saved project in IndexedDB on first load
  useEffect(() => {
    async function checkSaved() {
      try {
        const latest = await loadLatestProject();
        if (latest && latest.tracks && latest.tracks.length > 0) {
          const migrated = migrateProject(latest);
          const totalClips = migrated.tracks.reduce((acc, t) => acc + t.clips.length, 0);
          if (totalClips > 0) {
            setRecoveredProject(migrated);
            setHasAutosavePrompt(true);
          }
        }
      } catch (err) {
        console.warn('Could not check latest saved project:', err);
      }
    }
    checkSaved();
  }, []);

  // Autosave whenever project changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setSaveStatus('saving');
    setIsDirty(true);

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await saveProjectMetadata(project);
        setSaveStatus('saved');
        setIsDirty(false);
      } catch (err) {
        console.warn('Autosave failed:', err);
        setSaveStatus('error');
      }
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [project]);

  // Recalculate duration automatically when clips change
  const updateProjectDuration = useCallback((tracks: TimelineTrack[]): number => {
    let maxTime = 10;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const clipEnd = clip.startTime + clip.duration;
        if (clipEnd > maxTime) {
          maxTime = clipEnd;
        }
      }
    }
    return Math.ceil(maxTime);
  }, []);

  // Commit state change with undo history
  const commitProjectChange = useCallback(
    (updater: (prev: VideoProject) => VideoProject, recordHistory = true) => {
      setProject((prev) => {
        if (recordHistory) {
          undoStackRef.current = [...undoStackRef.current.slice(-MAX_HISTORY), prev];
          redoStackRef.current = [];
        }

        const next = updater(prev);
        const computedDuration = updateProjectDuration(next.tracks);

        const updated: VideoProject = {
          ...next,
          duration: computedDuration,
          updatedAt: Date.now(),
        };

        setIsDirty(true);
        return updated;
      });
    },
    [updateProjectDuration]
  );

  // Undo / Redo
  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push(project);
    setProject(previous);
    setIsDirty(true);
  }, [project]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(project);
    setProject(next);
    setIsDirty(true);
  }, [project]);

  // Track operations
  const addTrack = useCallback(
    (type: TrackType, name?: string) => {
      commitProjectChange((prev) => {
        const typeCount = prev.tracks.filter((t) => t.type === type).length + 1;
        const defaultName =
          name ||
          (type === 'video'
            ? `Video & Görsel ${typeCount}`
            : type === 'audio'
            ? `Ses & Müzik ${typeCount}`
            : type === 'subtitle'
            ? `Altyazı ${typeCount}`
            : `Metin & Efekt ${typeCount}`);

        const newTrack: TimelineTrack = {
          id: 'track-' + type + '-' + Math.random().toString(36).substring(2, 9),
          name: defaultName,
          type,
          clips: [],
          muted: false,
          locked: false,
          visible: true,
        };

        // Text/Subtitles at top, Video in middle, Audio at bottom
        let newTracks = [...prev.tracks];
        if (type === 'text' || type === 'subtitle') {
          newTracks.unshift(newTrack);
        } else if (type === 'audio') {
          newTracks.push(newTrack);
        } else {
          // Video: insert before audio tracks
          const firstAudioIdx = newTracks.findIndex((t) => t.type === 'audio');
          if (firstAudioIdx >= 0) {
            newTracks.splice(firstAudioIdx, 0, newTrack);
          } else {
            newTracks.push(newTrack);
          }
        }

        return { ...prev, tracks: newTracks };
      });
    },
    [commitProjectChange]
  );

  const deleteTrack = useCallback(
    (trackId: string) => {
      commitProjectChange((prev) => {
        if (prev.tracks.length <= 1) return prev; // Keep at least one track
        return {
          ...prev,
          tracks: prev.tracks.filter((t) => t.id !== trackId),
        };
      });
    },
    [commitProjectChange]
  );

  const toggleTrackMute = useCallback(
    (trackId: string) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
      }));
    },
    [commitProjectChange]
  );

  const toggleTrackLock = useCallback(
    (trackId: string) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)),
      }));
    },
    [commitProjectChange]
  );

  const toggleTrackVisibility = useCallback(
    (trackId: string) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t)),
      }));
    },
    [commitProjectChange]
  );

  // Clip Operations
  const addClip = useCallback(
    (trackId: string, clipData: Partial<VideoClip>): VideoClip => {
      const newClip: VideoClip = {
        id: clipData.id || ('clip-' + Math.random().toString(36).substring(2, 9)),
        trackId,
        type: clipData.type || 'video',
        name: clipData.name || 'Yeni Klip',
        startTime: clipData.startTime ?? 0,
        duration: clipData.duration ?? 5,
        trimIn: clipData.trimIn ?? 0,
        trimOut: clipData.trimOut ?? (clipData.duration ?? 5),
        sourceDuration: clipData.sourceDuration ?? (clipData.duration ?? 5),
        sourceUrl: clipData.sourceUrl,
        assetId: clipData.assetId,
        volume: clipData.volume ?? 1.0,
        muted: clipData.muted ?? false,
        speed: clipData.speed ?? 1.0,
        fadeIn: clipData.fadeIn ?? 0,
        fadeOut: clipData.fadeOut ?? 0,
        transform: clipData.transform || {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        effects: clipData.effects || {},
        textData: clipData.textData,
        transitionIn: clipData.transitionIn,
        transitionOut: clipData.transitionOut,
      };

      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => {
          if (track.id === trackId) {
            return {
              ...track,
              clips: [...track.clips, newClip],
            };
          }
          return track;
        }),
      }));

      setSelectedClipId(newClip.id);
      return newClip;
    },
    [commitProjectChange]
  );

  const updateClip = useCallback(
    (clipId: string, updates: Partial<VideoClip>, recordHistory = true) => {
      commitProjectChange(
        (prev) => ({
          ...prev,
          tracks: prev.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, ...updates } : clip)),
          })),
        }),
        recordHistory
      );
    },
    [commitProjectChange]
  );

  const moveClip = useCallback(
    (clipId: string, targetTrackId: string, newStartTime: number) => {
      commitProjectChange((prev) => {
        let clipToMove: VideoClip | undefined;
        for (const t of prev.tracks) {
          const found = t.clips.find((c) => c.id === clipId);
          if (found) {
            clipToMove = found;
            break;
          }
        }

        if (!clipToMove) return prev;

        const updatedClip: VideoClip = {
          ...clipToMove,
          trackId: targetTrackId,
          startTime: Math.max(0, newStartTime),
        };

        // Remove from original track
        const tracksWithoutClip = prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((c) => c.id !== clipId),
        }));

        // Add to target track
        return {
          ...prev,
          tracks: tracksWithoutClip.map((track) => {
            if (track.id === targetTrackId) {
              return {
                ...track,
                clips: [...track.clips, updatedClip].sort((a, b) => a.startTime - b.startTime),
              };
            }
            return track;
          }),
        };
      });
    },
    [commitProjectChange]
  );

  const trimClip = useCallback(
    (
      clipId: string,
      newTrimIn: number,
      newTrimOut: number,
      newStartTime: number,
      newDuration: number
    ) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id === clipId) {
              return {
                ...clip,
                trimIn: Math.max(0, newTrimIn),
                trimOut: Math.max(newTrimIn + 0.1, newTrimOut),
                startTime: Math.max(0, newStartTime),
                duration: Math.max(0.1, newDuration),
              };
            }
            return clip;
          }),
        })),
      }));
    },
    [commitProjectChange]
  );

  // Split clip at playhead time
  const splitClip = useCallback(
    (clipId?: string | null, splitTime?: number): { leftClip: VideoClip; rightClip: VideoClip } | null => {
      let result: { leftClip: VideoClip; rightClip: VideoClip } | null = null;

      commitProjectChange((prev) => {
        let foundTrackId = '';
        let targetClip: VideoClip | null = null;
        const targetSplitTime = splitTime ?? 0;

        if (clipId) {
          for (const track of prev.tracks) {
            const c = track.clips.find((clip) => clip.id === clipId);
            if (c) {
              targetClip = c;
              foundTrackId = track.id;
              break;
            }
          }
        }

        // Auto-find clip under splitTime if clipId was omitted or does not cover splitTime
        if (
          !targetClip ||
          targetSplitTime <= targetClip.startTime ||
          targetSplitTime >= targetClip.startTime + targetClip.duration
        ) {
          for (const track of prev.tracks) {
            if (track.type === 'video' || track.type === 'audio') {
              const c = track.clips.find(
                (clip) =>
                  targetSplitTime > clip.startTime + 0.04 &&
                  targetSplitTime < clip.startTime + clip.duration - 0.04
              );
              if (c) {
                targetClip = c;
                foundTrackId = track.id;
                break;
              }
            }
          }
          if (!targetClip) {
            for (const track of prev.tracks) {
              const c = track.clips.find(
                (clip) =>
                  targetSplitTime > clip.startTime + 0.04 &&
                  targetSplitTime < clip.startTime + clip.duration - 0.04
              );
              if (c) {
                targetClip = c;
                foundTrackId = track.id;
                break;
              }
            }
          }
        }

        if (!targetClip) return prev;

        const effectiveSplit = targetSplitTime;
        const clipStart = targetClip.startTime;
        const clipEnd = clipStart + targetClip.duration;

        // Split time must be strictly inside the clip bounds
        if (effectiveSplit <= clipStart + 0.04 || effectiveSplit >= clipEnd - 0.04) {
          return prev;
        }

        const leftDuration = effectiveSplit - clipStart;
        const rightDuration = clipEnd - effectiveSplit;
        const speed = targetClip.speed || 1.0;

        const leftTrimIn = targetClip.trimIn ?? 0;
        const leftTrimOut = leftTrimIn + leftDuration * speed;

        const rightTrimIn = leftTrimOut;
        const rightTrimOut = targetClip.trimOut ?? (rightTrimIn + rightDuration * speed);

        // Keep targetClip.id for leftClip to preserve active media decoder & audio buffers seamlessly
        const leftClip: VideoClip = {
          ...targetClip,
          id: targetClip.id,
          duration: leftDuration,
          trimIn: leftTrimIn,
          trimOut: leftTrimOut,
          transitionOut: undefined, // Clear exit transition on split edge
        };

        const rightClip: VideoClip = {
          ...targetClip,
          id: 'clip-' + Math.random().toString(36).substring(2, 9),
          name: `${targetClip.name} (Bölüm 2)`,
          startTime: effectiveSplit,
          duration: rightDuration,
          trimIn: rightTrimIn,
          trimOut: rightTrimOut,
          transitionIn: undefined, // Clear entry transition on split edge
        };

        result = { leftClip, rightClip };

        return {
          ...prev,
          tracks: prev.tracks.map((track) => {
            if (track.id === foundTrackId) {
              const newClips = track.clips
                .filter((c) => c.id !== targetClip!.id)
                .concat([leftClip, rightClip])
                .sort((a, b) => a.startTime - b.startTime);
              return { ...track, clips: newClips };
            }
            return track;
          }),
        };
      });

      if (result) {
        const { rightClip } = result as { leftClip: VideoClip; rightClip: VideoClip };
        // Select rightClip so user can immediately mute, delete, or add effects to the section following split
        setSelectedClipId(rightClip.id);
      }
      return result;
    },
    [commitProjectChange]
  );

  const deleteClip = useCallback(
    (clipId: string) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((c) => c.id !== clipId),
        })),
        transitions: prev.transitions?.filter(
          (tr) => tr.leftClipId !== clipId && tr.rightClipId !== clipId
        ),
      }));
      if (selectedClipId === clipId) setSelectedClipId(null);
    },
    [commitProjectChange, selectedClipId]
  );

  // Ripple Delete: removes clip and shifts subsequent clips left to close the gap
  const rippleDeleteClip = useCallback(
    (clipId: string) => {
      commitProjectChange((prev) => {
        let deletedClip: VideoClip | null = null;
        let trackId = '';

        for (const t of prev.tracks) {
          const c = t.clips.find((clip) => clip.id === clipId);
          if (c) {
            deletedClip = c;
            trackId = t.id;
            break;
          }
        }

        if (!deletedClip) return prev;

        const gapDuration = deletedClip.duration;
        const gapStart = deletedClip.startTime;

        return {
          ...prev,
          tracks: prev.tracks.map((track) => {
            if (track.id === trackId) {
              const newClips = track.clips
                .filter((c) => c.id !== clipId)
                .map((c) => {
                  if (c.startTime > gapStart) {
                    return {
                      ...c,
                      startTime: Math.max(0, c.startTime - gapDuration),
                    };
                  }
                  return c;
                });
              return { ...track, clips: newClips };
            }
            return track;
          }),
          transitions: prev.transitions
            ?.filter((tr) => tr.leftClipId !== clipId && tr.rightClipId !== clipId)
            .map((tr) => {
              if (tr.cutTime > gapStart) {
                return { ...tr, cutTime: Math.max(0, tr.cutTime - gapDuration) };
              }
              return tr;
            }),
        };
      });

      if (selectedClipId === clipId) setSelectedClipId(null);
    },
    [commitProjectChange, selectedClipId]
  );

  const duplicateClip = useCallback(
    (clipId: string) => {
      commitProjectChange((prev) => {
        let foundClip: VideoClip | null = null;
        let foundTrackId = '';

        for (const t of prev.tracks) {
          const c = t.clips.find((clip) => clip.id === clipId);
          if (c) {
            foundClip = c;
            foundTrackId = t.id;
            break;
          }
        }

        if (!foundClip) return prev;

        const clone: VideoClip = {
          ...foundClip,
          id: 'clip-' + Math.random().toString(36).substring(2, 9),
          name: `${foundClip.name} (Kopya)`,
          startTime: foundClip.startTime + foundClip.duration,
        };

        return {
          ...prev,
          tracks: prev.tracks.map((track) => {
            if (track.id === foundTrackId) {
              const clips = [...track.clips, clone].sort((a, b) => a.startTime - b.startTime);
              return { ...track, clips };
            }
            return track;
          }),
        };
      });
    },
    [commitProjectChange]
  );

  // Copy clip into clipboard
  const copyClip = useCallback(
    (clipId?: string | null): boolean => {
      const targetId = clipId || selectedClipId;
      if (!targetId) return false;
      let foundClip: VideoClip | null = null;
      for (const t of project.tracks) {
        const c = t.clips.find((clip) => clip.id === targetId);
        if (c) {
          foundClip = c;
          break;
        }
      }
      if (!foundClip) return false;
      const cloned: VideoClip = JSON.parse(JSON.stringify(foundClip));
      clipboardRef.current = cloned;
      setHasClipboard(true);
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.setItem('forma_clipboard_clip', JSON.stringify(cloned));
        } catch {}
      }
      return true;
    },
    [project.tracks, selectedClipId]
  );

  // Paste clip from clipboard at targetTime onto targetTrack
  const pasteClip = useCallback(
    (targetTime?: number, targetTrackId?: string): VideoClip | null => {
      let sourceClip = clipboardRef.current;
      if (!sourceClip && typeof window !== 'undefined' && window.sessionStorage) {
        try {
          const stored = window.sessionStorage.getItem('forma_clipboard_clip');
          if (stored) sourceClip = JSON.parse(stored);
        } catch {}
      }
      if (!sourceClip) return null;

      let createdClip: VideoClip | null = null;
      const pasteTime = typeof targetTime === 'number' && targetTime >= 0 ? targetTime : 0;

      commitProjectChange((prev) => {
        let destTrack = prev.tracks.find((t) => t.id === targetTrackId && t.type === sourceClip!.type);
        if (!destTrack) {
          destTrack = prev.tracks.find((t) => t.type === sourceClip!.type && !t.locked);
        }
        if (!destTrack) {
          destTrack = prev.tracks.find((t) => !t.locked) || prev.tracks[0];
        }
        if (!destTrack) return prev;

        const newId = 'clip-' + Math.random().toString(36).substring(2, 9);
        const newClip: VideoClip = {
          ...sourceClip!,
          id: newId,
          trackId: destTrack.id,
          name: `${sourceClip!.name} (Kopya)`,
          startTime: pasteTime,
        };
        createdClip = newClip;

        return {
          ...prev,
          tracks: prev.tracks.map((track) => {
            if (track.id === destTrack!.id) {
              const newClips = [...track.clips, newClip].sort((a, b) => a.startTime - b.startTime);
              return { ...track, clips: newClips };
            }
            return track;
          }),
        };
      });

      if (createdClip) {
        setSelectedClipId((createdClip as VideoClip).id);
      }
      return createdClip;
    },
    [commitProjectChange]
  );

  // Detach Audio: separates audio from a video clip onto an audio track
  const detachAudio = useCallback(
    (clipId: string): string | null => {
      let createdAudioClipId: string | null = null;

      commitProjectChange((prev) => {
        let videoClip: VideoClip | null = null;
        let videoTrackId = '';

        for (const t of prev.tracks) {
          const c = t.clips.find((clip) => clip.id === clipId);
          if (c) {
            videoClip = c;
            videoTrackId = t.id;
            break;
          }
        }

        if (!videoClip || videoClip.type !== 'video') return prev;

        // Find or create an audio track
        let audioTrack = prev.tracks.find((t) => t.type === 'audio' && !t.locked);
        let updatedTracks = [...prev.tracks];

        if (!audioTrack) {
          const newAudioTrack: TimelineTrack = {
            id: 'track-audio-' + Date.now(),
            name: 'Ayrılan Ses Kanalı',
            type: 'audio',
            clips: [],
            muted: false,
            locked: false,
            visible: true,
          };
          updatedTracks.push(newAudioTrack);
          audioTrack = newAudioTrack;
        }

        createdAudioClipId = 'clip-audio-' + Math.random().toString(36).substring(2, 9);
        const audioClip: VideoClip = {
          id: createdAudioClipId,
          trackId: audioTrack.id,
          assetId: videoClip.assetId,
          sourceUrl: videoClip.sourceUrl,
          name: `${videoClip.name} (Ses)`,
          type: 'audio',
          startTime: videoClip.startTime,
          duration: videoClip.duration,
          trimIn: videoClip.trimIn,
          trimOut: videoClip.trimOut,
          sourceDuration: videoClip.sourceDuration,
          speed: videoClip.speed || 1.0,
          volume: videoClip.volume ?? 1.0,
          muted: false,
          fadeIn: videoClip.fadeIn || 0,
          fadeOut: videoClip.fadeOut || 0,
        };

        // Mute the original video clip
        return {
          ...prev,
          tracks: updatedTracks.map((track) => {
            if (track.id === videoTrackId) {
              return {
                ...track,
                clips: track.clips.map((c) =>
                  c.id === clipId ? { ...c, muted: true, volume: 0 } : c
                ),
              };
            }
            if (track.id === audioTrack!.id) {
              const clips = [...track.clips, audioClip].sort((a, b) => a.startTime - b.startTime);
              return { ...track, clips };
            }
            return track;
          }),
        };
      });

      return createdAudioClipId;
    },
    [commitProjectChange]
  );

  // Ripple Trim Start (Q): Trims from clip start to trimTime, shifts clip and following clips left
  const rippleTrimStart = useCallback(
    (clipId: string, trimTime: number): number | null => {
      let newPlayheadTime: number | null = null;

      commitProjectChange((prev) => {
        let targetClip: VideoClip | null = null;
        let trackId = '';

        for (const t of prev.tracks) {
          const c = t.clips.find((clip) => clip.id === clipId);
          if (c) {
            targetClip = c;
            trackId = t.id;
            break;
          }
        }

        if (!targetClip) return prev;

        const clipStart = targetClip.startTime;
        const clipEnd = clipStart + targetClip.duration;

        if (trimTime <= clipStart + 0.04 || trimTime >= clipEnd - 0.04) {
          return prev;
        }

        const cutDuration = trimTime - clipStart;
        newPlayheadTime = clipStart;
        const speed = targetClip.speed || 1.0;
        const newTrimIn = (targetClip.trimIn ?? 0) + cutDuration * speed;
        const newDuration = targetClip.duration - cutDuration;

        const updatedClip: VideoClip = {
          ...targetClip,
          trimIn: newTrimIn,
          duration: newDuration,
          transitionIn: undefined,
        };

        return {
          ...prev,
          tracks: prev.tracks.map((track) => {
            if (track.id === trackId) {
              const newClips = track.clips.map((c) => {
                if (c.id === clipId) {
                  return updatedClip;
                }
                if (c.startTime >= clipEnd - 0.01) {
                  return {
                    ...c,
                    startTime: Math.max(0, c.startTime - cutDuration),
                  };
                }
                return c;
              });
              return { ...track, clips: newClips };
            }
            return track;
          }),
          transitions: prev.transitions
            ?.filter((tr) => tr.leftClipId !== clipId)
            .map((tr) => {
              if (tr.cutTime >= clipEnd - 0.01) {
                return { ...tr, cutTime: Math.max(0, tr.cutTime - cutDuration) };
              }
              return tr;
            }),
        };
      });

      return newPlayheadTime;
    },
    [commitProjectChange]
  );

  // Ripple Trim End (W): Trims from trimTime to clip end, pulls subsequent clips left
  const rippleTrimEnd = useCallback(
    (clipId: string, trimTime: number): number | null => {
      let newPlayheadTime: number | null = null;

      commitProjectChange((prev) => {
        let targetClip: VideoClip | null = null;
        let trackId = '';

        for (const t of prev.tracks) {
          const c = t.clips.find((clip) => clip.id === clipId);
          if (c) {
            targetClip = c;
            trackId = t.id;
            break;
          }
        }

        if (!targetClip) return prev;

        const clipStart = targetClip.startTime;
        const clipEnd = clipStart + targetClip.duration;

        if (trimTime <= clipStart + 0.04 || trimTime >= clipEnd - 0.04) {
          return prev;
        }

        const cutDuration = clipEnd - trimTime;
        newPlayheadTime = trimTime;
        const speed = targetClip.speed || 1.0;
        const newDuration = trimTime - clipStart;
        const newTrimOut = (targetClip.trimIn ?? 0) + newDuration * speed;

        const updatedClip: VideoClip = {
          ...targetClip,
          duration: newDuration,
          trimOut: newTrimOut,
          transitionOut: undefined,
        };

        return {
          ...prev,
          tracks: prev.tracks.map((track) => {
            if (track.id === trackId) {
              const newClips = track.clips.map((c) => {
                if (c.id === clipId) {
                  return updatedClip;
                }
                if (c.startTime >= clipEnd - 0.01) {
                  return {
                    ...c,
                    startTime: Math.max(0, c.startTime - cutDuration),
                  };
                }
                return c;
              });
              return { ...track, clips: newClips };
            }
            return track;
          }),
          transitions: prev.transitions
            ?.filter((tr) => tr.rightClipId !== clipId)
            .map((tr) => {
              if (tr.cutTime >= clipEnd - 0.01) {
                return { ...tr, cutTime: Math.max(0, tr.cutTime - cutDuration) };
              }
              return tr;
            }),
        };
      });

      return newPlayheadTime;
    },
    [commitProjectChange]
  );

  // Freeze Frame: Splits clip at freezeTime, inserts a still image clip with duration, shifts subsequent clips right
  const freezeFrame = useCallback(
    async (
      clipId: string,
      freezeTime: number,
      freezeDuration: number = 2.0,
      imageBlob?: Blob
    ): Promise<string | null> => {
      let createdClipId: string | null = null;
      let targetClip: VideoClip | null = null;
      let trackId = '';

      for (const t of project.tracks) {
        const c = t.clips.find((clip) => clip.id === clipId);
        if (c) {
          targetClip = c;
          trackId = t.id;
          break;
        }
      }

      if (!targetClip) return null;

      let assetId = 'asset-freeze-' + Date.now();
      let sourceUrl = '';
      if (imageBlob) {
        const { saveAssetBlob } = await import('../db');
        await saveAssetBlob(assetId, imageBlob);
        sourceUrl = URL.createObjectURL(imageBlob);
      } else {
        try {
          const { exportEngine } = await import('../engine/exportEngine');
          const blob = await exportEngine.exportProject(
            project,
            {
              format: 'png',
              resolution: project.resolution,
              fps: project.fps,
              quality: 'high',
              filename: `freeze_${Date.now()}.png`,
            },
            freezeTime,
            () => {}
          );
          if (blob) {
            const { saveAssetBlob } = await import('../db');
            await saveAssetBlob(assetId, blob);
            sourceUrl = URL.createObjectURL(blob);
          }
        } catch (err) {
          console.warn('Freeze frame snapshot capture failed:', err);
        }
      }

      commitProjectChange((prev) => {
        let curClip: VideoClip | null = null;
        let curTrackId = '';

        for (const t of prev.tracks) {
          const c = t.clips.find((clip) => clip.id === clipId);
          if (c) {
            curClip = c;
            curTrackId = t.id;
            break;
          }
        }

        if (!curClip) return prev;

        const clipStart = curClip.startTime;
        const clipEnd = clipStart + curClip.duration;
        const speed = curClip.speed || 1.0;
        const splitOffset = Math.max(0.01, Math.min(curClip.duration - 0.01, freezeTime - clipStart));
        const effectiveSplitTime = clipStart + splitOffset;

        const leftDuration = splitOffset;
        const rightDuration = curClip.duration - splitOffset;

        const leftTrimIn = curClip.trimIn ?? 0;
        const leftTrimOut = leftTrimIn + leftDuration * speed;

        const rightTrimIn = leftTrimOut;
        const rightTrimOut = curClip.trimOut ?? (rightTrimIn + rightDuration * speed);

        const leftClip: VideoClip = {
          ...curClip,
          id: curClip.id,
          duration: leftDuration,
          trimIn: leftTrimIn,
          trimOut: leftTrimOut,
        };

        createdClipId = 'clip-freeze-' + Math.random().toString(36).substring(2, 9);
        const freezeClip: VideoClip = {
          id: createdClipId,
          trackId: curTrackId,
          assetId,
          sourceUrl,
          name: `${curClip.name} (Dondurulmuş Kare)`,
          type: 'image',
          startTime: effectiveSplitTime,
          duration: freezeDuration,
          sourceDuration: freezeDuration,
          trimIn: 0,
          trimOut: freezeDuration,
        };

        const rightClipId = 'clip-' + Math.random().toString(36).substring(2, 9);
        const rightClip: VideoClip = {
          ...curClip,
          id: rightClipId,
          name: `${curClip.name} (Devam)`,
          startTime: effectiveSplitTime + freezeDuration,
          duration: rightDuration,
          trimIn: rightTrimIn,
          trimOut: rightTrimOut,
        };

        return {
          ...prev,
          tracks: prev.tracks.map((track) => {
            if (track.id === curTrackId) {
              const otherClips = track.clips
                .filter((c) => c.id !== curClip!.id)
                .map((c) => {
                  if (c.startTime >= clipEnd - 0.01) {
                    return {
                      ...c,
                      startTime: c.startTime + freezeDuration,
                    };
                  }
                  return c;
                });
              const newClips = [...otherClips, leftClip, freezeClip, rightClip].sort(
                (a, b) => a.startTime - b.startTime
              );
              return { ...track, clips: newClips };
            }
            return track;
          }),
        };
      });

      if (createdClipId) {
        setSelectedClipId(createdClipId);
      }
      return createdClipId;
    },
    [commitProjectChange, project]
  );

  // Remove silences from clip: analyzes silence intervals and packs spoken parts together
  const removeSilencesFromClip = useCallback(
    async (clipId: string, minDurationSec = 0.35): Promise<boolean> => {
      let targetClip: VideoClip | null = null;

      for (const t of project.tracks) {
        const c = t.clips.find((clip) => clip.id === clipId);
        if (c) {
          targetClip = c;
          break;
        }
      }

      if (!targetClip) return false;

      const { audioMixer } = await import('../engine/audioMixer');
      const silences = await audioMixer.detectSilenceIntervals(targetClip, minDurationSec);

      const validSilences = silences.filter((s) => s.duration >= minDurationSec);
      if (validSilences.length === 0) {
        return false;
      }

      commitProjectChange((prev) => {
        let curClip: VideoClip | null = null;
        let curTrackId = '';

        for (const t of prev.tracks) {
          const c = t.clips.find((clip) => clip.id === clipId);
          if (c) {
            curClip = c;
            curTrackId = t.id;
            break;
          }
        }

        if (!curClip) return prev;

        const speed = curClip.speed || 1.0;
        const clipStart = curClip.startTime;
        const initialTrimIn = curClip.trimIn ?? 0;

        const speechSegments: { startSec: number; endSec: number }[] = [];
        let cursor = 0;

        for (const sil of validSilences) {
          if (sil.startSec > cursor + 0.1) {
            speechSegments.push({
              startSec: cursor,
              endSec: sil.startSec,
            });
          }
          cursor = Math.max(cursor, sil.endSec);
        }

        if (cursor < curClip.duration - 0.1) {
          speechSegments.push({
            startSec: cursor,
            endSec: curClip.duration,
          });
        }

        if (speechSegments.length === 0) return prev;

        let runningTimelineTime = clipStart;
        const newSpeechClips: VideoClip[] = [];

        speechSegments.forEach((seg, idx) => {
          const segDuration = seg.endSec - seg.startSec;
          const segTrimIn = initialTrimIn + seg.startSec * speed;
          const segTrimOut = segTrimIn + segDuration * speed;

          const clipObj: VideoClip = {
            ...curClip!,
            id: idx === 0 ? curClip!.id : 'clip-' + Math.random().toString(36).substring(2, 9),
            name: `${curClip!.name} (Konuşma ${idx + 1})`,
            startTime: runningTimelineTime,
            duration: segDuration,
            trimIn: segTrimIn,
            trimOut: segTrimOut,
          };
          newSpeechClips.push(clipObj);
          runningTimelineTime += segDuration;
        });

        const totalOriginalDuration = curClip.duration;
        const totalNewDuration = runningTimelineTime - clipStart;
        const totalSavedGap = totalOriginalDuration - totalNewDuration;

        return {
          ...prev,
          tracks: prev.tracks.map((track) => {
            if (track.id === curTrackId) {
              const otherClips = track.clips
                .filter((c) => c.id !== curClip!.id)
                .map((c) => {
                  if (c.startTime >= clipStart + totalOriginalDuration - 0.01) {
                    return {
                      ...c,
                      startTime: Math.max(0, c.startTime - totalSavedGap),
                    };
                  }
                  return c;
                });
              const combined = [...otherClips, ...newSpeechClips].sort(
                (a, b) => a.startTime - b.startTime
              );
              return { ...track, clips: combined };
            }
            return track;
          }),
        };
      });

      return true;
    },
    [commitProjectChange, project]
  );

  // Remove or mute a specific duplicate range from a clip (AI Duplicate & Stutter cleaner)
  const removeDuplicateRangeFromClip = useCallback(
    (
      clipId: string,
      rangeStartRelSec: number,
      rangeEndRelSec: number,
      action: 'ripple_delete' | 'vocal_mute' | 'censor_bleep' = 'ripple_delete'
    ): boolean => {
      let success = false;

      commitProjectChange((prev) => {
        let curClip: VideoClip | null = null;
        let curTrackId = '';

        for (const t of prev.tracks) {
          const c = t.clips.find((clip) => clip.id === clipId);
          if (c) {
            curClip = c;
            curTrackId = t.id;
            break;
          }
        }

        if (!curClip) return prev;

        const speed = curClip.speed || 1.0;
        const clipStart = curClip.startTime;
        const initialTrimIn = curClip.trimIn ?? 0;
        const originalDuration = curClip.duration;

        // Ensure range is within clip bounds
        const safeStart = Math.max(0, Math.min(originalDuration - 0.05, rangeStartRelSec));
        const safeEnd = Math.max(safeStart + 0.05, Math.min(originalDuration, rangeEndRelSec));
        const rangeDuration = safeEnd - safeStart;

        if (rangeDuration <= 0.04) return prev;

        if (action === 'vocal_mute' || action === 'censor_bleep') {
          const isBleep = action === 'censor_bleep';
          const segments: VideoClip[] = [];

          if (safeStart > 0.05) {
            segments.push({
              ...curClip,
              id: curClip.id,
              startTime: clipStart,
              duration: safeStart,
              trimIn: initialTrimIn,
              trimOut: initialTrimIn + safeStart * speed,
              vocalMute: curClip.vocalMute,
            });
          }

          const midClipId = isBleep
            ? 'clip-bleep-' + Math.random().toString(36).substring(2, 9)
            : 'clip-muted-' + Math.random().toString(36).substring(2, 9);
          segments.push({
            ...curClip,
            id: safeStart <= 0.05 ? curClip.id : midClipId,
            name: isBleep ? `${curClip.name} [Sansür Bip]` : `${curClip.name} (Susturuldu + Lip-Freeze)`,
            startTime: clipStart + safeStart,
            duration: rangeDuration,
            trimIn: initialTrimIn + safeStart * speed,
            trimOut: initialTrimIn + safeEnd * speed,
            vocalMute: true,
            lipFreeze: !isBleep,
            lipFreezeFrameTime: isBleep ? undefined : initialTrimIn + safeStart * speed,
            visualMuteMode: isBleep ? 'none' : 'lip_freeze',
            volume: isBleep ? 0.35 : (curClip.volume ?? 1.0),
          });

          if (safeEnd < originalDuration - 0.05) {
            const rightClipId = 'clip-' + Math.random().toString(36).substring(2, 9);
            segments.push({
              ...curClip,
              id: rightClipId,
              startTime: clipStart + safeEnd,
              duration: originalDuration - safeEnd,
              trimIn: initialTrimIn + safeEnd * speed,
              trimOut: curClip.trimOut,
              vocalMute: curClip.vocalMute,
            });
          }

          success = true;

          // If censor bleep, also add the 1000Hz bleep audio clip onto an audio track
          let updatedTracks = prev.tracks.map((track) => {
            if (track.id === curTrackId) {
              const others = track.clips.filter((c) => c.id !== curClip!.id);
              const combined = [...others, ...segments].sort((a, b) => a.startTime - b.startTime);
              return { ...track, clips: combined };
            }
            return track;
          });

          if (isBleep) {
            let audioTrack = updatedTracks.find((t) => t.type === 'audio');
            const bleepClip: VideoClip = {
              id: 'censor-bleep-' + Math.random().toString(36).substring(2, 9),
              trackId: audioTrack ? audioTrack.id : 'track-audio-bleep',
              type: 'audio',
              name: 'Sansür Bip Sesi (1000Hz)',
              startTime: clipStart + safeStart,
              duration: rangeDuration,
              trimIn: 0,
              trimOut: rangeDuration,
              sourceDuration: rangeDuration,
              assetId: 'sfx-censor-bleep',
              volume: 1.0,
            };

            if (audioTrack) {
              updatedTracks = updatedTracks.map((t) =>
                t.id === audioTrack!.id
                  ? { ...t, clips: [...t.clips, bleepClip].sort((a, b) => a.startTime - b.startTime) }
                  : t
              );
            } else {
              updatedTracks = [
                ...updatedTracks,
                {
                  id: 'track-audio-bleep',
                  name: 'Sansür Kanalı',
                  type: 'audio',
                  clips: [bleepClip],
                  muted: false,
                  locked: false,
                  visible: true,
                },
              ];
            }
          }

          return {
            ...prev,
            tracks: updatedTracks,
          };
        } else {
          // Ripple delete: excises [safeStart, safeEnd] and pulls following clips left by rangeDuration
          const remainingClips: VideoClip[] = [];

          // Left part
          if (safeStart > 0.05) {
            remainingClips.push({
              ...curClip,
              id: curClip.id,
              startTime: clipStart,
              duration: safeStart,
              trimIn: initialTrimIn,
              trimOut: initialTrimIn + safeStart * speed,
            });
          }

          // Right part
          if (safeEnd < originalDuration - 0.05) {
            const rightClipId = safeStart <= 0.05 ? curClip.id : 'clip-' + Math.random().toString(36).substring(2, 9);
            remainingClips.push({
              ...curClip,
              id: rightClipId,
              startTime: clipStart + safeStart,
              duration: originalDuration - safeEnd,
              trimIn: initialTrimIn + safeEnd * speed,
              trimOut: curClip.trimOut,
              smoothCutIn: true,
              smoothCutDurationMs: 160,
            });
          }

          success = true;
          return {
            ...prev,
            tracks: prev.tracks.map((track) => {
              if (track.id === curTrackId) {
                const others = track.clips
                  .filter((c) => c.id !== curClip!.id)
                  .map((c) => {
                    if (c.startTime >= clipStart + originalDuration - 0.01) {
                      return {
                        ...c,
                        startTime: Math.max(0, c.startTime - rangeDuration),
                      };
                    }
                    return c;
                  });
                const combined = [...others, ...remainingClips].sort((a, b) => a.startTime - b.startTime);
                return { ...track, clips: combined };
              }
              return track;
            }),
          };
        }
      });

      return success;
    },
    [commitProjectChange]
  );

  // Toggle Character Vocal Mute with Lip-Freeze Visual Sync
  const toggleClipVocalMute = useCallback(
    (clipId: string, options?: { lipFreeze?: boolean } | boolean) => {
      const enableLipFreeze = typeof options === 'boolean' ? options : (options?.lipFreeze ?? true);
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id === clipId) {
              const nextMute = !clip.vocalMute;
              return {
                ...clip,
                vocalMute: nextMute,
                lipFreeze: nextMute ? enableLipFreeze : false,
                lipFreezeFrameTime: nextMute ? (clip.trimIn ?? 0) : undefined,
                visualMuteMode: nextMute ? (enableLipFreeze ? 'lip_freeze' : 'none') : 'none',
                muted: false,
              };
            }
            return clip;
          }),
        })),
      }));
    },
    [commitProjectChange]
  );

  // 1. AI End-Glitch Trimmer (AI Son Kare Bozulmalarını Kırpma + Ripple Delete)
  const trimClipEndGlitch = useCallback(
    (clipId: string, durationSec = 0.35) => {
      commitProjectChange((prev) => {
        let trimmedTrackId: string | null = null;
        let originalEndTime = 0;
        let actualTrimAmount = 0;

        // Step 1: Find clip and reduce its duration
        const updatedTracks = prev.tracks.map((track) => {
          const clipIdx = track.clips.findIndex((c) => c.id === clipId);
          if (clipIdx === -1) return track;

          trimmedTrackId = track.id;
          const targetClip = track.clips[clipIdx];
          actualTrimAmount = Math.min(durationSec, Math.max(0, targetClip.duration - 0.2));
          if (actualTrimAmount <= 0) return track;

          originalEndTime = targetClip.startTime + targetClip.duration;
          const newDuration = targetClip.duration - actualTrimAmount;
          const newTrimOut = Math.max(0.1, (targetClip.trimOut ?? targetClip.duration) - actualTrimAmount);

          const newClips = [...track.clips];
          newClips[clipIdx] = {
            ...targetClip,
            duration: newDuration,
            trimOut: newTrimOut,
            aiGlitchTrimmed: true,
          };

          // Step 2: Ripple delete subsequent clips on this track & apply smooth cut
          for (let i = 0; i < newClips.length; i++) {
            if (i === clipIdx) continue;
            const c = newClips[i];
            if (c.startTime >= originalEndTime - 0.05) {
              const isDirectNext = Math.abs(c.startTime - originalEndTime) < 0.1;
              newClips[i] = {
                ...c,
                startTime: Math.max(0, c.startTime - actualTrimAmount),
                smoothCutIn: isDirectNext ? true : c.smoothCutIn,
                smoothCutDurationMs: isDirectNext ? 160 : c.smoothCutDurationMs,
              };
            }
          }

          return { ...track, clips: newClips };
        });

        return { ...prev, tracks: updatedTracks };
      });
    },
    [commitProjectChange]
  );

  // Trim all video clips' morphing glitches at once
  const trimAllClipsEndGlitch = useCallback(
    (durationSec = 0.35) => {
      commitProjectChange((prev) => {
        const newTracks = prev.tracks.map((track) => {
          if (track.type !== 'video') return track;
          let shiftAccumulator = 0;
          const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);

          const updatedClips = sortedClips.map((clip, idx) => {
            const trimAmt = Math.min(durationSec, Math.max(0, clip.duration - 0.25));
            const newStartTime = Math.max(0, clip.startTime - shiftAccumulator);
            const newDuration = clip.duration - trimAmt;
            const newTrimOut = Math.max(0.1, (clip.trimOut ?? clip.duration) - trimAmt);
            shiftAccumulator += trimAmt;

            return {
              ...clip,
              startTime: newStartTime,
              duration: newDuration,
              trimOut: newTrimOut,
              aiGlitchTrimmed: true,
              smoothCutIn: idx > 0 ? true : clip.smoothCutIn,
              smoothCutDurationMs: idx > 0 ? 160 : clip.smoothCutDurationMs,
            };
          });

          return { ...track, clips: updatedClips };
        });

        return { ...prev, tracks: newTracks };
      });
    },
    [commitProjectChange]
  );

  // 2. J-Cut / L-Cut Audio Split Overlay
  const setClipJCut = useCallback(
    (clipId: string, offsetSec = 0.4) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId
              ? { ...clip, jCutOffsetSec: clip.jCutOffsetSec === offsetSec ? 0 : offsetSec }
              : clip
          ),
        })),
      }));
    },
    [commitProjectChange]
  );

  const setClipLCut = useCallback(
    (clipId: string, offsetSec = 0.4) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId
              ? { ...clip, lCutOffsetSec: clip.lCutOffsetSec === offsetSec ? 0 : offsetSec }
              : clip
          ),
        })),
      }));
    },
    [commitProjectChange]
  );

  // 3. Project & Clip Canvas Blur Fill (9:16 / 1:1 CapCut Blur)
  const toggleProjectCanvasBlurFill = useCallback(() => {
    commitProjectChange((prev) => ({
      ...prev,
      canvasBlurFill: !prev.canvasBlurFill,
    }));
  }, [commitProjectChange]);

  const setClipCanvasBlurFill = useCallback(
    (clipId: string, enabled?: boolean) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId
              ? { ...clip, canvasBlurFill: enabled ?? !clip.canvasBlurFill }
              : clip
          ),
        })),
      }));
    },
    [commitProjectChange]
  );

  // 4. AI Watermark / Delogo Patch
  const setClipDelogoPatch = useCallback(
    (clipId: string, patch: Partial<DelogoPatchSettings>) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id === clipId) {
              const currentPatch = clip.delogoPatch || {
                enabled: true,
                x: 75,
                y: 85,
                width: 22,
                height: 12,
                mode: 'blur',
              };
              return {
                ...clip,
                delogoPatch: {
                  ...currentPatch,
                  ...patch,
                },
              };
            }
            return clip;
          }),
        })),
      }));
    },
    [commitProjectChange]
  );

  // 5. Auto Audio Ducking Toggle
  const toggleProjectAutoDucking = useCallback(() => {
    commitProjectChange((prev) => ({
      ...prev,
      autoDucking: !prev.autoDucking,
      autoDuckingDb: prev.autoDuckingDb ?? -12,
      autoDuckingFadeMs: prev.autoDuckingFadeMs ?? 300,
    }));
  }, [commitProjectChange]);

  // 6. Speed Ramping Preset
  const setClipSpeedRamp = useCallback(
    (clipId: string, preset: SpeedRampPreset) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId ? { ...clip, speedRampPreset: preset } : clip
          ),
        })),
      }));
    },
    [commitProjectChange]
  );

  // 7. Apply Transition to All Cuts across the timeline
  const applyTransitionToAllCuts = useCallback(
    (transitionType: TransitionType, duration = 0.6) => {
      commitProjectChange((prev) => {
        const newTransitions: TimelineTransition[] = [];
        const updatedTracks = prev.tracks.map((track) => {
          if (track.type !== 'video' && track.type !== 'image') return track;

          const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
          const trackTrans: TimelineTransition[] = [];

          for (let i = 0; i < sortedClips.length - 1; i++) {
            const c1 = sortedClips[i];
            const c2 = sortedClips[i + 1];
            const cutTime = (c1.startTime + c1.duration + c2.startTime) / 2;
            if (Math.abs((c1.startTime + c1.duration) - c2.startTime) < 0.45) {
              const trans: TimelineTransition = {
                id: `trans-all-${Date.now()}-${track.id}-${i}`,
                trackId: track.id,
                type: transitionType,
                duration,
                cutTime,
                leftClipId: c1.id,
                rightClipId: c2.id,
                alignment: 'between',
              };
              trackTrans.push(trans);
              newTransitions.push(trans);
            }
          }

          return {
            ...track,
            transitions: trackTrans,
          };
        });

        return {
          ...prev,
          tracks: updatedTracks,
          transitions: newTransitions,
        };
      });
    },
    [commitProjectChange]
  );

  // 8. Toggle Auto-Whoosh
  const toggleProjectAutoWhoosh = useCallback(
    (enabled?: boolean) => {
      commitProjectChange((prev) => ({
        ...prev,
        autoWhoosh: typeof enabled === 'boolean' ? enabled : !prev.autoWhoosh,
      }));
    },
    [commitProjectChange]
  );

  // 9. Add Procedural SFX Clip to Timeline
  const addProceduralSfxClip = useCallback(
    (type: ProceduralSfxType, timeSec = 0, targetTrackId?: string): VideoClip => {
      const sfxDurations: Record<ProceduralSfxType, number> = {
        'whoosh': 0.45,
        'sub-bass-boom': 1.2,
        'tension-riser': 2.0,
        'glitch-zap': 0.28,
        'camera-shutter': 0.18,
      };
      const sfxNames: Record<ProceduralSfxType, string> = {
        'whoosh': '💨 Whoosh (Geçiş Sesi)',
        'sub-bass-boom': '💥 Sub Bass Boom',
        'tension-riser': '📈 Tension Riser',
        'glitch-zap': '⚡ Glitch Zap',
        'camera-shutter': '📸 Camera Shutter',
      };

      const duration = sfxDurations[type] || 1.0;
      const name = sfxNames[type] || `SFX ${type}`;
      const clipId = `clip-sfx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      let audioTrack = targetTrackId
        ? project.tracks.find((t) => t.id === targetTrackId)
        : project.tracks.find((t) => t.type === 'audio');

      const newClip: VideoClip = {
        id: clipId,
        trackId: audioTrack ? audioTrack.id : '',
        type: 'audio',
        name,
        startTime: Math.max(0, timeSec),
        duration,
        trimIn: 0,
        trimOut: duration,
        volume: 1.0,
        muted: false,
        isProceduralSfx: true,
        proceduralSfxType: type,
        assetId: `sfx-procedural-${type}`,
      };

      commitProjectChange((prev) => {
        let tracks = [...prev.tracks];
        let target = tracks.find((t) => t.id === audioTrack?.id) || tracks.find((t) => t.type === 'audio');
        if (!target) {
          const newTrack: TimelineTrack = {
            id: `track-audio-${Date.now()}`,
            name: 'Ses & Efektler',
            type: 'audio',
            clips: [],
            muted: false,
            locked: false,
            visible: true,
          };
          tracks.push(newTrack);
          target = newTrack;
        }

        newClip.trackId = target.id;
        return {
          ...prev,
          tracks: tracks.map((t) =>
            t.id === target!.id ? { ...t, clips: [...t.clips, newClip] } : t
          ),
        };
      });

      return newClip;
    },
    [project.tracks, commitProjectChange]
  );

  // 10. AI Camera Motion, Deflicker, Motion Blur, Smart Reframe helpers
  const setClipCameraMotion = useCallback(
    (clipId: string, preset: CameraMotionPreset) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId ? { ...clip, cameraMotionPreset: preset } : clip
          ),
        })),
      }));
    },
    [commitProjectChange]
  );

  const setClipDeflicker = useCallback(
    (clipId: string, enabled: boolean) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId ? { ...clip, deflicker: enabled } : clip
          ),
        })),
      }));
    },
    [commitProjectChange]
  );

  const setClipMotionBlur = useCallback(
    (clipId: string, enabled: boolean) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId ? { ...clip, motionBlur: enabled } : clip
          ),
        })),
      }));
    },
    [commitProjectChange]
  );

  const setClipSmartReframe = useCallback(
    (clipId: string, focus: 'left' | 'center' | 'right' | number) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId ? { ...clip, smartReframeFocus: focus } : clip
          ),
        })),
      }));
    },
    [commitProjectChange]
  );

  // Text helpers
  const addTextClip = useCallback(
    (trackId: string, text: string, startTime = 0, duration = 3, initialData?: Partial<TextLayerData>): VideoClip => {
      const textData: TextLayerData = {
        text,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 54,
        fontWeight: 'bold',
        fillColor: '#FFFFFF',
        color: '#FFFFFF',
        textAlign: 'center',
        alignment: 'center',
        boxPadding: 16,
        padding: 16,
        paddingX: 16,
        paddingY: 16,
        boxRadius: 8,
        borderRadius: 8,
        lineHeight: 1.25,
        letterSpacing: 0,
        shadow: {
          color: 'rgba(0,0,0,0.8)',
          blur: 10,
          offsetX: 2,
          offsetY: 2,
        },
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 10,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        inAnimation: 'none',
        inDuration: 0.8,
        inEasing: 'ease-out',
        animation: {
          type: 'none',
          duration: 0.8,
        },
        ...initialData,
      };

      const newClipId = 'clip-' + Math.random().toString(36).substring(2, 9);
      let createdClip: VideoClip;

      commitProjectChange((prev) => {
        let textTrack = prev.tracks.find((t) => t.id === trackId && t.type === 'text' && !t.locked);
        if (!textTrack) {
          textTrack = prev.tracks.find((t) => t.type === 'text' && !t.locked);
        }

        let updatedTracks = [...prev.tracks];
        if (!textTrack) {
          const newTextTrackId = 'track-text-' + Math.random().toString(36).substring(2, 9);
          textTrack = {
            id: newTextTrackId,
            name: 'Metin & Efektler',
            type: 'text',
            clips: [],
            muted: false,
            locked: false,
            visible: true,
          };
          updatedTracks = [textTrack, ...prev.tracks];
        }

        createdClip = {
          id: newClipId,
          trackId: textTrack.id,
          type: 'text',
          name: `Metin: "${text.substring(0, 15)}${text.length > 15 ? '...' : ''}"`,
          startTime,
          duration,
          trimIn: 0,
          trimOut: duration,
          sourceDuration: duration,
          volume: 1.0,
          muted: false,
          speed: 1.0,
          fadeIn: 0,
          fadeOut: 0,
          transform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
          },
          effects: {},
          textData,
        };

        return {
          ...prev,
          tracks: updatedTracks.map((track) => {
            if (track.id === textTrack!.id) {
              return {
                ...track,
                clips: [...track.clips, createdClip].sort((a, b) => a.startTime - b.startTime),
              };
            }
            return track;
          }),
        };
      });

      setSelectedClipId(newClipId);
      return createdClip!;
    },
    [commitProjectChange]
  );

  // Timeline Transition Operations
  const addTimelineTransition = useCallback(
    (data: Omit<TimelineTransition, 'id'>): TimelineTransition => {
      const newTransition: TimelineTransition = {
        id: 'trans-' + Math.random().toString(36).substring(2, 9),
        trackId: data.trackId,
        type: data.type,
        duration: data.duration ?? 1.0,
        cutTime: data.cutTime,
        leftClipId: data.leftClipId,
        rightClipId: data.rightClipId,
        alignment: data.alignment || 'between',
        easing: data.easing || 'ease-in-out',
        intensity: data.intensity ?? 1.0,
        direction: data.direction,
      };

      commitProjectChange((prev) => {
        const isSameCut = (t: TimelineTransition) =>
          t.id === newTransition.id ||
          (t.trackId === data.trackId && Math.abs(t.cutTime - data.cutTime) < 0.45) ||
          (Boolean(data.leftClipId && data.rightClipId) && t.leftClipId === data.leftClipId && t.rightClipId === data.rightClipId) ||
          (Boolean(data.leftClipId) && t.leftClipId === data.leftClipId && Math.abs(t.cutTime - data.cutTime) < 0.8) ||
          (Boolean(data.rightClipId) && t.rightClipId === data.rightClipId && Math.abs(t.cutTime - data.cutTime) < 0.8);

        const nextTransitions = [
          ...(prev.transitions || []).filter((t) => !isSameCut(t)),
          newTransition,
        ];

        const nextTracks = prev.tracks.map((track) => {
          if (track.id === data.trackId) {
            const trackTransitions = [
              ...(track.transitions || []).filter((t) => !isSameCut(t)),
              newTransition,
            ];

            const nextClips = track.clips.map((clip) => {
              // When a cut-point transition exists, clear redundant clip-level transition badges
              // to prevent duplicate badges and double-rendering on the timeline.
              if (clip.id === data.leftClipId) {
                return {
                  ...clip,
                  transitionOut: undefined,
                };
              }
              if (clip.id === data.rightClipId) {
                return {
                  ...clip,
                  transitionIn: undefined,
                };
              }
              return clip;
            });

            return {
              ...track,
              transitions: trackTransitions,
              clips: nextClips,
            };
          }
          return track;
        });

        return {
          ...prev,
          transitions: nextTransitions,
          tracks: nextTracks,
        };
      });

      setSelectedTransitionId(newTransition.id);
      return newTransition;
    },
    [commitProjectChange]
  );

  const updateTimelineTransition = useCallback(
    (id: string, updates: Partial<TimelineTransition>) => {
      commitProjectChange((prev) => {
        const nextTransitions = (prev.transitions || []).map((t) =>
          t.id === id ? { ...t, ...updates } : t
        );
        const targetTrans = nextTransitions.find((t) => t.id === id);

        const nextTracks = prev.tracks.map((track) => {
          const hasTrans = track.transitions?.some((t) => t.id === id);
          if (!hasTrans && track.id !== targetTrans?.trackId) return track;

          const updatedTrackTransitions = (track.transitions || []).map((t) =>
            t.id === id ? { ...t, ...updates } : t
          );

          let updatedClips = track.clips;
          if (targetTrans) {
            updatedClips = track.clips.map((clip) => {
              if (clip.id === targetTrans.leftClipId && targetTrans.type) {
                return {
                  ...clip,
                  transitionOut: {
                    type: targetTrans.type,
                    duration: targetTrans.duration,
                    easing: targetTrans.easing,
                    intensity: targetTrans.intensity,
                    direction: targetTrans.direction,
                  },
                };
              }
              if (clip.id === targetTrans.rightClipId && targetTrans.type) {
                return {
                  ...clip,
                  transitionIn: {
                    type: targetTrans.type,
                    duration: targetTrans.duration,
                    easing: targetTrans.easing,
                    intensity: targetTrans.intensity,
                    direction: targetTrans.direction,
                  },
                };
              }
              return clip;
            });
          }

          return {
            ...track,
            transitions: updatedTrackTransitions,
            clips: updatedClips,
          };
        });

        return {
          ...prev,
          transitions: nextTransitions,
          tracks: nextTracks,
        };
      });
    },
    [commitProjectChange]
  );

  const deleteTimelineTransition = useCallback(
    (id: string) => {
      commitProjectChange((prev) => {
        const target = prev.transitions?.find((t) => t.id === id);
        const nextTransitions = (prev.transitions || []).filter((t) => t.id !== id);

        const nextTracks = prev.tracks.map((track) => {
          const nextTrackTrans = (track.transitions || []).filter((t) => t.id !== id);
          let nextClips = track.clips;
          if (target) {
            nextClips = track.clips.map((c) => {
              if (c.id === target.leftClipId) return { ...c, transitionOut: undefined };
              if (c.id === target.rightClipId) return { ...c, transitionIn: undefined };
              return c;
            });
          }
          return {
            ...track,
            transitions: nextTrackTrans,
            clips: nextClips,
          };
        });

        return {
          ...prev,
          transitions: nextTransitions,
          tracks: nextTracks,
        };
      });

      setSelectedTransitionId((curr) => (curr === id ? null : curr));
    },
    [commitProjectChange]
  );

  // Effect Segment Operations
  const addEffectSegment = useCallback(
    (data: Omit<EffectSegment, 'id' | 'createdAt'>): EffectSegment => {
      const newSegment: EffectSegment = {
        id: 'effseg-' + Math.random().toString(36).substring(2, 9),
        effectId: data.effectId,
        effectKind: data.effectKind,
        name: data.name,
        targetClipId: data.targetClipId,
        trackId: data.trackId,
        startTime: data.startTime,
        duration: Math.max(0.1, data.duration),
        parameters: data.parameters || {},
        enabled: data.enabled ?? true,
        blendMode: data.blendMode || 'source-over',
        createdAt: Date.now(),
      };

      commitProjectChange((prev) => {
        const isSameSegment = (s: EffectSegment) =>
          s.id === newSegment.id ||
          (data.targetClipId && s.targetClipId === data.targetClipId && s.effectId === data.effectId) ||
          (!data.targetClipId && s.effectId === data.effectId && Math.abs(s.startTime - data.startTime) < 0.25);

        // If targeted to a clip, it stays on the clip only. Otherwise it goes into global effectSegments.
        const nextGlobalSegments = data.targetClipId
          ? (prev.effectSegments || []).filter((s) => !isSameSegment(s))
          : [...(prev.effectSegments || []).filter((s) => !isSameSegment(s)), newSegment];

        const nextTracks = prev.tracks.map((track) => {
          if (data.targetClipId) {
            const hasClip = track.clips.some((c) => c.id === data.targetClipId);
            if (hasClip) {
              return {
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id === data.targetClipId
                    ? {
                        ...clip,
                        effectSegments: [
                          ...(clip.effectSegments || []).filter((s) => !isSameSegment(s)),
                          newSegment,
                        ],
                      }
                    : clip
                ),
              };
            }
          }
          if (track.id === data.trackId) {
            return {
              ...track,
              effectSegments: [
                ...(track.effectSegments || []).filter((s) => !isSameSegment(s)),
                newSegment,
              ],
            };
          }
          return track;
        });

        return {
          ...prev,
          effectSegments: nextGlobalSegments,
          tracks: nextTracks,
        };
      });

      setSelectedEffectSegmentId(newSegment.id);
      return newSegment;
    },
    [commitProjectChange]
  );

  const updateEffectSegment = useCallback(
    (segmentId: string, updates: Partial<EffectSegment>) => {
      commitProjectChange((prev) => {
        const nextGlobalSegments = (prev.effectSegments || []).map((seg) =>
          seg.id === segmentId ? { ...seg, ...updates } : seg
        );

        const nextTracks = prev.tracks.map((track) => ({
          ...track,
          effectSegments: (track.effectSegments || []).map((seg) =>
            seg.id === segmentId ? { ...seg, ...updates } : seg
          ),
          clips: track.clips.map((clip) => ({
            ...clip,
            effectSegments: (clip.effectSegments || []).map((seg) =>
              seg.id === segmentId ? { ...seg, ...updates } : seg
            ),
          })),
        }));

        return {
          ...prev,
          effectSegments: nextGlobalSegments,
          tracks: nextTracks,
        };
      });
    },
    [commitProjectChange]
  );

  const deleteEffectSegment = useCallback(
    (segmentId: string) => {
      commitProjectChange((prev) => {
        const nextGlobalSegments = (prev.effectSegments || []).filter((seg) => seg.id !== segmentId);

        const nextTracks = prev.tracks.map((track) => ({
          ...track,
          effectSegments: (track.effectSegments || []).filter((seg) => seg.id !== segmentId),
          clips: track.clips.map((clip) => ({
            ...clip,
            effectSegments: (clip.effectSegments || []).filter((seg) => seg.id !== segmentId),
          })),
        }));

        return {
          ...prev,
          effectSegments: nextGlobalSegments,
          tracks: nextTracks,
        };
      });

      setSelectedEffectSegmentId((curr) => (curr === segmentId ? null : curr));
    },
    [commitProjectChange]
  );

  const moveEffectSegment = useCallback(
    (segmentId: string, newStartTime: number) => {
      updateEffectSegment(segmentId, { startTime: Math.max(0, newStartTime) });
    },
    [updateEffectSegment]
  );

  const resizeEffectSegment = useCallback(
    (segmentId: string, newDuration: number) => {
      updateEffectSegment(segmentId, { duration: Math.max(0.1, newDuration) });
    },
    [updateEffectSegment]
  );

  // Text Animation Segment Operations
  const addTextAnimationSegment = useCallback(
    (clipId: string, data: Omit<TextAnimationSegment, 'id'>): TextAnimationSegment => {
      const newSegment: TextAnimationSegment = {
        id: 'animseg-' + Math.random().toString(36).substring(2, 9),
        type: data.type,
        animationName: data.animationName,
        startTime: data.startTime ?? 0,
        duration: Math.max(0.1, data.duration ?? 0.8),
        easing: data.easing || 'ease-out',
        speed: data.speed ?? 1.0,
        intensity: data.intensity ?? 1.0,
        delay: data.delay ?? 0,
      };

      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id === clipId) {
              const nextAnimSegments = [...(clip.animationSegments || []), newSegment];
              const updatedTextData = { ...clip.textData } as TextLayerData;
              if (data.type === 'in') {
                updatedTextData.inAnimation = data.animationName as any;
                updatedTextData.inDuration = data.duration;
                updatedTextData.inEasing = data.easing;
              } else if (data.type === 'loop') {
                updatedTextData.loopAnimation = data.animationName as any;
                updatedTextData.loopSpeed = data.speed;
                updatedTextData.loopIntensity = data.intensity;
              } else if (data.type === 'out') {
                updatedTextData.outAnimation = data.animationName as any;
                updatedTextData.outDuration = data.duration;
                updatedTextData.outEasing = data.easing;
              }
              return {
                ...clip,
                animationSegments: nextAnimSegments,
                textData: updatedTextData,
              };
            }
            return clip;
          }),
        })),
      }));

      return newSegment;
    },
    [commitProjectChange]
  );

  const updateTextAnimationSegment = useCallback(
    (clipId: string, segmentId: string, updates: Partial<TextAnimationSegment>) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id === clipId) {
              return {
                ...clip,
                animationSegments: (clip.animationSegments || []).map((seg) =>
                  seg.id === segmentId ? { ...seg, ...updates } : seg
                ),
              };
            }
            return clip;
          }),
        })),
      }));
    },
    [commitProjectChange]
  );

  const deleteTextAnimationSegment = useCallback(
    (clipId: string, segmentId: string) => {
      commitProjectChange((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id === clipId) {
              return {
                ...clip,
                animationSegments: (clip.animationSegments || []).filter(
                  (seg) => seg.id !== segmentId
                ),
              };
            }
            return clip;
          }),
        })),
      }));
    },
    [commitProjectChange]
  );

  // Selected clip getter
  const selectedClip = useCallback((): VideoClip | null => {
    if (!selectedClipId) return null;
    for (const track of project.tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) return clip;
    }
    return null;
  }, [project, selectedClipId]);

  // Project properties setters
  const setProjectName = useCallback((name: string) => {
    setProject((prev) => ({ ...prev, name }));
    setIsDirty(true);
  }, []);

  const setResolution = useCallback((width: number, height: number) => {
    setProject((prev) => ({ ...prev, resolution: { width, height } }));
    setIsDirty(true);
  }, []);

  const setFps = useCallback((fps: number) => {
    setProject((prev) => ({ ...prev, fps }));
    setIsDirty(true);
  }, []);

  const setDuration = useCallback((duration: number) => {
    setProject((prev) => ({ ...prev, duration: Math.max(1, duration) }));
    setIsDirty(true);
  }, []);

  const setBackgroundColor = useCallback((backgroundColor: string) => {
    setProject((prev) => ({ ...prev, backgroundColor }));
    setIsDirty(true);
  }, []);

  // Save / Recovery
  const saveProjectNow = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await saveProjectMetadata(project);
      setSaveStatus('saved');
      setIsDirty(false);
    } catch (err) {
      console.warn('Manual save failed:', err);
      setSaveStatus('error');
    }
  }, [project]);

  const acceptRecovery = useCallback(() => {
    if (recoveredProject) {
      setProject(migrateProject(recoveredProject));
      setHasAutosavePrompt(false);
      setRecoveredProject(null);
    }
  }, [recoveredProject]);

  const declineRecovery = useCallback(async () => {
    if (recoveredProject) {
      await deleteProjectMetadata(recoveredProject.id);
    }
    setHasAutosavePrompt(false);
    setRecoveredProject(null);
  }, [recoveredProject]);

  const resetProject = useCallback(() => {
    setProject(createDefaultProject());
    setSelectedClipId(null);
    setSelectedTrackId(null);
    setSelectedTransitionId(null);
    setSelectedEffectSegmentId(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setIsDirty(false);
    setSaveStatus('saved');
  }, []);

  return {
    project,
    setProject,
    commitProjectChange,
    selectedClipId,
    selectedTrackId,
    selectedTransitionId,
    selectedEffectSegmentId,
    selectedClip: selectedClip(),
    setSelectedClipId,
    setSelectedTrackId,
    setSelectedTransitionId,
    setSelectedEffectSegmentId,
    isDirty,
    saveStatus,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    undo,
    redo,
    // Track ops
    addTrack,
    deleteTrack,
    toggleTrackMute,
    toggleTrackLock,
    toggleTrackVisibility,
    // Clip ops
    addClip,
    updateClip,
    moveClip,
    trimClip,
    splitClip,
    deleteClip,
    rippleDeleteClip,
    duplicateClip,
    copyClip,
    pasteClip,
    hasClipboard,
    detachAudio,
    rippleTrimStart,
    rippleTrimEnd,
    freezeFrame,
    removeSilencesFromClip,
    removeDuplicateRangeFromClip,
    toggleClipVocalMute,
    trimClipEndGlitch,
    trimAllClipsEndGlitch,
    setClipJCut,
    setClipLCut,
    toggleProjectAutoDucking,
    toggleProjectCanvasBlurFill,
    setClipCanvasBlurFill,
    setClipDelogoPatch,
    setClipSpeedRamp,
    applyTransitionToAllCuts,
    toggleProjectAutoWhoosh,
    addProceduralSfxClip,
    setClipCameraMotion,
    setClipDeflicker,
    setClipMotionBlur,
    setClipSmartReframe,
    addTextClip,
    // Transition ops
    addTimelineTransition,
    updateTimelineTransition,
    deleteTimelineTransition,
    // Effect segment ops
    addEffectSegment,
    updateEffectSegment,
    deleteEffectSegment,
    moveEffectSegment,
    resizeEffectSegment,
    // Text animation segment ops
    addTextAnimationSegment,
    updateTextAnimationSegment,
    deleteTextAnimationSegment,
    // Project property ops
    setProjectName,
    setResolution,
    setFps,
    setDuration,
    setBackgroundColor,
    // Persistence
    saveProjectNow,
    hasAutosavePrompt,
    acceptRecovery,
    declineRecovery,
    resetProject,
  };
}
