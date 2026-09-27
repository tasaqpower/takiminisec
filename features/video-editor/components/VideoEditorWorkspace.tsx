'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { EditorDragDropProvider } from '../context/DragDropContext';
import { ResizableDivider } from './ui/ResizableDivider';
import '../theme/video-editor.css';

interface WorkspaceProps {
  onNavigateHome?: () => void;
}

export const VideoEditorWorkspace: React.FC<WorkspaceProps> = ({ onNavigateHome }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarDrawerWidth, setSidebarDrawerWidth] = useState(280);
  const [inspectorWidth, setInspectorWidth] = useState(300);

  useEffect(() => {
    (window as any).__setSidebarDrawerWidth = (w: number) => setSidebarDrawerWidth(w);
  }, []);
  const [timelineHeight, setTimelineHeight] = useState(() => {
    if (typeof window !== 'undefined' && window.innerHeight) {
      return Math.round(Math.max(240, Math.min(window.innerHeight * 0.55, window.innerHeight * 0.34)));
    }
    return 300;
  });
  const {
    project,
    setProject,
    selectedClipId,
    selectedClip,
    selectedTransitionId,
    selectedEffectSegmentId,
    setSelectedClipId,
    setSelectedTransitionId,
    setSelectedEffectSegmentId,
    isDirty,
    saveStatus,
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
    addTimelineTransition,
    updateTimelineTransition,
    deleteTimelineTransition,
    addEffectSegment,
    updateEffectSegment,
    deleteEffectSegment,
    moveEffectSegment,
    resizeEffectSegment,
    addTextAnimationSegment,
    updateTextAnimationSegment,
    deleteTextAnimationSegment,
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

  useEffect(() => {
    (window as any).__formaEditor = {
      project,
      setProject,
      addClip,
      updateClip,
      addTimelineTransition,
      seek,
      play,
      pause,
      currentTime,
      isPlaying,
    };
  }, [project, setProject, addClip, updateClip, addTimelineTransition, seek, play, pause, currentTime, isPlaying]);

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
    (target: string | number, durationSec = 2.0) => {
      let startTime = typeof target === 'number' ? target : 0;
      if (typeof target === 'string') {
        const found = project.tracks.flatMap((t) => t.clips).find((c) => c.id === target);
        if (found) {
          startTime = found.startTime ?? (found as any).start ?? 0;
        }
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      pause();
      seek(startTime);
      setTimeout(() => {
        play();
        previewTimerRef.current = setTimeout(() => {
          pause();
          previewTimerRef.current = null;
        }, Math.max(1.2, durationSec) * 1000);
      }, 50);
    },
    [project.tracks, seek, play, pause]
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
    <EditorDragDropProvider>
      <div className="forma-video-editor flex flex-col h-screen w-screen bg-[#0B0D10] text-[#E7EAF0] overflow-hidden font-sans select-none">
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
          saveStatus={saveStatus}
        />

        {/* 2. MIDDLE AREA (Sidebar + Preview Canvas + Properties Inspector) */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Left Sidebar */}
          <VideoEditorSidebar
            isOpen={isSidebarOpen}
            onToggleOpen={() => setIsSidebarOpen((prev) => !prev)}
            drawerWidth={sidebarDrawerWidth}
            style={{ width: isSidebarOpen ? 46 + sidebarDrawerWidth : 46 }}
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
            onAddTimelineTransition={addTimelineTransition}
            onAddEffectSegment={addEffectSegment}
            onAddTextAnimationSegment={addTextAnimationSegment}
          />

          {isSidebarOpen && (
            <ResizableDivider
              direction="vertical"
              onResize={(delta) => setSidebarDrawerWidth((prev) => Math.max(220, Math.min(480, prev + delta)))}
              onReset={() => setSidebarDrawerWidth(280)}
            />
          )}

          {/* Center Preview Viewport */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
              onAddClip={addClip}
              onUpdateClip={updateClip}
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
          </div>

          <ResizableDivider
            direction="vertical"
            onResize={(delta) => setInspectorWidth((prev) => Math.max(260, Math.min(380, prev - delta)))}
            onReset={() => setInspectorWidth(300)}
          />

          {/* Right Inspector */}
          <VideoPropertiesPanel
            style={{ width: inspectorWidth }}
            project={project}
            selectedClip={selectedClip}
            currentTime={currentTime}
            selectedTransitionId={selectedTransitionId}
            selectedEffectSegmentId={selectedEffectSegmentId}
            onUpdateClip={updateClip}
            onDeleteClip={deleteClip}
            onRippleDeleteClip={rippleDeleteClip}
            onDuplicateClip={duplicateClip}
            onSetBackgroundColor={setBackgroundColor}
            onSetDuration={setDuration}
            onDetachAudio={detachAudio}
            onPreviewAnimation={handlePreviewAnimation}
            onSeek={seek}
            onUpdateTimelineTransition={updateTimelineTransition}
            onDeleteTimelineTransition={deleteTimelineTransition}
            onUpdateEffectSegment={updateEffectSegment}
            onDeleteEffectSegment={deleteEffectSegment}
            onDeselectTransition={() => setSelectedTransitionId(null)}
            onDeselectEffectSegment={() => setSelectedEffectSegmentId(null)}
          />
        </div>

        {/* Resizer between middle area and timeline */}
        <ResizableDivider
          direction="horizontal"
          onResize={(delta) =>
            setTimelineHeight((prev) => {
              const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.55 : 520;
              return Math.max(240, Math.min(maxH, prev - delta));
            })
          }
          onReset={() => {
            const defH = typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.34) : 300;
            setTimelineHeight(defH);
          }}
        />

        {/* 3. BOTTOM TIMELINE */}
        <VideoTimeline
          style={{ height: timelineHeight }}
          project={project}
          currentTime={currentTime}
          selectedClipId={selectedClipId}
          selectedTransitionId={selectedTransitionId}
          selectedEffectSegmentId={selectedEffectSegmentId}
          onSelectClip={(clipId) => {
            setSelectedClipId(clipId);
            if (clipId) {
              setSelectedTransitionId(null);
              setSelectedEffectSegmentId(null);
            }
          }}
          onSelectTransition={(transitionId) => {
            setSelectedTransitionId(transitionId);
            if (transitionId) {
              setSelectedClipId(null);
              setSelectedEffectSegmentId(null);
            }
          }}
          onSelectEffectSegment={(segmentId) => {
            setSelectedEffectSegmentId(segmentId);
            if (segmentId) {
              setSelectedClipId(null);
              setSelectedTransitionId(null);
            }
          }}
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
          onAddClip={addClip}
          onAddTimelineTransition={addTimelineTransition}
          onUpdateTimelineTransition={updateTimelineTransition}
          onDeleteTimelineTransition={deleteTimelineTransition}
          onAddEffectSegment={addEffectSegment}
          onUpdateEffectSegment={updateEffectSegment}
          onDeleteEffectSegment={deleteEffectSegment}
          onMoveEffectSegment={moveEffectSegment}
          onResizeEffectSegment={resizeEffectSegment}
          onAddTextAnimationSegment={addTextAnimationSegment}
          onUpdateTextAnimationSegment={updateTextAnimationSegment}
          onDeleteTextAnimationSegment={deleteTextAnimationSegment}
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
    </EditorDragDropProvider>
  );
};
