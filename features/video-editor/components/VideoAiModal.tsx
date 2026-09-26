import React, { useState } from 'react';
import { VideoProject } from '../types';
import { parseVideoAiPrompt, AiProposedAction } from '../ai/videoAiDispatcher';

interface AiModalProps {
  project: VideoProject;
  isOpen: boolean;
  onClose: () => void;
  onApplyAction: (updater: (prev: VideoProject) => VideoProject) => void;
}

const QUICK_PROMPTS = [
  '9:16 dikey format yap',
  'İlk 3 saniyesini kırp',
  'Tüm sesleri kapat',
  'Sesi %50 yap',
  'Hızı 2 katına çıkar',
  'Ağır çekim yap (0.5x)',
  'Sinematik sıcak filtre ekle',
  'Siyah-beyaz yap',
  'Başlık ekle: FORMA VİDEO',
  'Klipler arasındaki boşlukları kapat',
];

export const VideoAiModal: React.FC<AiModalProps> = ({
  project,
  isOpen,
  onClose,
  onApplyAction,
}) => {
  const [prompt, setPrompt] = useState('');
  const [proposedAction, setProposedAction] = useState<AiProposedAction | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProcessPrompt = (textToProcess: string) => {
    setErrorMsg(null);
    const action = parseVideoAiPrompt(textToProcess, project);
    if (action) {
      setProposedAction(action);
    } else {
      setProposedAction(null);
      setErrorMsg(
        'Komut algılanamadı. Lütfen aşağıdaki hazır önerilerden birini seçin veya daha net bir eylem belirtin.'
      );
    }
  };

  const handleConfirmAction = () => {
    if (proposedAction) {
      onApplyAction(proposedAction.apply);
      setProposedAction(null);
      setPrompt('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-lg bg-[#0d1117] border border-indigo-900/60 rounded-2xl shadow-2xl overflow-hidden text-xs text-gray-300 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#21262d] bg-gradient-to-r from-violet-950/40 to-indigo-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
              <svg className="w-4 h-4 text-indigo-300 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Forma AI Video Asistanı</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Yerel Model
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">Doğal Türkçe komutlarla videonuzu anında düzenleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Input Box */}
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && prompt.trim()) {
                  handleProcessPrompt(prompt);
                }
              }}
              placeholder="Örn: Videonun ilk 3 saniyesini kırp, 9:16 yap, sesi kapat..."
              className="w-full pl-3.5 pr-20 py-2.5 rounded-xl bg-[#161b22] border border-[#30363d] text-white text-xs outline-none focus:border-indigo-500 shadow-inner"
              autoFocus
            />
            <button
              onClick={() => {
                if (prompt.trim()) handleProcessPrompt(prompt);
              }}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
            >
              Çözümle
            </button>
          </div>

          {/* Quick Prompts Chips */}
          <div>
            <label className="block text-gray-400 font-semibold mb-2 uppercase text-[10px]">
              Hızlı Örnek Komutlar
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPrompt(qp);
                    handleProcessPrompt(qp);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-gray-300 hover:text-white border border-[#30363d] hover:border-indigo-500/50 text-[11px] transition-all"
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>

          {/* Error notice if unrecognized */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Proposed Action Confirmation Card */}
          {proposedAction && (
            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-700/60 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Önerilen Düzenleme
                </span>
                <span className="text-[10px] text-gray-400">Onayınız Bekleniyor</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white mb-1">{proposedAction.intent}</h4>
                <p className="text-xs text-gray-300">{proposedAction.description}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0d1117] border border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Uygulanacak Değişiklikler:</span>
                <ul className="space-y-1 mt-1 text-[11px] text-gray-300 list-disc list-inside">
                  {proposedAction.changesSummary.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setProposedAction(null)}
                  className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] font-semibold text-xs"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Değişiklikleri Uygula</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
