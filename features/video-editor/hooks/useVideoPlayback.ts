import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoProject } from '../types';
import { audioMixer } from '../engine/audioMixer';
import { preloadProjectMedia, setPlaybackActiveState, notifyCanvasNeedsRedraw } from '../engine/previewRenderer';

interface PlaybackHookOptions {
  project: VideoProject;
  onTimeUpdate?: (time: number) => void;
}

export function useVideoPlayback({ project, onTimeUpdate }: PlaybackHookOptions) {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  const isPlayingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const playbackRateRef = useRef(1.0);
  const isLoopingRef = useRef(false);
  const lastRafTimeRef = useRef<number | null>(null);
  const lastAudioSyncTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const projectRef = useRef(project);

  // Keep refs in sync
  isPlayingRef.current = isPlaying;
  currentTimeRef.current = currentTime;
  playbackRateRef.current = playbackRate;
  isLoopingRef.current = isLooping;
  projectRef.current = project;

  const duration = Math.max(1, project.duration);

  // Audio sync helper
  const syncAudio = useCallback(
    (time: number, playing: boolean, forceSeek = false) => {
      audioMixer
        .syncPlayback(projectRef.current, time, playing, forceSeek, playbackRateRef.current)
        .catch((err) => {
          console.warn('[FORMA Playback] Audio sync error:', err);
        });
    },
    []
  );

  const pause = useCallback(() => {
    setPlaybackActiveState(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
    lastRafTimeRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    audioMixer.stopAll();
    notifyCanvasNeedsRedraw();
  }, []);

  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    setPlaybackActiveState(true);

    // Browser autoplay policy: ensure AudioContext is awake immediately on user click
    try {
      audioMixer.getAudioContext();
    } catch {}

    // If at the end, restart from 0 (forward), or from duration if rewinding
    if (playbackRateRef.current >= 0 && currentTimeRef.current >= duration) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
    } else if (playbackRateRef.current < 0 && currentTimeRef.current <= 0) {
      currentTimeRef.current = duration;
      setCurrentTime(duration);
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    lastRafTimeRef.current = performance.now();
    lastAudioSyncTimeRef.current = performance.now();

    if (playbackRateRef.current > 0) {
      syncAudio(currentTimeRef.current, true, true);
    } else {
      audioMixer.stopAll();
    }

    const tick = (now: number) => {
      if (!isPlayingRef.current) return;

      if (lastRafTimeRef.current !== null) {
        const deltaSec = ((now - lastRafTimeRef.current) / 1000) * playbackRateRef.current;
        let nextTime = currentTimeRef.current + deltaSec;

        if (playbackRateRef.current < 0) {
          // Shuttle Rewind / Reverse Playback
          if (nextTime <= 0) {
            nextTime = 0;
            currentTimeRef.current = 0;
            setCurrentTime(0);
            pause();
            playbackRateRef.current = 1.0;
            setPlaybackRate(1.0);
            return;
          } else {
            currentTimeRef.current = nextTime;
            setCurrentTime(nextTime);
            onTimeUpdate?.(nextTime);
            audioMixer.stopAll();
          }
        } else {
          // Forward Playback (1x, 1.5x, 2x, 4x)
          if (nextTime >= duration) {
            if (isLoopingRef.current) {
              nextTime = 0;
              currentTimeRef.current = 0;
              setCurrentTime(0);
              syncAudio(0, true, true);
            } else {
              nextTime = duration;
              currentTimeRef.current = duration;
              setCurrentTime(duration);
              pause();
              playbackRateRef.current = 1.0;
              setPlaybackRate(1.0);
              return;
            }
          } else {
            currentTimeRef.current = nextTime;
            setCurrentTime(nextTime);
            onTimeUpdate?.(nextTime);

            // Continuous audio synchronization across clip boundaries
            let crossedBoundary = false;
            const prevT = currentTimeRef.current;
            for (const track of projectRef.current.tracks) {
              if (track.type === 'video' || track.type === 'audio') {
                for (const clip of track.clips) {
                  if (
                    (clip.startTime > prevT && clip.startTime <= nextTime) ||
                    (clip.startTime + clip.duration > prevT && clip.startTime + clip.duration <= nextTime)
                  ) {
                    crossedBoundary = true;
                    break;
                  }
                }
                if (crossedBoundary) break;
              }
            }

            if (crossedBoundary || now - lastAudioSyncTimeRef.current >= 40) {
              lastAudioSyncTimeRef.current = now;
              syncAudio(nextTime, true, false);
            }
          }
        }
      }

      lastRafTimeRef.current = now;
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [duration, pause, syncAudio, onTimeUpdate]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  // Professional J-K-L Shuttle Controls
  const shuttleForward = useCallback(() => {
    // Standard NLE shuttle forward (L key): 1x -> 1.5x -> 2x -> 4x
    let nextRate = 1.0;
    if (!isPlayingRef.current) {
      nextRate = 1.0;
    } else if (playbackRateRef.current < 0) {
      nextRate = 1.0;
    } else if (playbackRateRef.current < 1.4) {
      nextRate = 1.5;
    } else if (playbackRateRef.current < 1.9) {
      nextRate = 2.0;
    } else {
      nextRate = 4.0;
    }

    playbackRateRef.current = nextRate;
    setPlaybackRate(nextRate);

    if (!isPlayingRef.current) {
      play();
    } else {
      syncAudio(currentTimeRef.current, true, false);
    }
  }, [play, syncAudio]);

  const shuttlePause = useCallback(() => {
    // Standard NLE pause (K key)
    pause();
    playbackRateRef.current = 1.0;
    setPlaybackRate(1.0);
  }, [pause]);

  const shuttleBackward = useCallback(() => {
    // Standard NLE shuttle reverse / slow down (J key)
    let nextRate = -1.0;
    if (!isPlayingRef.current) {
      nextRate = -1.0;
    } else if (playbackRateRef.current > 2.5) {
      nextRate = 2.0;
    } else if (playbackRateRef.current > 1.6) {
      nextRate = 1.5;
    } else if (playbackRateRef.current > 1.1) {
      nextRate = 1.0;
    } else if (playbackRateRef.current > 0) {
      nextRate = -1.0;
    } else if (playbackRateRef.current > -1.4) {
      nextRate = -1.5;
    } else if (playbackRateRef.current > -1.9) {
      nextRate = -2.0;
    } else {
      nextRate = -4.0;
    }

    playbackRateRef.current = nextRate;
    setPlaybackRate(nextRate);

    if (!isPlayingRef.current) {
      if (currentTimeRef.current <= 0) {
        currentTimeRef.current = duration;
        setCurrentTime(duration);
      }
      play();
    } else {
      if (nextRate < 0) {
        audioMixer.stopAll();
      } else {
        syncAudio(currentTimeRef.current, true, false);
      }
    }
  }, [duration, play, syncAudio]);

  const seek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(duration, time));
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      onTimeUpdate?.(clamped);

      if (isPlayingRef.current) {
        syncAudio(clamped, true, true);
      } else {
        syncAudio(clamped, false, true);
      }
    },
    [duration, onTimeUpdate, syncAudio]
  );

  const seekRelative = useCallback(
    (deltaSec: number) => {
      seek(currentTimeRef.current + deltaSec);
    },
    [seek]
  );

  // Background preload whenever project changes
  useEffect(() => {
    audioMixer.preloadProjectAudio(project).catch((err) => {
      console.warn('[FORMA Playback] Audio preloading failed:', err);
    });
    preloadProjectMedia(project).catch((err) => {
      console.warn('[FORMA Playback] Media preloading failed:', err);
    });

    if (isPlayingRef.current) {
      syncAudio(currentTimeRef.current, true, false);
    }
  }, [project, syncAudio]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      audioMixer.stopAll();
    };
  }, []);

  return {
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    isLooping,
    play,
    pause,
    togglePlay,
    seek,
    seekRelative,
    setPlaybackRate,
    setIsLooping,
    shuttleForward,
    shuttlePause,
    shuttleBackward,
  };
}
