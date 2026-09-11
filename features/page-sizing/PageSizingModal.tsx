import React, { useState } from 'react';
import {
  cropPdfPages,
  resizePdfPages,
  detectWhiteMargins,
  STANDARD_SIZES,
} from './pageSizingEngine';
import type {
  PageCropOptions,
  PageResizeOptions,
  PageStandardSize,
  PageSizingScope,
} from './pageSizingTypes';

interface PageSizingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array | null;
  onApply: (modifiedPdfBytes: Uint8Array) => void;
}

export const PageSizingModal: React.FC<PageSizingModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState<'crop' | 'resize'>('crop');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crop State
  const [cropTop, setCropTop] = useState(36);
  const [cropBottom, setCropBottom] = useState(36);
  const [cropLeft, setCropLeft] = useState(36);
  const [cropRight, setCropRight] = useState(36);
  const [cropScope, setCropScope] = useState<PageSizingScope>('all');

  // Resize State
  const [standardSize, setStandardSize] = useState<PageStandardSize>('A4');
  const [customWidth, setCustomWidth] = useState(595.28);
  const [customHeight, setCustomHeight] = useState(841.89);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [scalingMode, setScalingMode] = useState<'fit-proportional' | 'center' | 'extend-page'>('fit-proportional');
  const [resizeMargin, setResizeMargin] = useState(18);
  const [resizeScope, setResizeScope] = useState<PageSizingScope>('all');

  if (!isOpen) return null;

  const handleAutoDetectMargins = async () => {
    if (!pdfBytes) return;
    try {
      setLoading(true);
      const detected = await detectWhiteMargins(pdfBytes, 0);
      setCropTop(detected.top);
      setCropBottom(detected.bottom);
      setCropLeft(detected.left);
      setCropRight(detected.right);
    } catch (err: any) {
      setError('Boş kenarlıklar tespit edilirken hata oluştu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!pdfBytes) {
      setError('Lütfen önce bir PDF belgesi açın.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let resultBytes: Uint8Array;

      if (activeTab === 'crop') {
        const options: PageCropOptions = {
          margins: {
            top: cropTop,
            bottom: cropBottom,
            left: cropLeft,
            right: cropRight,
          },
          scope: cropScope,
        };
        resultBytes = await cropPdfPages(pdfBytes, options);
      } else {
        const options: PageResizeOptions = {
          standardSize,
          customWidth: standardSize === 'Custom' ? customWidth : undefined,
          customHeight: standardSize === 'Custom' ? customHeight : undefined,
          orientation,
          scalingMode,
          margin: resizeMargin,
          scope: resizeScope,
        };
        resultBytes = await resizePdfPages(pdfBytes, options);
      }

      onApply(resultBytes);
      onClose();
    } catch (err: any) {
      setError('İşlem uygulanırken hata oluştu: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-semibold text-white">Sayfa Boyutlandırma ve Kırpma</h2>
            <p className="text-xs text-slate-400">PDF sayfalarını kırpın, standart boyutlara dönüştürün veya kenar boşluklarını ayarlayın</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-6 pt-3">
          <button
            onClick={() => setActiveTab('crop')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'crop'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Sayfa Kırpma (Crop)
          </button>
          <button
            onClick={() => setActiveTab('resize')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'resize'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Yeniden Boyutlandırma & Kenarlık
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-xs">
              {error}
            </div>
          )}

          {activeTab === 'crop' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-200">Kırpma Kenarlıkları (pt)</span>
                <button
                  type="button"
                  onClick={handleAutoDetectMargins}
                  disabled={loading}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700"
                >
                  Otomatik Boşlukları Algıla
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Üst (Top)</label>
                  <input
                    type="number"
                    value={cropTop}
                    onChange={(e) => setCropTop(Number(e.target.value))}
                    min={0}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Alt (Bottom)</label>
                  <input
                    type="number"
                    value={cropBottom}
                    onChange={(e) => setCropBottom(Number(e.target.value))}
                    min={0}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sol (Left)</label>
                  <input
                    type="number"
                    value={cropLeft}
                    onChange={(e) => setCropLeft(Number(e.target.value))}
                    min={0}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sağ (Right)</label>
                  <input
                    type="number"
                    value={cropRight}
                    onChange={(e) => setCropRight(Number(e.target.value))}
                    min={0}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Uygulanacak Sayfalar</label>
                <select
                  value={cropScope}
                  onChange={(e) => setCropScope(e.target.value as PageSizingScope)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="all">Tüm Sayfalar</option>
                  <option value="single">Yalnızca İlk Sayfa</option>
                  <option value="odd">Yalnızca Tek Sayfalar (1, 3, 5...)</option>
                  <option value="even">Yalnızca Çift Sayfalar (2, 4, 6...)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400">
                💡 <strong className="text-slate-300">Vektör Koruması:</strong> Kırpma işlemi sayfa vektör nesnelerini veya metin katmanlarını silmez; ISO 32000 standardı <code className="text-blue-400">/CropBox</code> sınırlarını tanımlayarak güvenli kırpma sağlar.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hedef Sayfa Boyutu</label>
                  <select
                    value={standardSize}
                    onChange={(e) => setStandardSize(e.target.value as PageStandardSize)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  >
                    <option value="A4">A4 (210 x 297 mm)</option>
                    <option value="A3">A3 (297 x 420 mm)</option>
                    <option value="A5">A5 (148 x 210 mm)</option>
                    <option value="Letter">Letter (8.5 x 11 in)</option>
                    <option value="Legal">Legal (8.5 x 14 in)</option>
                    <option value="Custom">Özel Boyut (Custom)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Yönlendirme</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  >
                    <option value="portrait">Dikey (Portrait)</option>
                    <option value="landscape">Yatay (Landscape)</option>
                  </select>
                </div>
              </div>

              {standardSize === 'Custom' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Genişlik (pt)</label>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      min={50}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Yükseklik (pt)</label>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      min={50}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sığdırma Modu</label>
                  <select
                    value={scalingMode}
                    onChange={(e) => setScalingMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  >
                    <option value="fit-proportional">Orantılı Sığdır</option>
                    <option value="center">Merkeze Hizala (Ölçekleme Yok)</option>
                    <option value="extend-page">Sayfayı Genişlet (Margin Ekle)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Kenar Boşluğu (pt)</label>
                  <input
                    type="number"
                    value={resizeMargin}
                    onChange={(e) => setResizeMargin(Number(e.target.value))}
                    min={0}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Uygulanacak Sayfalar</label>
                <select
                  value={resizeScope}
                  onChange={(e) => setResizeScope(e.target.value as PageSizingScope)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="all">Tüm Sayfalar</option>
                  <option value="single">Yalnızca İlk Sayfa</option>
                  <option value="odd">Yalnızca Tek Sayfalar</option>
                  <option value="even">Yalnızca Çift Sayfalar</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400">
                ✨ <strong className="text-slate-300">Vektör ve Metin Koruma:</strong> Sayfa boyutu değiştirilirken sayfadaki içerikler pikselleştirilmez (raster yapılmaz); doğrudan vektör XObject olarak yerleştirilir. Metinler aranabilir kalır.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleExecute}
            disabled={loading || !pdfBytes}
            className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/30"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>İşleniyor...</span>
              </>
            ) : (
              <span>Uygula</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
