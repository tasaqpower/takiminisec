import React, { useState } from 'react';
import { VideoProject } from '../types';

interface TopbarProps {
  project: VideoProject;
  onUpdateProjectName: (name: string) => void;
  onUpdateResolution: (width: number, height: number) => void;
  onUpdateFps: (fps: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
  onOpenAi: () => void;
  onNavigateHome: () => void;
  isDirty: boolean;
}

const RESOLUTION_PRESETS = [
  { label: '1080p (16:9 Yatay)', width: 1920, height: 1080 },
  { label: '720p (16:9 Yatay)', width: 1280, height: 720 },
  { label: '4K UHD (16:9 Yatay)', width: 3840, height: 2160 },
  { label: '9:16 Dikey (Reels / TikTok)', width: 1080, height: 1920 },
  { label: '1:1 Kare (Instagram)', width: 1080, height: 1080 },
  { label: '4:5 Dikey Gönderi', width: 1080, height: 1350 },
];

export const VideoEditorTopbar: React.FC<TopbarProps> = ({
  project,
  onUpdateProjectName,
  onUpdateResolution,
  onUpdateFps,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExport,
  onOpenAi,
  onNavigateHome,
  isDirty,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(project.name);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      onUpdateProjectName(tempName.trim());
    } else {
      setTempName(project.name);
    }
  };

  const currentResKey = `${project.resolution.width}x${project.resolution.height}`;

  return (
    <header className="h-14 bg-[#0d1117] border-b border-[#21262d] flex items-center justify-between px-4 select-none shrink-0 z-20">
      {/* Left: Brand & Home & Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#161b22] border border-[#30363d] transition-all"
          title="Ana Sayfaya Dön"
        >
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Ana Sayfa</span>
        </button>

        <div className="h-5 w-[1px] bg-[#30363d]" />

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight text-white">FORMA</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 font-medium border border-indigo-800/40">
            VIDEO PRO
          </span>
        </div>

        <div className="h-5 w-[1px] bg-[#30363d]" />

        {/* Project Name */}
        {isEditingName ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setIsEditingName(false);
                setTempName(project.name);
              }
            }}
            autoFocus
            className="px-2 py-1 text-xs bg-[#161b22] text-white rounded border border-indigo-500 outline-none w-52"
          />
        ) : (
          <button
            onClick={() => {
              setTempName(project.name);
              setIsEditingName(true);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-gray-200 hover:text-white hover:bg-[#161b22] group transition-colors"
            title="Proje Adını Değiştir"
          >
            <span className="max-w-[180px] truncate">{project.name}</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Kaydedilmemiş değişiklik" />}
            <svg className="w-3 h-3 text-gray-500 group-hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {/* Center: Undo / Redo & Presets */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-[#161b22] rounded-lg border border-[#30363d] p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded hover:bg-[#21262d] transition-colors ${
              canUndo ? 'text-gray-200' : 'text-gray-600 cursor-not-allowed'
            }`}
            title="Geri Al (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded hover:bg-[#21262d] transition-colors ${
              canRedo ? 'text-gray-200' : 'text-gray-600 cursor-not-allowed'
            }`}
            title="Yinele (Ctrl+Y)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        {/* Resolution selector */}
        <select
          value={currentResKey}
          onChange={(e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            onUpdateResolution(w, h);
          }}
          className="bg-[#161b22] border border-[#30363d] text-gray-200 text-xs rounded-lg px-2.5 py-1.5 outline-none hover:border-gray-500 focus:border-indigo-500 cursor-pointer"
        >
          {RESOLUTION_PRESETS.map((p) => (
            <option key={`${p.width}x${p.height}`} value={`${p.width}x${p.height}`}>
              {p.label}
            </option>
          ))}
        </select>

        {/* FPS selector */}
        <select
          value={project.fps}
          onChange={(e) => onUpdateFps(Number(e.target.value))}
          className="bg-[#161b22] border border-[#30363d] text-gray-200 text-xs rounded-lg px-2 py-1.5 outline-none hover:border-gray-500 focus:border-indigo-500 cursor-pointer"
        >
          <option value={24}>24 FPS</option>
          <option value={30}>30 FPS</option>
          <option value={60}>60 FPS</option>
        </select>
      </div>

      {/* Right: Forma AI & Export Button */}
      <div className="flex items-center gap-3">
        {/* Forma AI button */}
        <button
          onClick={onOpenAi}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-900/50 to-indigo-900/50 text-indigo-200 border border-indigo-700/50 hover:border-indigo-500 shadow-sm hover:shadow-indigo-500/10 transition-all"
        >
          <svg className="w-3.5 h-3.5 text-indigo-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Forma AI</span>
        </button>

        {/* Export Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-lg shadow-indigo-600/25 transition-all transform active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Dışa Aktar</span>
        </button>
      </div>
    </header>
  );
};
