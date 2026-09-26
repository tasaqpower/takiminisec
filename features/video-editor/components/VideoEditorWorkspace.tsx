'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useVideoProject } from '../hooks/useVideoProject';
import { useVideoPlayback } from '../hooks/useVideoPlayback';
import { useShortcuts } from '../hooks/useShortcuts';
import { VideoEditorTopbar } from './VideoEditorTopbar';
import { VideoEditorSidebar } from './VideoEditorSidebar';
import { VideoPreviewArea } from './VideoPreviewArea';
import { VideoPropertiesPanel } from './VideoPropertiesPanel';
import { VideoTimeline } from './VideoTimeline';
import { VideoExportModal } from './VideoExportModal';
import { VideoAiModal } from './VideoAiModal';
import { VideoRecoveryModal } from './VideoRecoveryModal';
import { VideoShortcutsModal } from './VideoShortcutsModal';

interface WorkspaceProps {
  onNavigateHome?: () => void;
}

export const VideoEditorWorkspace: React.FC<WorkspaceProps> = ({ onNavigateHome }) => {
  const {
    project,
    setProject,
    selectedClipId,
    selectedClip,
    setSelectedClipId,
    isDirty,
    canUndo,
    canRedo,
    undo,
    redo,
    addTrack,
    deleteTrack,
    toggleTrackMute,
    toggleTrackLock,
    toggleTrackVisibility,
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
    setProjectName,
    setResolution,
    setFps,
    setDuration,
    setBackgroundColor,
    hasAutosavePrompt,
    acceptRecovery,
    declineRecovery,
  } = useVideoProject();

  const {
    currentTime,
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
  } = useVideoPlayback({ project });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Return home guard
  const handleHomeClick = useCallback(() => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        'Kaydedilmemiş değişiklikleriniz bulunuyor. Ana sayfaya dönmek istediğinize emin misiniz?'
      );
      if (!confirmLeave) return;
    }
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  }, [isDirty, onNavigateHome]);

  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Live animation preview playback
  const handlePreviewAnimation = useCallback(
    (clipStartTime: number, durationSec = 2.0) => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      pause();
      seek(clipStartTime);
      setTimeout(() => {
        play();
        previewTimerRef.current = setTimeout(() => {
          pause();
          previewTimerRef.current = null;
        }, Math.max(1.2, durationSec) * 1000);
      }, 50);
    },
    [seek, play, pause]
  );

  // Keyboard shortcuts
  useShortcuts({
    onTogglePlay: togglePlay,
    onSplit: () => {
      if (selectedClipId) {
        splitClip(selectedClipId, currentTime);
      }
    },
    onDelete: () => {
      if (selectedClipId) deleteClip(selectedClipId);
    },
    onRippleDelete: () => {
      if (selectedClipId) rippleDeleteClip(selectedClipId);
    },
    onDuplicate: () => {
      if (selectedClipId) duplicateClip(selectedClipId);
    },
    onUndo: undo,
    onRedo: redo,
    onStepForward: (sec) => seekRelative(sec),
    onStepBackward: (sec) => seekRelative(-sec),
    onZoomIn: () => {},
    onZoomOut: () => {},
    onJumpStart: () => seek(0),
    onJumpEnd: () => seek(project.duration),
    onDeselect: () => setSelectedClipId(null),
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090d13] text-gray-100 overflow-hidden font-sans select-none">
      {/* 1. TOPBAR */}
      <VideoEditorTopbar
        project={project}
        onUpdateProjectName={setProjectName}
        onUpdateResolution={setResolution}
        onUpdateFps={setFps}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenAi={() => setIsAiModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onNavigateHome={handleHomeClick}
        isDirty={isDirty}
      />

      {/* 2. MIDDLE AREA (Sidebar + Preview Canvas + Properties Inspector) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <VideoEditorSidebar
          project={project}
          onAddClip={addClip}
          onAddTextClip={addTextClip}
          onAddTrack={addTrack}
          onSetBackgroundColor={setBackgroundColor}
          onSetDuration={setDuration}
          currentTime={currentTime}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
          onPreviewAnimation={handlePreviewAnimation}
          onUpdateClipEffects={(clipId, effects) => updateClip(clipId, { effects })}
          onUpdateClip={updateClip}
        />

        {/* Center Preview Viewport */}
        <VideoPreviewArea
          project={project}
          currentTime={currentTime}
          isPlaying={isPlaying}
          playbackRate={playbackRate}
          isLooping={isLooping}
          onTogglePlay={togglePlay}
          onSeek={seek}
          onStepForward={(s) => seekRelative(s)}
          onStepBackward={(s) => seekRelative(-s)}
          onSetPlaybackRate={setPlaybackRate}
          onSetIsLooping={setIsLooping}
          selectedClip={selectedClip}
          onSelectClip={setSelectedClipId}
          onUpdateClipText={(clipId, text) => {
            const clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
            if (clip && clip.textData) {
              updateClip(clipId, {
                textData: {
                  ...clip.textData,
                  text,
                },
              });
            }
          }}
          onUpdateClipTransform={(clipId, transform) => {
            updateClip(clipId, {
              transform: {
                ...(selectedClip?.transform || { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }),
                ...transform,
              },
            });
          }}
        />

        {/* Right Inspector */}
        <VideoPropertiesPanel
          project={project}
          selectedClip={selectedClip}
          onUpdateClip={updateClip}
          onDeleteClip={deleteClip}
          onRippleDeleteClip={rippleDeleteClip}
          onDuplicateClip={duplicateClip}
          onSetBackgroundColor={setBackgroundColor}
          onSetDuration={setDuration}
          onDetachAudio={detachAudio}
          onPreviewAnimation={handlePreviewAnimation}
          onSeek={seek}
        />
      </div>

      {/* 3. BOTTOM TIMELINE */}
      <VideoTimeline
        project={project}
        currentTime={currentTime}
        selectedClipId={selectedClipId}
        onSelectClip={setSelectedClipId}
        onSeek={seek}
        onSplitClip={splitClip}
        onDeleteClip={deleteClip}
        onRippleDeleteClip={rippleDeleteClip}
        onDuplicateClip={duplicateClip}
        onMoveClip={moveClip}
        onTrimClip={trimClip}
        onAddTrack={addTrack}
        onDeleteTrack={deleteTrack}
        onToggleTrackMute={toggleTrackMute}
        onToggleTrackLock={toggleTrackLock}
        onToggleTrackVisibility={toggleTrackVisibility}
        onDetachAudio={detachAudio}
        onUpdateClipSpeed={(clipId, speed) => updateClip(clipId, { speed })}
        onToggleClipMute={(clipId) => {
          const clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
          if (clip) updateClip(clipId, { muted: !clip.muted });
        }}
        onUpdateClip={updateClip}
      />

      {/* 4. MODALS */}
      <VideoExportModal
        project={project}
        currentTime={currentTime}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      <VideoAiModal
        project={project}
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyAction={(updater) => {
          setProject((prev) => updater(prev));
        }}
      />

      <VideoRecoveryModal
        isOpen={hasAutosavePrompt}
        onAccept={acceptRecovery}
        onDecline={declineRecovery}
        project={project}
      />

      <VideoShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
};
