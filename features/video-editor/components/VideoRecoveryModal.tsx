import React from 'react';
import { VideoProject } from '../types';

interface RecoveryModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  project: VideoProject | null;
}

export const VideoRecoveryModal: React.FC<RecoveryModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
  project,
}) => {
  if (!isOpen || !project) return null;

  const totalClips = project.tracks.reduce((acc, t) => acc + t.clips.length, 0);
  const formattedDate = new Date(project.updatedAt).toLocaleString('tr-TR');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md bg-[#0d1117] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-xs text-gray-300 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 bg-amber-950/30 border-b border-amber-900/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Kaydedilmemiş Proje Bulundu</h3>
            <p className="text-[11px] text-amber-300/80">Önceki oturumunuzdan kurtarılabilir çalışma</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-gray-300 text-xs">
            Önceki oturumunuzda düzenlemekte olduğunuz bir video projesi tespit edildi. Kaldığınız yerden devam etmek ister misiniz?
          </p>

          <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-400">Proje Adı:</span>
              <span className="font-semibold text-white truncate max-w-[200px]">{project.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Toplam Klip:</span>
              <span className="font-mono text-gray-200">{totalClips} Klip ({project.tracks.length} Kanal)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Çözünürlük:</span>
              <span className="font-mono text-gray-200">{project.resolution.width} x {project.resolution.height}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Son Kayıt:</span>
              <span className="text-gray-400">{formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#21262d] bg-[#161b22]/40 flex items-center justify-end gap-2">
          <button
            onClick={onDecline}
            className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] font-semibold text-xs transition-colors"
          >
            Sil & Yeni Proje Başlat
          </button>
          <button
            onClick={onAccept}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95"
          >
            Projeyi Kurtar ve Devam Et
          </button>
        </div>
      </div>
    </div>
  );
};
