import React from 'react';
import {
  VideoProject,
  VideoClip,
  TimelineTransition,
  EffectSegment,
  TextAnimationSegment,
  ClipEffects,
} from '../types';
import {
  FolderOpen,
  Type,
  Music,
  Shuffle,
  Wand2,
  Shapes,
  Subtitles,
  Settings,
} from 'lucide-react';
import { ToolRailButton } from './ui/ToolRailButton';
import { PanelHeader } from './ui/PanelHeader';
import { MediaTab } from './sidebar/MediaTab';
import { TextTab } from './sidebar/TextTab';
import { AudioTab } from './sidebar/AudioTab';
import { TransitionsTab } from './sidebar/TransitionsTab';
import { EffectsTab } from './sidebar/EffectsTab';
import { ElementsTab } from './sidebar/ElementsTab';
import { SubtitlesTab } from './sidebar/SubtitlesTab';
import { SettingsTab } from './sidebar/SettingsTab';

export type TabType = 'media' | 'text' | 'audio' | 'transitions' | 'filters' | 'elements' | 'subtitles' | 'settings';

export interface VideoEditorSidebarProps {
  project: VideoProject;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  activeTab?: TabType;
  onSelectTab?: (tab: TabType) => void;
  drawerWidth?: number;
  onAddClip: (trackId: string, clipData: Partial<VideoClip>) => VideoClip;
  onAddTextClip: (trackId: string, text: string, startTime?: number, duration?: number, initialData?: any) => VideoClip;
  onAddTrack: (type: 'video' | 'audio' | 'text' | 'subtitle', name?: string) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetDuration: (duration: number) => void;
  currentTime: number;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string | null) => void;
  onPreviewAnimation?: (target: string | number, duration?: number) => void;
  onUpdateClipEffects?: (clipId: string, effects: Partial<ClipEffects>) => void;
  onUpdateClip?: (clipId: string, updates: Partial<VideoClip>) => void;
  onAddTimelineTransition?: (transition: Omit<TimelineTransition, 'id'>) => TimelineTransition;
  onAddEffectSegment?: (segment: Omit<EffectSegment, 'id' | 'createdAt'>) => EffectSegment;
  onAddTextAnimationSegment?: (clipId: string, segment: Omit<TextAnimationSegment, 'id'>) => TextAnimationSegment;
  className?: string;
  style?: React.CSSProperties;
}

const RAIL_TABS: { id: TabType; label: string; icon: React.ComponentType<{ className?: string; size?: number }> }[] = [
  { id: 'media', label: 'Medya', icon: FolderOpen },
  { id: 'text', label: 'Metin', icon: Type },
  { id: 'audio', label: 'Ses', icon: Music },
  { id: 'transitions', label: 'Geçiş', icon: Shuffle },
  { id: 'filters', label: 'Efekt', icon: Wand2 },
  { id: 'elements', label: 'Öğeler', icon: Shapes },
  { id: 'subtitles', label: 'Altyazı', icon: Subtitles },
  { id: 'settings', label: 'Ayarlar', icon: Settings },
];

