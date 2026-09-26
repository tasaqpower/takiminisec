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
  const rafIdRef = useRef<number | null>(null);

  // Keep refs in sync
  isPlayingRef.current = isPlaying;
  currentTimeRef.current = currentTime;
  playbackRateRef.current = playbackRate;
  isLoopingRef.current = isLooping;

  const duration = Math.max(1, project.duration);

  // Audio sync helper
  const syncAudio = useCallback(
    (time: number, playing: boolean) => {
      audioMixer.syncPlayback(project, time, playing).catch((err) => {
        console.warn('Audio sync error:', err);
      });
    },
    [project]
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

    // If at the end, restart from 0
    if (currentTimeRef.current >= duration) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    lastRafTimeRef.current = performance.now();

    syncAudio(currentTimeRef.current, true);

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
            syncAudio(0, true);
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
        syncAudio(clamped, true);
      } else {
        syncAudio(clamped, false);
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
