import React, { useState } from 'react';
import {
  pdfToImagesZip,
  imagesToPdf,
  pdfToExcel,
  pdfToPptx,
  excelToPdf,
  pdfToDocx,
  docxToPdf,
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
  onOpenConvertedPdf?: (newPdfBytes: Uint8Array, newFileName: string) => void;
}

export const AdvancedConversionModal: React.FC<AdvancedConversionModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  fileName = 'belge',
  onOpenConvertedPdf,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf-to-docx' | 'docx-to-pdf' | 'xlsx-to-pdf' | 'pdf-to-xlsx' | 'pdf-to-img' | 'img-to-pdf' | 'pdf-to-pptx'>('pdf-to-docx');
  const [docxFile, setDocxFile] = useState<File | null>(null);
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

  // Excel to PDF state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelOrientation, setExcelOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [excelTheme, setExcelTheme] = useState<'slate' | 'minimal' | 'corporate'>('slate');
  const [excelShowRowNumbers, setExcelShowRowNumbers] = useState<boolean>(true);

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


  const handlePdfToDocx = async () => {
    if (!pdfBytes) {
      setError('Lütfen önce bir PDF belgesi açın.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setProgressText('PDF taranıyor ve Word (.docx) formatına aktarılıyor...');
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const docxBytes = await pdfToDocx(pdfBytes, { title: baseName });
      downloadBlob(
        docxBytes,
        `${baseName}_duzenlenebilir.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      onClose();
    } catch (err: any) {
      setError('Word dönüştürme hatası: ' + err.message);
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  const handleDocxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocxFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDocxToPdf = async (openInWorkspace = false) => {
    if (!docxFile) {
      setError('Lütfen bir Word (.docx) belgesi seçin.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setProgressText('Word belgesi vektörel PDF sayfalarına dönüştürülüyor...');
      const buf = await docxFile.arrayBuffer();
      const baseName = docxFile.name.replace(/\.[^/.]+$/, '');
      const pdfOut = await docxToPdf(new Uint8Array(buf), { title: baseName });

      if (openInWorkspace && onOpenConvertedPdf) {
        onOpenConvertedPdf(pdfOut, `${baseName}.pdf`);
      } else {
        downloadBlob(pdfOut, `${baseName}.pdf`, 'application/pdf');
      }
      onClose();
    } catch (err: any) {
      setError('Word PDF dönüştürme hatası: ' + err.message);
    } finally {
      setLoading(false);
      setProgressText('');
    }
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newItems: ImageToPdfItem[] = [];

    for (const f of files) {
      const buf = await f.arrayBuffer();
      const type: ImageFormat = f.type.includes('png') ? 'png' : 'jpeg';
      newItems.push({
        name: f.name,
        bytes: new Uint8Array(buf),
        type,
      });
    }
    setSelectedImages((prev) => [...prev, ...newItems]);
  };

  const handleImgToPdf = async () => {
    if (selectedImages.length === 0) {
      setError('Lütfen en az bir görsel yükleyin.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const pdfOut = await imagesToPdf(selectedImages, {
        pageSize: imgPdfSize,
        orientation: imgPdfOrientation,
        margin: imgPdfMargin,
      });
      downloadBlob(pdfOut, 'birlestirilmis_gorseller.pdf', 'application/pdf');
      if (onOpenConvertedPdf) {
        onOpenConvertedPdf(pdfOut, 'birlestirilmis_gorseller.pdf');
      }
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
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const xlsxBytes = await pdfToExcel(pdfBytes, { sheetName });
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

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExcelFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleExcelToPdf = async (openInWorkspace = false) => {
    if (!excelFile) {
      setError('Lütfen bir Excel (.xlsx, .xls) veya CSV dosyası seçin.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const buf = await excelFile.arrayBuffer();
      const baseName = excelFile.name.replace(/\.[^/.]+$/, '');
      const pdfOut = await excelToPdf(new Uint8Array(buf), {
        orientation: excelOrientation,
        theme: excelTheme,
        showRowNumbers: excelShowRowNumbers,
        title: baseName
      });

      if (openInWorkspace && onOpenConvertedPdf) {
        onOpenConvertedPdf(pdfOut, `${baseName}.pdf`);
      } else {
        downloadBlob(pdfOut, `${baseName}.pdf`, 'application/pdf');
      }
      onClose();
    } catch (err: any) {
      setError('Excel PDF dönüştürme hatası: ' + err.message);
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
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const pptxBytes = await pdfToPptx(pdfBytes);
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
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Gelişmiş Belge &amp; Format Dönüştürücü</span>
              <span className="text-[11px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                ECMA-376 &amp; Vektör
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              İki yönlü dönüşüm: Excel, PowerPoint, Görsel ZIP ve Vektör Tablolar
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

                {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 pt-3 bg-slate-950/30 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pdf-to-docx')}
            className={`pb-3 px-3 text-xs md:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'pdf-to-docx'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📝 PDF → Word (.docx)
          </button>
          <button
            onClick={() => setActiveTab('docx-to-pdf')}
            className={`pb-3 px-3 text-xs md:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'docx-to-pdf'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📄 Word (.docx) → PDF
          </button>
          <button
            onClick={() => setActiveTab('xlsx-to-pdf')}
            className={`pb-3 px-3 text-xs md:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'xlsx-to-pdf'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 Excel / CSV → PDF
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
            onClick={() => setActiveTab('pdf-to-img')}
            className={`pb-3 px-3 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'pdf-to-img'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PDF → Görsel (ZIP)
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
            onClick={() => setActiveTab('pdf-to-pptx')}
            className={`pb-3 px-3 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'pdf-to-pptx'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PDF → PowerPoint
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-xs">
              {error}
            </div>
          )}

                    {/* TAB: PDF to DOCX */}
          {activeTab === 'pdf-to-docx' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl space-y-2 text-xs text-indigo-300">
                <p className="font-semibold text-sm text-indigo-200 flex items-center gap-2">
                  <span>PDF'i Düzenlenebilir Microsoft Word (.docx) Dosyasına Dönüştürün</span>
                </p>
                <p className="text-slate-300">
                  Belgedeki tüm sayfaları, başlık hiyerarşisini (H1/H2), paragrafları, madde işaretlerini ve tabloları tarayıp standart OpenXML (.docx) belgesine dönüştürür.
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
                <p className="text-slate-200 font-medium">💡 Özellikler &amp; Uyumluluk:</p>
                <ul className="space-y-1 list-disc list-inside text-slate-300">
                  <li>Başlık, paragraf ve madde imleri otomatik ayrıştırılır.</li>
                  <li>Türkçe karakterler (ç, ğ, ı, ö, ş, ü, İ) eksiksiz korunur.</li>
                  <li>Sayfa sonları ve çok sütunlu tablolar Word hücrelerine dönüştürülür.</li>
                  <li>%100 yerel işlenir; belgeniz cihazınızdan dışarı çıkmaz.</li>
                </ul>
              </div>

              <button
                disabled={loading || !pdfBytes}
                onClick={handlePdfToDocx}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (progressText || 'Word Belgesi Oluşturuluyor...') : 'Word Belgesi Olarak İndir (.docx)'}
              </button>
            </div>
          )}

          {/* TAB: DOCX to PDF */}
          {activeTab === 'docx-to-pdf' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl space-y-2 text-xs text-indigo-300">
                <p className="font-semibold text-sm text-indigo-200 flex items-center gap-2">
                  <span>Word (.docx) Belgelerini Vektörel PDF'e Dönüştürün</span>
                </p>
                <p className="text-slate-300">
                  .docx dosyanızı doğrudan tarayıcınızda okuyarak standart kenar boşluklu, A4 boyutlu ve profesyonel vektörel PDF üretir.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Word Belgesi Seçin (.docx)
                </label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleDocxUpload}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer bg-slate-950 border border-slate-700 rounded-xl p-2"
                />
                {docxFile && (
                  <p className="text-xs text-indigo-400 mt-1.5 font-medium">
                    ✓ Seçildi: {docxFile.name} ({(docxFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  disabled={loading || !docxFile}
                  onClick={() => handleDocxToPdf(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (progressText || 'Dönüştürülüyor...') : 'PDF Olarak İndir'}
                </button>
                {onOpenConvertedPdf && (
                  <button
                    disabled={loading || !docxFile}
                    onClick={() => handleDocxToPdf(true)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all border border-slate-700 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Atölyede Aç &amp; Düzenle
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB: Excel / CSV to PDF */}
          {activeTab === 'xlsx-to-pdf' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-2 text-xs text-emerald-300">
                <p className="font-semibold text-sm text-emerald-200 flex items-center gap-2">
                  <span>Excel ve CSV Tablolarını Kusursuz PDF'e Dönüştürün</span>
                </p>
                <p className="text-slate-300">
                  .xlsx, .xls ve .csv elektronik tablolarınızı okuyarak otomatik sütun genişlikleri, sayfa numaraları, zebra satırları ve tekrarlanan başlıklarla sayfalanmış A4 PDF üretir.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Excel veya CSV Dosyası Seçin (.xlsx, .xls, .csv)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv"
                  onChange={handleExcelUpload}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer bg-slate-950 border border-slate-700 rounded-xl p-2"
                />
                {excelFile && (
                  <p className="text-xs text-emerald-400 mt-1.5 font-medium">
                    ✓ Seçildi: {excelFile.name} ({(excelFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Sayfa Yönü (Oryantasyon)
                  </label>
                  <select
                    value={excelOrientation}
                    onChange={(e: any) => setExcelOrientation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="auto">Otomatik (Genişliğe Göre)</option>
                    <option value="landscape">Yatay / Landscape (Geniş Tablolar İçin)</option>
                    <option value="portrait">Dikey / Portrait</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Tablo Teması &amp; Başlık
                  </label>
                  <select
                    value={excelTheme}
                    onChange={(e: any) => setExcelTheme(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="slate">Modern Slate (Koyu Başlık &amp; Zebra)</option>
                    <option value="corporate">Kurumsal Lacivert (Resmi Rapor)</option>
                    <option value="minimal">Sade Minimal (Beyaz &amp; İnce Çizgili)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs text-slate-300">
                <input
                  type="checkbox"
                  id="excelRowNums"
                  checked={excelShowRowNumbers}
                  onChange={(e) => setExcelShowRowNumbers(e.target.checked)}
                  className="rounded accent-emerald-500 cursor-pointer"
                />
                <label htmlFor="excelRowNums" className="cursor-pointer">
                  Satır numaralarını göster (# 1, 2, 3...)
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  disabled={loading || !excelFile}
                  onClick={() => handleExcelToPdf(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Dönüştürülüyor...' : 'PDF Olarak İndir'}
                </button>

                {onOpenConvertedPdf && (
                  <button
                    disabled={loading || !excelFile}
                    onClick={() => handleExcelToPdf(true)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Atölyede Aç &amp; İmzala
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB: PDF to Images */}
          {activeTab === 'pdf-to-img' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Görüntü Formatı
                  </label>
                  <select
                    value={imgFormat}
                    onChange={(e: any) => setImgFormat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="png">PNG (Kayıpsız &amp; Şeffaf)</option>
                    <option value="jpeg">JPG (Kompakt Dosya Boyutu)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Çözünürlük (DPI)
                  </label>
                  <select
                    value={imgDpi}
                    onChange={(e: any) => setImgDpi(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value={72}>72 DPI (Hızlı &amp; Küçük)</option>
                    <option value={150}>150 DPI (Standart Kalite)</option>
                    <option value={300}>300 DPI (Baskı &amp; Yüksek Çözünürlük)</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                Tüm sayfalar bağımsız yüksek çözünürlüklü görsel dosyalarına dönüştürülerek tek bir .zip arşivi olarak indirilir.
              </p>
              <button
                disabled={loading || !pdfBytes}
                onClick={handlePdfToImg}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? progressText || 'Dönüştürülüyor...' : 'Görüntü Arşivini İndir (.zip)'}
              </button>
            </div>
          )}

          {/* TAB: Images to PDF */}
          {activeTab === 'img-to-pdf' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Görselleri Seçin (Birden Fazla Seçilebilir)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer bg-slate-950 border border-slate-700 rounded-xl p-2"
                />
              </div>

              {selectedImages.length > 0 && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-32 overflow-y-auto space-y-1">
                  <div className="text-xs font-semibold text-slate-300 mb-1">
                    Seçilen Görseller ({selectedImages.length}):
                  </div>
                  {selectedImages.map((img, i) => (
                    <div key={i} className="text-xs text-slate-400 flex justify-between">
                      <span>{i + 1}. {img.name}</span>
                      <span className="uppercase text-[10px] text-slate-500">{img.type}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Sayfa Boyutu
                  </label>
                  <select
                    value={imgPdfSize}
                    onChange={(e: any) => setImgPdfSize(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                  >
                    <option value="A4">Standart A4</option>
                    <option value="Letter">Letter</option>
                    <option value="fit-image">Görsele Göre Uyarla</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Yönlendirme
                  </label>
                  <select
                    value={imgPdfOrientation}
                    onChange={(e: any) => setImgPdfOrientation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                  >
                    <option value="auto">Otomatik</option>
                    <option value="portrait">Dikey (Portrait)</option>
                    <option value="landscape">Yatay (Landscape)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Kenar Boşluğu ({imgPdfMargin}pt)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={imgPdfMargin}
                    onChange={(e) => setImgPdfMargin(Number(e.target.value))}
                    className="w-full accent-blue-500 mt-2"
                  />
                </div>
              </div>

              <button
                disabled={loading || selectedImages.length === 0}
                onClick={handleImgToPdf}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? 'PDF Birleştiriliyor...' : 'Görsellerden PDF Oluştur'}
              </button>
            </div>
          )}

          {/* TAB: PDF to Excel */}
          {activeTab === 'pdf-to-xlsx' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Excel Çalışma Sayfası Adı
                </label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="Veriler"
                />
              </div>
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <p>📊 <strong className="text-slate-300">Akıllı Hücre Ayrıştırma:</strong> Belgedeki satırlar ve koordinat hizalamaları taranarak standart ECMA-376 OpenXML (.xlsx) tablosuna dönüştürülür.</p>
                <p>💡 Sayfa sonları otomatik olarak [Sayfa X] ayırıcıları ile Excel satırlarına yansıtılır.</p>
              </div>
              <button
                disabled={loading || !pdfBytes}
                onClick={handlePdfToExcel}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? 'Tablo Oluşturuluyor...' : 'Excel Tablosu Olarak İndir (.xlsx)'}
              </button>
            </div>
          )}

          {/* TAB: PDF to PPTX */}
          {activeTab === 'pdf-to-pptx' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <p>📽️ <strong className="text-slate-300">ECMA-376 PowerPoint (.pptx):</strong> Her bir PDF sayfası ayrı bir 16:9 geniş ekran slayta yerleştirilir.</p>
                <p>🎨 Başlık ve gövde metinleri düzenlenebilir OpenXML şekilleri olarak aktarılır.</p>
              </div>
              <button
                disabled={loading || !pdfBytes}
                onClick={handlePdfToPptx}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? 'Sunum Hazırlanıyor...' : 'PowerPoint Sunumu İndir (.pptx)'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