export const VideoEditorSidebar: React.FC<VideoEditorSidebarProps> = ({
  project,
  isOpen = true,
  onToggleOpen,
  activeTab = 'media',
  onSelectTab,
  drawerWidth = 280,
  onAddClip,
  onAddTextClip,
  onAddTrack,
  onSetBackgroundColor,
  onSetDuration,
  currentTime,
  selectedClipId,
  onSelectClip,
  onPreviewAnimation,
  onUpdateClipEffects,
  onUpdateClip,
  onAddTimelineTransition,
  onAddEffectSegment,
  onAddTextAnimationSegment,
  className,
  style,
}) => {
  const [internalActiveTab, setInternalActiveTab] = React.useState<TabType>('media');
  const [internalIsOpen, setInternalIsOpen] = React.useState<boolean>(true);

  const currentTab = onSelectTab ? activeTab : internalActiveTab;
  const isDrawerVisible = onToggleOpen ? isOpen : internalIsOpen;

  const handleTabClick = (tabId: TabType) => {
    if (tabId === currentTab && isDrawerVisible) {
      // Toggle close if already open
      if (onToggleOpen) onToggleOpen();
      else setInternalIsOpen(false);
    } else {
      // Open or switch tab
      if (onSelectTab) onSelectTab(tabId);
      else setInternalActiveTab(tabId);

      if (!isDrawerVisible) {
        if (onToggleOpen) onToggleOpen();
        else setInternalIsOpen(true);
      }
    }
  };

  const handleCloseDrawer = () => {
    if (onToggleOpen) onToggleOpen();
    else setInternalIsOpen(false);
  };

  // Helper to find track
  const findTrack = (type: 'video' | 'audio' | 'text' | 'subtitle') => {
    const t = project.tracks.find((track) => track.type === type && !track.locked);
    if (t) return t.id;
    if (type === 'text' || type === 'subtitle') {
      return '';
    }
    return project.tracks[0]?.id || '';
  };

  const getNextClipStartTime = (trackId: string): number => {
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track || track.clips.length === 0) return currentTime;
    if (currentTime > 0) return currentTime;
    return Math.max(...track.clips.map((c) => c.startTime + c.duration), 0);
  };

  const handleAddText = (text = 'Yeni Metin') => {
    let targetTrackId = findTrack('text');
    if (!targetTrackId) {
      onAddTrack('text', 'Metin Kanalı');
      const updated = project.tracks.find((t) => t.type === 'text');
      targetTrackId = updated?.id || project.tracks[0]?.id || '';
    }
    const startTime = getNextClipStartTime(targetTrackId);
    onAddTextClip(targetTrackId, text, startTime, 3);
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case 'media':
        return 'Proje Medyası';
      case 'text':
        return 'Metin Şablonları';
      case 'audio':
        return 'Ses ve Müzik';
      case 'transitions':
        return 'Geçiş Efektleri';
      case 'filters':
        return 'Görsel Efektler';
      case 'elements':
        return 'Grafik Öğeler';
      case 'subtitles':
        return 'Otomatik Altyazı';
      case 'settings':
        return 'Proje Ayarları';
      default:
        return 'Kütüphane';
    }
  };

  return (
    <aside
      className={`bg-[#0B0D10] border-r border-[#292F39] flex shrink-0 select-none z-10 overflow-hidden ${
        className || ''
      }`}
      style={style || { width: isDrawerVisible ? 46 + drawerWidth : 46 }}
    >
      {/* 1. SOL DİKEY ARAÇ RAYI (Tool Rail - 46px) */}
      <div className="w-[46px] bg-[#0B0D10] border-r border-[#292F39] flex flex-col items-center py-1.5 shrink-0 select-none z-10">
        <div className="flex flex-col items-center gap-0.5 w-full">
          {RAIL_TABS.map((tab) => (
            <ToolRailButton
              key={tab.id}
              id={tab.id}
              icon={tab.icon}
              label={tab.label}
              isActive={isDrawerVisible && currentTab === tab.id}
              onClick={() => handleTabClick(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* 2. İÇERİK ÇEKMECESİ (Content Drawer) */}
      {isDrawerVisible && (
        <div
          className="flex-1 flex flex-col min-w-0 bg-[#111419] overflow-hidden"
          style={{ width: drawerWidth }}
        >
          {/* Drawer Header with Title and Close button */}
          <PanelHeader
            title={getTabTitle()}
            onClose={handleCloseDrawer}
          />

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {currentTab === 'media' && (
              <MediaTab
                project={project}
                currentTime={currentTime}
                selectedClipId={selectedClipId}
                onAddClip={onAddClip}
                findTrack={findTrack}
                getNextClipStartTime={getNextClipStartTime}
              />
            )}

            {currentTab === 'text' && (
              <TextTab
                project={project}
                currentTime={currentTime}
                selectedClipId={selectedClipId}
                onAddTextClip={handleAddText}
                onPreviewAnimation={onPreviewAnimation}
                onAddTextAnimationSegment={onAddTextAnimationSegment}
              />
            )}

            {currentTab === 'audio' && (
              <AudioTab
                project={project}
                currentTime={currentTime}
                onAddClip={onAddClip}
                findTrack={findTrack}
                getNextClipStartTime={getNextClipStartTime}
              />
            )}

            {currentTab === 'transitions' && (
              <TransitionsTab
                project={project}
                currentTime={currentTime}
                selectedClipId={selectedClipId}
                onSelectClip={onSelectClip}
                onUpdateClip={onUpdateClip}
                onAddTimelineTransition={onAddTimelineTransition}
              />
            )}

            {currentTab === 'filters' && (
              <EffectsTab
                project={project}
                currentTime={currentTime}
                selectedClipId={selectedClipId}
                onSelectClip={onSelectClip}
                onUpdateClipEffects={onUpdateClipEffects}
                onAddEffectSegment={onAddEffectSegment}
              />
            )}

            {currentTab === 'elements' && (
              <ElementsTab
                project={project}
                currentTime={currentTime}
                onAddClip={onAddClip}
                findTrack={findTrack}
                getNextClipStartTime={getNextClipStartTime}
              />
            )}

            {currentTab === 'subtitles' && (
              <SubtitlesTab
                project={project}
                currentTime={currentTime}
                onAddTrack={onAddTrack}
                onAddClip={onAddClip}
                findTrack={findTrack}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsTab
                project={project}
                onSetBackgroundColor={onSetBackgroundColor}
                onSetDuration={onSetDuration}
              />
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
