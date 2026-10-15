import React, { useState, useEffect } from 'react';
import { assetPacks, AssetPack, PackDownloadState } from '../../engine/assetPacks';
import { Package, Download, CheckCircle2, Pause, Play, Trash2, X, RefreshCw } from 'lucide-react';

interface AssetPacksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssetPacksModal: React.FC<AssetPacksModalProps> = ({ isOpen, onClose }) => {
  const [packs, setPacks] = useState<AssetPack[]>([]);
  const [states, setStates] = useState<Record<string, PackDownloadState>>({});

  const refreshStates = () => {
    const pList = assetPacks.getPacks();
    setPacks(pList);
    const newStates: Record<string, PackDownloadState> = {};
    for (const p of pList) {
      newStates[p.id] = assetPacks.getPackState(p.id);
    }
    setStates(newStates);
  };

  useEffect(() => {
    if (isOpen) {
      assetPacks.loadPacks().then(() => refreshStates());
      const unsub = assetPacks.subscribe(() => refreshStates());
      return () => unsub();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-[#111419] border border-[#292F39] rounded-[4px] p-4 max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#292F39] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">Çevrimdışı Asset Paketleri</h2>
              <p className="text-[11px] text-[#828B9B]">
                İnternet bağlantısı olmadan kurgu yapmak için paketleri tek tıkla cihazınıza indirin.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-packs-modal"
            onClick={onClose}
            className="text-[#828B9B] hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pack List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {packs.map((pack) => {
            const state = states[pack.id] || { status: 'not-installed', completedCount: 0, totalCount: pack.assetCount, percent: 0 };
            const isInstalled = state.status === 'installed';
            const isDownloading = state.status === 'downloading';
            const isPaused = state.status === 'paused';

            return (
              <div
                key={pack.id}
                className="bg-[#171B21] border border-[#292F39] rounded-[3px] p-3 flex items-center justify-between gap-3 hover:border-[#3B4351] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-xs">{pack.name}</span>
                    <span className="text-[10px] text-[#828B9B] font-mono bg-[#0E1014] px-1.5 py-0.5 rounded border border-[#232936]">
                      {pack.assetCount} Öğe • {pack.totalSizeFormatted}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#828B9B] mt-0.5 line-clamp-1">{pack.description}</p>

                  {/* Progress Bar when downloading or paused */}
                  {(isDownloading || isPaused) && (
                    <div className="mt-2 space-y-1">
                      <div className="w-full bg-[#0E1014] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${state.percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#828B9B]">
                        <span>%{state.percent} İndiriliyor ({state.completedCount} / {state.totalCount})</span>
                        <span>{isPaused ? 'Duraklatıldı' : 'Aktif'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isInstalled ? (
                    <>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium px-2 py-1 bg-[#12241b] rounded border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Yüklendi</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => assetPacks.removePack(pack.id)}
                        className="p-1.5 rounded bg-[#202631] hover:bg-red-950/40 text-[#828B9B] hover:text-red-400 border border-[#292F39] hover:border-red-500/40 transition-colors"
                        title="Paketi Cihazdan Kaldır"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : isDownloading ? (
                    <>
                      <button
                        type="button"
                        onClick={() => assetPacks.pauseDownload(pack.id)}
                        className="px-2.5 py-1 rounded bg-[#202631] hover:bg-[#2e3747] text-white text-xs font-medium border border-[#292F39] flex items-center gap-1"
                      >
                        <Pause className="w-3 h-3" />
                        <span>Duraklat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => assetPacks.cancelDownload(pack.id)}
                        className="px-2.5 py-1 rounded bg-[#202631] hover:bg-red-900/40 text-red-300 text-xs font-medium border border-[#292F39]"
                      >
                        İptal
                      </button>
                    </>
                  ) : isPaused ? (
                    <>
                      <button
                        type="button"
                        onClick={() => assetPacks.downloadPack(pack.id)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1 shadow-sm"
                      >
                        <Play className="w-3 h-3" />
                        <span>Devam Et</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => assetPacks.cancelDownload(pack.id)}
                        className="px-2 py-1 rounded bg-[#202631] text-[#828B9B] hover:text-white text-xs"
                      >
                        İptal
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => assetPacks.downloadPack(pack.id)}
                      className="px-3 py-1.5 rounded bg-[#202631] hover:bg-[#4f6bf5] text-[#E7EAF0] hover:text-white text-xs font-medium border border-[#292F39] hover:border-[#4f6bf5] transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>İndir ({pack.totalSizeFormatted})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#292F39] pt-3 mt-3">
          <span className="text-[11px] text-[#828B9B]">Toplam 16 profesyonel paket hazır.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#202631] hover:bg-[#2e3747] text-white text-xs font-medium"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
