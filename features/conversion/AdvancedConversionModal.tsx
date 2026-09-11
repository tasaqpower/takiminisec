import React, { useState } from 'react';
import {
  pdfToImagesZip,
  imagesToPdf,
  pdfToExcel,
  pdfToPptx,
} from './conversionEngine';
import type {
  ImageFormat,
  ImageToPdfItem,
} from './conversionTypes';

interface AdvancedConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array | null;
  fileName?: string;
}

export const AdvancedConversionModal: React.FC<AdvancedConversionModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  fileName = 'belge',
}) => {
  const [activeTab, setActiveTab] = useState<'pdf-to-img' | 'img-to-pdf' | 'pdf-to-xlsx' | 'pdf-to-pptx'>('pdf-to-img');
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // PDF to Image state
  const [imgFormat, setImgFormat] = useState<ImageFormat>('png');
  const [imgDpi, setImgDpi] = useState<number>(150);

  // Images to PDF state
  const [selectedImages, setSelectedImages] = useState<ImageToPdfItem[]>([]);
  const [imgPdfSize, setImgPdfSize] = useState<'A4' | 'fit-image' | 'Letter'>('A4');
  const [imgPdfOrientation, setImgPdfOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [imgPdfMargin, setImgPdfMargin] = useState<number>(20);

  // PDF to Excel state
  const [sheetName, setSheetName] = useState('Veriler');

  if (!isOpen) return null;

  const downloadBlob = (bytes: Uint8Array, downloadName: string, mime: string) => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePdfToImg = async () => {
    if (!pdfBytes) {
      setError('Lütfen önce bir PDF belgesi açın.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const zipBytes = await pdfToImagesZip(
        pdfBytes,
        { format: imgFormat, dpi: imgDpi },
        (c, t, msg) => setProgressText(msg)
      );
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      downloadBlob(zipBytes, `${baseName}_goruntuler.zip`, 'application/zip');
      onClose();
    } catch (err: any) {
      setError('Görüntü dönüştürme hatası: ' + err.message);
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const isPng = file.type.includes('png') || file.name.endsWith('.png');
      reader.onload = () => {
        if (reader.result) {
          const arr = new Uint8Array(reader.result as ArrayBuffer);
          setSelectedImages((prev) => [
            ...prev,
            {
              name: file.name,
              bytes: arr,
              type: isPng ? 'png' : 'jpeg',
            },
          ]);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleImgToPdf = async () => {
    if (selectedImages.length === 0) {
      setError('Lütfen en az bir görsel yükleyin.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const outPdf = await imagesToPdf(selectedImages, {
        pageSize: imgPdfSize,
        orientation: imgPdfOrientation,
        margin: imgPdfMargin,
      });
      downloadBlob(outPdf, `gorseller_${Date.now()}.pdf`, 'application/pdf');
      onClose();
    } catch (err: any) {
      setError('PDF oluşturma hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfToExcel = async () => {
    if (!pdfBytes) {
      setError('Lütfen önce bir PDF belgesi açın.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const xlsxBytes = await pdfToExcel(pdfBytes, { sheetName });
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      downloadBlob(
        xlsxBytes,
        `${baseName}_tablo.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      onClose();
    } catch (err: any) {
      setError('Excel dönüştürme hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfToPptx = async () => {
    if (!pdfBytes) {
      setError('Lütfen önce bir PDF belgesi açın.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const pptxBytes = await pdfToPptx(pdfBytes);
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      downloadBlob(
        pptxBytes,
        `${baseName}_sunum.pptx`,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      onClose();
    } catch (err: any) {
      setError('PowerPoint dönüştürme hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-semibold text-white">Gelişmiş Format Dönüşümleri</h2>
            <p className="text-xs text-slate-400">PDF belgelerinizi Excel, PowerPoint veya görsel paketlerine çevirin ya da görsellerden PDF üretin</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-6 pt-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pdf-to-img')}
            className={`pb-3 px-3 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'pdf-to-img'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PDF → Görüntü (ZIP)
          </button>
          <button
            onClick={() => setActiveTab('img-to-pdf')}
            className={`pb-3 px-3 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'img-to-pdf'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Görseller → PDF
          </button>
          <button
            onClick={() => setActiveTab('pdf-to-xlsx')}
            className={`pb-3 px-3 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'pdf-to-xlsx'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PDF → Excel (.xlsx)
          </button>
          <button
            onClick={() => setActiveTab('pdf-to-pptx')}
            className={`pb-3 px-3 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'pdf-to-pptx'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PDF → PowerPoint (.pptx)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-xs">
              {error}
            </div>
          )}

          {progressText && (
            <div className="p-3 bg-blue-950/50 border border-blue-800 rounded-lg text-blue-300 text-xs flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              <span>{progressText}</span>
            </div>
          )}

          {/* TAB 1: PDF to Images */}
          {activeTab === 'pdf-to-img' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Görsel Formatı</label>
                  <select
                    value={imgFormat}
                    onChange={(e) => setImgFormat(e.target.value as ImageFormat)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  >
                    <option value="png">PNG (Kayıpsız, Şeffaflık Destekli)</option>
                    <option value="jpeg">JPEG (Küçük Dosya Boyutu)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Çözünürlük (DPI)</label>
                  <select
                    value={imgDpi}
                    onChange={(e) => setImgDpi(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  >
                    <option value={72}>72 DPI (Ekran Görünümü / Hızlı)</option>
                    <option value={150}>150 DPI (Standart Kalite / Önerilen)</option>
                    <option value={300}>300 DPI (Yüksek Çözünürlük / Baskı)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400">
                📦 Belgedeki tüm sayfalar seçilen format ve çözünürlükte işlenerek tek bir <strong className="text-slate-300">ZIP arşivi</strong> olarak indirilecektir.
              </div>

              <button
                type="button"
                onClick={handlePdfToImg}
                disabled={loading || !pdfBytes}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/30"
              >
                Görselleri ZIP Olarak İndir
              </button>
            </div>
          )}

          {/* TAB 2: Images to PDF */}
          {activeTab === 'img-to-pdf' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Görselleri Seç (PNG / JPEG)</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  multiple
                  onChange={handleImageUpload}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                />
              </div>

              {selectedImages.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-300">Seçilen Görseller ({selectedImages.length}):</div>
                  <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-slate-950 rounded border border-slate-800">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-400 px-2 py-1 bg-slate-900 rounded">
                        <span className="truncate max-w-[300px]">{idx + 1}. {img.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 text-xs ml-2"
                        >
                          Kaldır
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sayfa Boyutu</label>
                  <select
                    value={imgPdfSize}
                    onChange={(e) => setImgPdfSize(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="A4">A4 Standardı</option>
                    <option value="fit-image">Görsele Göre Uyarla</option>
                    <option value="Letter">Letter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Yönlendirme</label>
                  <select
                    value={imgPdfOrientation}
                    onChange={(e) => setImgPdfOrientation(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="auto">Otomatik</option>
                    <option value="portrait">Dikey</option>
                    <option value="landscape">Yatay</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Kenarlık (pt)</label>
                  <input
                    type="number"
                    value={imgPdfMargin}
                    onChange={(e) => setImgPdfMargin(Number(e.target.value))}
                    min={0}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleImgToPdf}
                disabled={loading || selectedImages.length === 0}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/30"
              >
                Görselleri PDF Olarak Birleştir
              </button>
            </div>
          )}

          {/* TAB 3: PDF to Excel */}
          {activeTab === 'pdf-to-xlsx' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Çalışma Sayfası Başlığı</label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1">
                <p>📊 <strong className="text-slate-300">Akıllı Hücre Ayrıştırma:</strong> Belgedeki satırlar ve koordinat hizalamaları taranarak standart ECMA-376 OpenXML (.xlsx) tablosuna dönüştürülür.</p>
                <p>Tüm sayısal veriler otomatik olarak Excel sayı hücresine çevrilir.</p>
              </div>

              <button
                type="button"
                onClick={handlePdfToExcel}
                disabled={loading || !pdfBytes}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-900/30"
              >
                Excel Tablosu Olarak İndir (.xlsx)
              </button>
            </div>
          )}

          {/* TAB 4: PDF to PPTX */}
          {activeTab === 'pdf-to-pptx' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1">
                <p>📽️ <strong className="text-slate-300">Doğal Sunum Slaytları:</strong> Belgedeki her sayfa bağımsız bir 16:9 geniş ekran slayta aktarılır.</p>
                <p>Başlıklar ve metin paragrafları düzenlenebilir PowerPoint kutuları olarak oluşturulur.</p>
              </div>

              <button
                type="button"
                onClick={handlePdfToPptx}
                disabled={loading || !pdfBytes}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-amber-900/30"
              >
                PowerPoint Sunumu Olarak İndir (.pptx)
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
