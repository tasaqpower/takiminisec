import React, { useState } from 'react';
import { VideoProject } from '../types';
import { parseVideoAiPrompt, AiProposedAction } from '../ai/videoAiDispatcher';
import { Sparkles, X, Send, AlertCircle, Check } from 'lucide-react';

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
      <div className="w-full max-w-lg bg-[#0e1014] border border-[#202531] rounded-xl shadow-2xl overflow-hidden text-xs text-gray-300 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 px-5 border-b border-[#191d26] bg-[#13161c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#1c212c] border border-[#2b3342] flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Forma AI Video Asistanı</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1c212c] text-gray-400 border border-[#2b3342] font-mono">
                  Yerel Model
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">Doğal Türkçe komutlarla videonuzu anında düzenleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1c212c] transition-colors"
          >
            <X className="w-4 h-4" />
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
              className="w-full pl-3 pr-24 py-2 rounded-md bg-[#13161c] border border-[#202531] text-white text-xs outline-none focus:border-indigo-500"
              autoFocus
            />
            <button
              onClick={() => {
                if (prompt.trim()) handleProcessPrompt(prompt);
              }}
              className="absolute right-1 top-1 bottom-1 px-3 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1 transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>Çözümle</span>
            </button>
          </div>

          {/* Quick Prompts Chips */}
          <div>
            <label className="block text-gray-400 font-semibold mb-2 uppercase text-[10px] tracking-wider">
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
                  className="px-2.5 py-1 rounded-md bg-[#13161c] hover:bg-[#181c24] text-gray-300 hover:text-white border border-[#202531] hover:border-gray-600 text-[11px] transition-all"
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>

          {/* Error notice if unrecognized */}
          {errorMsg && (
            <div className="p-2.5 rounded-md bg-red-950/30 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Proposed Action Confirmation Card */}
          {proposedAction && (
            <div className="p-3.5 rounded-md bg-[#13161c] border border-indigo-500/40 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
                  Önerilen Düzenleme
                </span>
                <span className="text-[10px] text-gray-400">Onayınız Bekleniyor</span>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-white mb-0.5">{proposedAction.intent}</h4>
                <p className="text-[11px] text-gray-300">{proposedAction.description}</p>
              </div>

              <div className="p-2.5 rounded bg-[#0a0c10] border border-[#202531] space-y-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-tight">Uygulanacak Değişiklikler:</span>
                <ul className="space-y-0.5 mt-0.5 text-[11px] text-gray-300 list-disc list-inside">
                  {proposedAction.changesSummary.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setProposedAction(null)}
                  className="px-3 py-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#181c24] font-medium text-xs transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
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
