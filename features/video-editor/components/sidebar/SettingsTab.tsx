import React from 'react';
import { VideoProject } from '../../types';
import { Settings, Monitor, Clock, Palette } from 'lucide-react';

interface SettingsTabProps {
  project: VideoProject;
  onSetBackgroundColor: (color: string) => void;
  onSetDuration: (duration: number) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  project,
  onSetBackgroundColor,
  onSetDuration,
}) => {
  return (
    <div className="space-y-4 p-3 text-xs bg-[#111419]">
      <div className="flex items-center gap-1.5">
        <Settings className="w-3.5 h-3.5 text-[#929AA8]" />
        <span className="font-semibold text-[#E7EAF0]">Proje Ayarları</span>
      </div>

      <div className="p-3 rounded-[3px] bg-[#171B21] border border-[#292F39] space-y-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#929AA8] block mb-1">
            Proje Adı
          </span>
          <p className="font-medium text-[#E7EAF0] truncate">{project.name}</p>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-[#929AA8] block mb-1">
            Çözünürlük & En-Boy Oranı
          </span>
          <p className="font-mono text-[#929AA8]">
            {project.resolution.width} x {project.resolution.height} (
            {project.resolution.width > project.resolution.height ? '16:9 Yatay' : '9:16 Dikey'})
          </p>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-[#929AA8] block mb-1">
            Kare Hızı (FPS)
          </span>
          <p className="font-mono text-[#929AA8]">{project.fps} FPS</p>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-[#929AA8] block mb-1">
            Toplam Süre (Saniye)
          </span>
          <input
            type="number"
            min="1"
            max="3600"
            value={project.duration}
            onChange={(e) => onSetDuration(Math.max(1, parseInt(e.target.value) || 10))}
            className="w-full px-2.5 py-1.5 rounded-[3px] bg-[#0E1014] border border-[#292F39] text-[#E7EAF0] font-mono outline-none focus:border-[#4f6bf5]"
          />
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-[#929AA8] block mb-1">
            Tuval Arka Plan Rengi
          </span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={project.backgroundColor || '#000000'}
              onChange={(e) => onSetBackgroundColor(e.target.value)}
              className="w-7 h-7 rounded-[2px] border border-[#292F39] bg-transparent cursor-pointer"
            />
            <span className="font-mono text-[#929AA8]">{project.backgroundColor || '#000000'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
