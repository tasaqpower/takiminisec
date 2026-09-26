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
} from '../types';
import { saveProjectMetadata, loadLatestProject, deleteProjectMetadata } from '../db';

const MAX_HISTORY = 50;

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
    tracks: [
      {
        id: textTrackId,
        name: 'Metin & Efektler',
        type: 'text',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
      },
      {
        id: videoTrackId,
        name: 'Video & Görsel 1',
        type: 'video',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
      },
      {
        id: audioTrackId,
        name: 'Ses & Müzik 1',
        type: 'audio',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
      },
    ],
  };
}

export function useVideoProject() {
  const [project, setProject] = useState<VideoProject>(createDefaultProject);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [hasAutosavePrompt, setHasAutosavePrompt] = useState(false);
  const [recoveredProject, setRecoveredProject] = useState<VideoProject | null>(null);

  const undoStackRef = useRef<VideoProject[]>([]);
  const redoStackRef = useRef<VideoProject[]>([]);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Check for existing saved project in IndexedDB on first load
  useEffect(() => {
    async function checkSaved() {
      try {
        const latest = await loadLatestProject();
        if (latest && latest.tracks && latest.tracks.length > 0) {
          const totalClips = latest.tracks.reduce((acc, t) => acc + t.clips.length, 0);
          if (totalClips > 0) {
            setRecoveredProject(latest);
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

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      saveProjectMetadata(project).catch((err) => console.warn('Autosave failed:', err));
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [project]);

  // Recalculate duration automatically when clips change
  const updateProjectDuration = useCallback((tracks: TimelineTrack[]): number => {
    let maxTime = 5;
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
          duration: Math.max(next.duration, computedDuration),
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
        id: 'clip-' + Math.random().toString(36).substring(2, 9),
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
    (clipId: string, splitTime: number): { leftClip: VideoClip; rightClip: VideoClip } | null => {
      let result: { leftClip: VideoClip; rightClip: VideoClip } | null = null;

      commitProjectChange((prev) => {
        let foundTrackId = '';
        let targetClip: VideoClip | null = null;

        for (const track of prev.tracks) {
          const c = track.clips.find((clip) => clip.id === clipId);
          if (c) {
            targetClip = c;
            foundTrackId = track.id;
            break;
          }
        }

        if (!targetClip) return prev;

        const clipStart = targetClip.startTime;
        const clipEnd = clipStart + targetClip.duration;

        // Split time must be strictly inside the clip bounds
        if (splitTime <= clipStart + 0.05 || splitTime >= clipEnd - 0.05) {
          return prev;
        }

        const leftDuration = splitTime - clipStart;
        const rightDuration = clipEnd - splitTime;
        const speed = targetClip.speed || 1.0;

        const leftTrimIn = targetClip.trimIn;
        const leftTrimOut = targetClip.trimIn + leftDuration * speed;

        const rightTrimIn = leftTrimOut;
        const rightTrimOut = targetClip.trimOut;

        const leftClip: VideoClip = {
          ...targetClip,
          id: 'clip-' + Math.random().toString(36).substring(2, 9),
          duration: leftDuration,
          trimIn: leftTrimIn,
          trimOut: leftTrimOut,
          transitionOut: undefined, // Clear exit transition on split edge
        };

        const rightClip: VideoClip = {
          ...targetClip,
          id: 'clip-' + Math.random().toString(36).substring(2, 9),
          name: `${targetClip.name} (Bölüm 2)`,
          startTime: splitTime,
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
                .filter((c) => c.id !== clipId)
                .concat([leftClip, rightClip])
                .sort((a, b) => a.startTime - b.startTime);
              return { ...track, clips: newClips };
            }
            return track;
          }),
        };
      });

      if (result) {
        setSelectedClipId((result as { leftClip: VideoClip; rightClip: VideoClip }).rightClip.id);
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
    await saveProjectMetadata(project);
    setIsDirty(false);
  }, [project]);

  const acceptRecovery = useCallback(() => {
    if (recoveredProject) {
      setProject(recoveredProject);
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
    undoStackRef.current = [];
    redoStackRef.current = [];
    setIsDirty(false);
  }, []);

  return {
    project,
    setProject,
    selectedClipId,
    selectedTrackId,
    selectedClip: selectedClip(),
    setSelectedClipId,
    setSelectedTrackId,
    isDirty,
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
    detachAudio,
    addTextClip,
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
