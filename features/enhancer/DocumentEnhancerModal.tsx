import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  FileText,
  Image as ImageIcon,
  Sliders,
  Download,
  Eye,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Layers,
  X,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import {
  type EnhanceMode,
  type EnhanceIntensity,
  enhanceCanvas,
  enhancePdfBytes,
  enhanceImageFile
} from './documentEnhancer';
import { toast } from 'sonner';

interface DocumentEnhancerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes?: Uint8Array | null;
  fileName?: string;
  onImportToWorkspace?: (enhancedBytes: Uint8Array, fileName: string) => void;
}

export const DocumentEnhancerModal: React.FC<DocumentEnhancerModalProps> = ({
  isOpen,
  onClose,
  pdfBytes: initialPdfBytes,
  fileName = 'belge.pdf',
  onImportToWorkspace
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [activeFileName, setActiveFileName] = useState<string>(fileName);
  const [isPdf, setIsPdf] = useState<boolean>(true);

  // Settings
  const [mode, setMode] = useState<EnhanceMode>('document');
  const [intensity, setIntensity] = useState<EnhanceIntensity>('balanced');
  const [despeckle, setDespeckle] = useState<boolean>(true);
  const [processAllPages, setProcessAllPages] = useState<boolean>(true);

  // PDF Page state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Processing & progress
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  // Before / After slider state (0 to 100%)
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  // Canvas refs
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const enhancedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize from props
  useEffect(() => {
    if (isOpen) {
      if (initialPdfBytes && initialPdfBytes.length > 0) {
        setPdfData(initialPdfBytes);
        setActiveFileName(fileName);
        setIsPdf(true);
        setCurrentPage(1);
      }
    }
  }, [isOpen, initialPdfBytes, fileName]);

  // Render current view whenever file, pdfData, currentPage, mode, or intensity changes
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;

    const renderPreview = async () => {
      if (pdfData && isPdf) {
        setLoading(true);
        try {
          const pdfjsLib = await import('pdfjs-dist');
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          }
          const doc = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise;
          if (!isSubscribed) return;
          setTotalPages(doc.numPages);

          const pageNum = Math.min(Math.max(1, currentPage), doc.numPages);
          const page = await doc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.6 });

          // 1. Render Original Canvas
          const origCanvas = originalCanvasRef.current;
          if (origCanvas) {
            origCanvas.width = Math.floor(viewport.width);
            origCanvas.height = Math.floor(viewport.height);
            const origCtx = origCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
            if (origCtx) {
              origCtx.fillStyle = '#FFFFFF';
              origCtx.fillRect(0, 0, origCanvas.width, origCanvas.height);
              await page.render({ canvasContext: origCtx, viewport, canvas: origCanvas }).promise;

              // 2. Render Enhanced Canvas
              const enhCanvas = enhancedCanvasRef.current;
              if (enhCanvas) {
                enhCanvas.width = origCanvas.width;
                enhCanvas.height = origCanvas.height;
                const enhCtx = enhCanvas.getContext('2d');
                if (enhCtx) {
                  enhCtx.drawImage(origCanvas, 0, 0);
                  enhanceCanvas(enhCanvas, { mode, intensity, despeckle });
                }
              }
            }
          }
        } catch (err: any) {
          console.error('Render preview error:', err);
        } finally {
          if (isSubscribed) setLoading(false);
        }
      } else if (file && !isPdf) {
        setLoading(true);
        try {
          const img = new Image();
          const objectUrl = URL.createObjectURL(file);
          img.onload = () => {
            if (!isSubscribed) return;
            const maxDim = 1200;
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            if (w > maxDim || h > maxDim) {
              const r = Math.min(maxDim / w, maxDim / h);
              w = Math.round(w * r);
              h = Math.round(h * r);
            }

            const origCanvas = originalCanvasRef.current;
            if (origCanvas) {
              origCanvas.width = w;
              origCanvas.height = h;
              const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
              if (origCtx) {
                origCtx.drawImage(img, 0, 0, w, h);

                const enhCanvas = enhancedCanvasRef.current;
                if (enhCanvas) {
                  enhCanvas.width = w;
                  enhCanvas.height = h;
                  const enhCtx = enhCanvas.getContext('2d');
                  if (enhCtx) {
                    enhCtx.drawImage(origCanvas, 0, 0);
                    enhanceCanvas(enhCanvas, { mode, intensity, despeckle });
                  }
                }
              }
            }
            URL.revokeObjectURL(objectUrl);
            setLoading(false);
          };
          img.src = objectUrl;
        } catch (err) {
          console.error('Image load error:', err);
          if (isSubscribed) setLoading(false);
        }
      }
    };

    renderPreview();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, pdfData, file, isPdf, currentPage, mode, intensity, despeckle]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setActiveFileName(selected.name);
      if (/\.pdf$/i.test(selected.name)) {
        setIsPdf(true);
        const buf = await selected.arrayBuffer();
        setPdfData(new Uint8Array(buf));
        setFile(null);
        setCurrentPage(1);
      } else if (/\.(png|jpe?g|webp)$/i.test(selected.name)) {
        setIsPdf(false);
        setFile(selected);
        setPdfData(null);
      } else {
        toast.error('Lütfen geçerli bir PDF veya görsel dosyası (PNG, JPG) seçin.');
      }
    }
  };

  const handleExport = async (openInWorkspace = false) => {
    setLoading(true);
    try {
      if (isPdf && pdfData) {
        setProgressMsg('PDF sayfaları filtreleniyor ve yüksek çözünürlükte netleştiriliyor...');
        const pageRange = processAllPages ? undefined : [currentPage];
        const enhancedBytes = await enhancePdfBytes(pdfData, {
          mode,
          intensity,
          despeckle,
          pageRange,
          onProgress: (p, total, msg) => {
            setProgressMsg(msg);
          }
        });

        const baseName = activeFileName.replace(/\.[^/.]+$/, '');
        const finalName = `${baseName}_netlestirildi.pdf`;

        if (openInWorkspace && onImportToWorkspace) {
          onImportToWorkspace(enhancedBytes, finalName);
          toast.success('Netleştirilmiş PDF çalışma alanına aktarıldı!');
          onClose();
        } else {
          const blob = new Blob([enhancedBytes as unknown as BlobPart], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = finalName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success('Netleştirilmiş kristal kaliteli PDF başarıyla indirildi!');
        }
      } else if (!isPdf && file) {
        setProgressMsg('Görsel pikselleri işleniyor ve netleştiriliyor...');
        const res = await enhanceImageFile(file, { mode, intensity, despeckle });
        const a = document.createElement('a');
        a.href = res.dataUrl;
        a.download = res.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Netleştirilmiş yüksek çözünürlüklü görsel indirildi!');
      }
    } catch (err: any) {
      toast.error('Netleştirme işlemi sırasında hata oluştu: ' + (err?.message || 'Lütfen tekrar deneyin.'));
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // Slider drag handlers
  const handleMouseDown = () => setIsDraggingSlider(true);
  const handleMouseUp = () => setIsDraggingSlider(false);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingSlider || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    setSliderPos(percent);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!splitContainerRef.current || e.touches.length === 0) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    setSliderPos(percent);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600 text-white shadow-md shadow-violet-200">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Belge & Görsel Netleştirici
                <span className="text-[11px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
                  Kristal Netlik
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Bulanık yazıları derin siyah yapar, kirli arka planı siler, fotoğrafları keskinleştirir.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X size={19} />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Preview Pane */}
          <div className="flex-1 bg-slate-100/90 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
            {(!pdfData && !file) ? (
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-2xl hover:border-violet-500 hover:bg-white/80 cursor-pointer transition-all max-w-md text-center bg-white/50 shadow-sm">
                <Upload size={36} className="text-violet-500 mb-3" />
                <span className="text-sm font-semibold text-slate-800">Netleştirmek İstediğin Belge veya Görseli Seç</span>
                <span className="text-xs text-slate-500 mt-1">PDF, PNG, JPG, JPEG veya WEBP dosyalarını buraya bırak</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileUpload}
                />
              </label>
            ) : (
              <div className="flex flex-col items-center w-full h-full justify-between">
                {/* Comparison Split Viewer */}
                <div
                  ref={splitContainerRef}
                  className="relative flex-1 w-full max-h-[56vh] flex items-center justify-center overflow-hidden cursor-ew-resize rounded-xl shadow-inner border border-slate-300/80 bg-white"
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onMouseMove={handleMouseMove}
                  onTouchMove={handleTouchMove}
                >
                  {/* Enhanced Canvas (Right / Full Base) */}
                  <canvas
                    ref={enhancedCanvasRef}
                    className="max-h-full max-w-full object-contain pointer-events-none"
                  />

                  {/* Original Canvas (Left Clipped Overlay) */}
                  <div
                    className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none"
                    style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
                  >
                    <canvas
                      ref={originalCanvasRef}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Split Divider Handle */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-violet-600 shadow-[0_0_10px_rgba(124,58,237,0.5)] flex items-center justify-center pointer-events-none"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div className="w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white text-[10px] font-bold">
                      ↔
                    </div>
                  </div>

                  {/* Labels */}
                  <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-md pointer-events-none">
                    Orijinal (Bulanık)
                  </span>
                  <span className="absolute top-3 right-3 bg-violet-600/85 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-md pointer-events-none flex items-center gap-1.5">
                    <Sparkles size={11} /> Netleştirilmiş
                  </span>
                </div>

                {/* Page Controls for Multi-Page PDF */}
                {isPdf && totalPages > 1 && (
                  <div className="flex items-center gap-3 mt-3 bg-white px-4 py-1.5 rounded-xl shadow-sm border border-slate-200">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1 || loading}
                      className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-semibold text-slate-700">
                      Sayfa {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || loading}
                      className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Control Sidebar */}
          <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-100 p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              {/* Target Type: Document vs Photo */}
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                  1. Belge Türü Seçimi
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('document')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      mode === 'document'
                        ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-bold shadow-sm ring-1 ring-violet-600'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <FileText size={20} className={mode === 'document' ? 'text-violet-600' : 'text-slate-400'} />
                    <span className="text-xs mt-1.5">📄 Belge / Metin</span>
                    <span className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">
                      Fatura, sözleşme, yazı
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('photo')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      mode === 'photo'
                        ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-bold shadow-sm ring-1 ring-violet-600'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <ImageIcon size={20} className={mode === 'photo' ? 'text-violet-600' : 'text-slate-400'} />
                    <span className="text-xs mt-1.5">🖼️ Fotoğraf</span>
                    <span className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">
                      Kimlik, renkli görsel
                    </span>
                  </button>
                </div>
              </div>

              {/* Intensity Settings */}
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                  2. Netlik Yoğunluğu
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['subtle', 'balanced', 'high', 'maximum'] as EnhanceIntensity[]).map((lvl) => {
                    const label =
                      lvl === 'subtle' ? 'Hafif (%25)' :
                      lvl === 'balanced' ? 'Dengeli (%50)' :
                      lvl === 'high' ? 'Yüksek (%75)' : 'Maksimum';
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setIntensity(lvl)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                          intensity === lvl
                            ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode-specific switches */}
              {mode === 'document' && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                    <span className="font-medium">Leke ve Nokta Temizliği (Despeckle)</span>
                    <input
                      type="checkbox"
                      checked={despeckle}
                      onChange={(e) => setDespeckle(e.target.checked)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Tarama sırasında oluşan küçük toz ve leke noktacıklarını temizler.
                  </p>
                </div>
              )}

              {/* PDF Scope */}
              {isPdf && totalPages > 1 && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    İşlem Kapsamı
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setProcessAllPages(true)}
                      className={`flex-1 py-1.5 px-2 text-xs rounded-lg border font-medium ${
                        processAllPages
                          ? 'border-violet-600 bg-violet-50 text-violet-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Tüm Sayfalar ({totalPages})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProcessAllPages(false)}
                      className={`flex-1 py-1.5 px-2 text-xs rounded-lg border font-medium ${
                        !processAllPages
                          ? 'border-violet-600 bg-violet-50 text-violet-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Sadece Sayfa {currentPage}
                    </button>
                  </div>
                </div>
              )}

              {/* Replace File */}
              <div className="pt-2">
                <label className="flex items-center justify-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-semibold cursor-pointer py-1.5 border border-dashed border-violet-200 rounded-lg hover:bg-violet-50 transition-colors">
                  <RefreshCw size={12} /> Farklı Belge / Görsel Seç
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-5 mt-4 border-t border-slate-100 space-y-2">
              {progressMsg && (
                <div className="p-2 rounded-lg bg-violet-50 border border-violet-200 text-[11px] text-violet-700 font-medium animate-pulse text-center">
                  {progressMsg}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleExport(false)}
                disabled={(!pdfData && !file) || loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white text-xs font-semibold rounded-xl shadow-md shadow-violet-200 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <Download size={15} />
                {loading ? 'Netleştiriliyor…' : isPdf ? 'Netleştirilmiş PDF İndir' : 'Netleştirilmiş Görseli İndir'}
              </button>

              {isPdf && onImportToWorkspace && (
                <button
                  type="button"
                  onClick={() => handleExport(true)}
                  disabled={!pdfData || loading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all disabled:opacity-40"
                >
                  <FolderOpen size={14} />
                  Düzenleyicide Aç
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
