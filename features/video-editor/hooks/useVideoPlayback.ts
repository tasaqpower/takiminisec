import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoProject } from '../types';
import { audioMixer } from '../engine/audioMixer';

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
      audioMixer.syncPlayback(projectRef.current, time, playing, forceSeek).catch((err) => {
        console.warn('[FORMA Playback] Audio sync error:', err);
      });
    },
    []
  );

  const pause = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    lastRafTimeRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    audioMixer.stopAll();
  }, []);

  const play = useCallback(() => {
    if (isPlayingRef.current) return;

    // Browser autoplay policy: ensure AudioContext is awake immediately on user click
    try {
      audioMixer.getAudioContext();
    } catch {}

    // If at the end, restart from 0
    if (currentTimeRef.current >= duration) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    lastRafTimeRef.current = performance.now();
    lastAudioSyncTimeRef.current = performance.now();

    syncAudio(currentTimeRef.current, true, true);

    const tick = (now: number) => {
      if (!isPlayingRef.current) return;

      if (lastRafTimeRef.current !== null) {
        const deltaSec = ((now - lastRafTimeRef.current) / 1000) * playbackRateRef.current;
        let nextTime = currentTimeRef.current + deltaSec;

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
            return;
          }
        } else {
          currentTimeRef.current = nextTime;
          setCurrentTime(nextTime);
          onTimeUpdate?.(nextTime);

          // Continuous audio synchronization across clip boundaries
          if (now - lastAudioSyncTimeRef.current >= 80) {
            lastAudioSyncTimeRef.current = now;
            syncAudio(nextTime, true, false);
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
  };
}
