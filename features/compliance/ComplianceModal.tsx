import React, { useState, useEffect } from 'react';
import {
  convertToPdfA2b,
  auditAccessibility,
  autoFixAccessibility,
} from './complianceEngine';
import type {
  AccessibilityReport,
} from './complianceTypes';

interface ComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array | null;
  onApply: (modifiedPdfBytes: Uint8Array) => void;
}

export const ComplianceModal: React.FC<ComplianceModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState<'pdfa' | 'a11y'>('pdfa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF/A state
  const [docTitle, setDocTitle] = useState('Resmi Arşiv Dokümanı');
  const [docAuthor, setDocAuthor] = useState('Forma Kullanıcısı');
  const [docLang, setDocLang] = useState('tr-TR');

  // Accessibility state
  const [report, setReport] = useState<AccessibilityReport | null>(null);

  const handleRunAudit = async () => {
    if (!pdfBytes) return;
    try {
      setLoading(true);
      setError(null);
      const res = await auditAccessibility(pdfBytes);
      setReport(res);
    } catch (err: any) {
      setError('Erişilebilirlik analizi hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'a11y' && pdfBytes && !report) {
      handleRunAudit();
    }
  }, [isOpen, activeTab, pdfBytes, report]);

  if (!isOpen) return null;

  const handleConvertToPdfA = async () => {
    if (!pdfBytes) {
      setError('Lütfen önce bir PDF belgesi açın.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const pdfABytes = await convertToPdfA2b(pdfBytes, {
        title: docTitle,
        author: docAuthor,
        language: docLang,
      });
      onApply(pdfABytes);
      onClose();
    } catch (err: any) {
      setError('PDF/A dönüştürme hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFix = async () => {
    if (!pdfBytes) return;
    try {
      setLoading(true);
      setError(null);
      const fixedBytes = await autoFixAccessibility(pdfBytes, {
        title: docTitle,
        language: docLang,
      });
      onApply(fixedBytes);
      // Re-run audit with fixed bytes
      const updatedReport = await auditAccessibility(fixedBytes);
      setReport(updatedReport);
    } catch (err: any) {
      setError('Otomatik düzeltme hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erisilebilirlik_raporu_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500';
    if (score >= 70) return 'text-amber-400 border-amber-500';
    return 'text-red-400 border-red-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-semibold text-white">PDF/A ve Erişilebilirlik Standartları</h2>
            <p className="text-xs text-slate-400">ISO 19005-2 PDF/A-2b arşiv uyumluluğu ve WCAG 2.1 AA erişilebilirlik denetimi</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-6 pt-3">
          <button
            onClick={() => setActiveTab('pdfa')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pdfa'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PDF/A-2b Arşiv Dönüşümü
          </button>
          <button
            onClick={() => {
              setActiveTab('a11y');
              handleRunAudit();
            }}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'a11y'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Erişilebilirlik Raporu (WCAG)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-xs">
              {error}
            </div>
          )}

          {activeTab === 'pdfa' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Belge Başlığı (Title)</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Yazar / Kurum (Author)</label>
                  <input
                    type="text"
                    value={docAuthor}
                    onChange={(e) => setDocAuthor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Belge Dili (ISO Lang)</label>
                <select
                  value={docLang}
                  onChange={(e) => setDocLang(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="tr-TR">Türkçe (tr-TR)</option>
                  <option value="en-US">İngilizce (en-US)</option>
                  <option value="de-DE">Almanca (de-DE)</option>
                  <option value="fr-FR">Fransızca (fr-FR)</option>
                </select>
              </div>

              {/* Checklist */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-200">ISO 19005-2 PDF/A-2b Gereksinimleri:</div>
                <ul className="text-xs text-slate-400 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Standart sRGB IEC61966-2.1 OutputIntent renk profili eklenir</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Resmi XMP PDF/A metadata şeması (<code className="text-blue-400">{`pdfaid:part="2"`}</code>) gömülür</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Güvenlik riski oluşturan harici JavaScript ve eylemler temizlenir</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Belge dili ve mantıksal etiketleme (MarkInfo) tanımlanır</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleConvertToPdfA}
                disabled={loading || !pdfBytes}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/30"
              >
                {loading ? 'Dönüştürülüyor...' : 'PDF/A-2b Formatına Dönüştür ve Uygula'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Score Header */}
              {report && (
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-full border-4 flex items-center justify-center font-bold text-lg ${getScoreColor(
                        report.score
                      )}`}
                    >
                      {report.score}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Erişilebilirlik Skoru</div>
                      <div className="text-xs text-slate-400">
                        {report.score >= 90
                          ? 'Mükemmel - Belge WCAG 2.1 AA kriterlerine büyük oranda uygundur.'
                          : report.score >= 70
                          ? 'İyi - Bazı ekran okuyucu uyarıları tespit edildi.'
                          : 'Kritik - Ekran okuyucu uyumluluğu için düzeltmeler önerilir.'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700"
                    >
                      Raporu İndir
                    </button>
                    {report.score < 100 && (
                      <button
                        type="button"
                        onClick={handleAutoFix}
                        disabled={loading}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded transition-colors"
                      >
                        Otomatik Düzelt
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Issues List */}
              {report && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-slate-300">
                    Tespit Edilen Maddeler ({report.issues.length}):
                  </div>

                  {report.issues.length === 0 ? (
                    <div className="p-6 text-center bg-slate-950 rounded-xl border border-slate-800 text-emerald-400 text-xs">
                      ✓ Tebrikler! Belgede hiçbir erişilebilirlik ihlali bulunamadı.
                    </div>
                  ) : (
                    report.issues.map((issue) => (
                      <div
                        key={issue.id}
                        className={`p-3 rounded-lg border text-xs space-y-1 ${
                          issue.severity === 'error'
                            ? 'bg-red-950/20 border-red-800/50 text-red-200'
                            : 'bg-amber-950/20 border-amber-800/50 text-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{issue.rule}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                              issue.severity === 'error'
                                ? 'bg-red-900/60 text-red-300'
                                : 'bg-amber-900/60 text-amber-300'
                            }`}
                          >
                            {issue.severity === 'error' ? 'Hata' : 'Uyarı'}
                          </span>
                        </div>
                        <p className="text-slate-300">{issue.description}</p>
                        <p className="text-slate-400 pt-1">
                          💡 <strong className="text-slate-300">Öneri:</strong> {issue.fixRecommendation}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
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
