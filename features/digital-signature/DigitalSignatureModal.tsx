import React, { useState, useEffect } from 'react';
import {
  signPdf,
  verifyPdfSignatures,
  generateSecurePassword,
} from './signatureEngine';
import { Copy, Check, Key, RefreshCw } from 'lucide-react';
import type {
  SignPdfOptions,
  SignatureVerificationResult,
} from './signatureTypes';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array | null;
  onApply: (signedPdfBytes: Uint8Array) => void;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState<'sign' | 'verify'>('sign');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign State
  const [certMode, setCertMode] = useState<'self' | 'p12'>('self');
  const [signerName, setSignerName] = useState('Av. Sinan Yılmaz');
  const [organization, setOrganization] = useState('Hukuk Müşavirliği');
  const [reason, setReason] = useState('Doküman Aslı Tasdiki');
  const [location, setLocation] = useState('İstanbul / Türkiye');

  // P12 state
  const [p12Bytes, setP12Bytes] = useState<Uint8Array | null>(null);
  const [p12Password, setP12Password] = useState('');
  const [p12FileName, setP12FileName] = useState('');

  // Self-signed random password
  const [selfSignedPassword, setSelfSignedPassword] = useState<string>(() => generateSecurePassword(16));
  const [copiedPassword, setCopiedPassword] = useState(false);

  const handleCopyPassword = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(selfSignedPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const handleRegeneratePassword = () => {
    setSelfSignedPassword(generateSecurePassword(16));
    setCopiedPassword(false);
  };

  // Visual widget state
  const [showVisual, setShowVisual] = useState(true);
  const [visualPage, setVisualPage] = useState(1);
  const [visualX, setVisualX] = useState(50);
  const [visualY, setVisualY] = useState(50);

  // Verification results state
  const [verificationResults, setVerificationResults] = useState<SignatureVerificationResult[]>([]);
  const [verifiedOnce, setVerifiedOnce] = useState(false);

  const handleRunVerification = async () => {
    if (!pdfBytes) return;
    try {
      setLoading(true);
      setError(null);
      const results = await verifyPdfSignatures(pdfBytes);
      setVerificationResults(results);
      setVerifiedOnce(true);
    } catch (err: any) {
      setError('İmza doğrulama hatası: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'verify' && pdfBytes && !verifiedOnce) {
      handleRunVerification();
    }
  }, [isOpen, activeTab, pdfBytes, verifiedOnce]);

  if (!isOpen) return null;

  const handleP12FileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setP12FileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setP12Bytes(new Uint8Array(reader.result as ArrayBuffer));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSign = async () => {
    if (!pdfBytes) {
      setError('Lütfen önce bir PDF belgesi açın.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const signOptions: SignPdfOptions = {
        reason,
        location,
        visual: showVisual
          ? {
              showVisual: true,
              pageIndex: visualPage - 1,
              x: visualX,
              y: visualY,
              width: 250,
              height: 75,
            }
          : undefined,
      };

      if (certMode === 'self') {
        signOptions.selfSigned = {
          commonName: signerName,
          organization,
          country: 'TR',
          password: selfSignedPassword,
        };
      } else {
        if (!p12Bytes) {
          throw new Error('Lütfen geçerli bir .p12 veya .pfx sertifika dosyası seçin.');
        }
        signOptions.p12Bytes = p12Bytes;
        signOptions.p12Password = p12Password;
      }

      const signedBytes = await signPdf(pdfBytes, signOptions);
      onApply(signedBytes);
      onClose();
    } catch (err: any) {
      setError('İmzalama hatası: ' + (err.message || String(err)));
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
            <h2 className="text-lg font-semibold text-white">Sertifika Tabanlı Dijital İmza (Deneysel CMS / PKCS#7)</h2>
            <p className="text-xs text-slate-400">ISO 32000-1 PPKLite PKCS#7 ayrılmış dijital imza ekleyin veya belgedeki imzaların kriptografik bütünlüğünü doğrulayın</p>
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
            onClick={() => setActiveTab('sign')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sign'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Belgeyi İmzala
          </button>
          <button
            onClick={() => {
              setActiveTab('verify');
              handleRunVerification();
            }}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'verify'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            İmzaları Doğrula
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-xs">
              {error}
            </div>
          )}

          {activeTab === 'sign' ? (
            <div className="space-y-4">
              {/* Cert Source */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Sertifika Kaynağı</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCertMode('self')}
                    className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                      certMode === 'self'
                        ? 'border-blue-500 bg-blue-950/30 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-slate-200 mb-0.5">Yerel Test Sertifikası</div>
                    <div>Cihazda otomatik 2048-bit RSA anahtar çifti ve öz-imzalı sertifika üretilir.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertMode('p12')}
                    className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                      certMode === 'p12'
                        ? 'border-blue-500 bg-blue-950/30 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-slate-200 mb-0.5">Sertifika Yükle (.p12 / .pfx)</div>
                    <div>Yazılım tabanlı PKCS#12 dosyanızı kullanın (Kurumsal / test sertifikaları).</div>
                  </button>
                </div>
              </div>

              {certMode === 'p12' ? (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">PKCS#12 Dosyası (.p12, .pfx)</label>
                    <input
                      type="file"
                      accept=".p12,.pfx"
                      onChange={handleP12FileSelect}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                    />
                    {p12FileName && <div className="text-xs text-emerald-400 mt-1">✓ {p12FileName} seçildi</div>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Sertifika Parolası</label>
                    <input
                      type="password"
                      value={p12Password}
                      onChange={(e) => setP12Password(e.target.value)}
                      placeholder="Parola girin (varsa)"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">İmzalayan Adı Soyadı</label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Kurum / Unvan</label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                    />
                  </div>

                  {/* Secure Random Password Display & Copy */}
                  <div className="col-span-2 p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-blue-400" />
                        <span>Sertifika Parolası (16 Karakter Güçlü Rastgele)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleRegeneratePassword}
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                        title="Yeni rastgele parola üret"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Yenile</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={selfSignedPassword}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-emerald-400 tracking-wider select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          copiedPassword
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {copiedPassword ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Kopyalandı!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Kopyala</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Cihazınızda kriptografik rastgelelik (crypto.getRandomValues) ile üretilmiştir. Sabit veya güvensiz parola kullanılmaz.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">İmza Sebebi</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Konum</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
              </div>

              {/* Visual Widget Option */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showVisual}
                    onChange={(e) => setShowVisual(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-xs font-medium text-slate-200">Görsel İmza Damgası Ekle (Sayfa Üzerinde Kutu)</span>
                </label>

                {showVisual && (
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Sayfa No</label>
                      <input
                        type="number"
                        min={1}
                        value={visualPage}
                        onChange={(e) => setVisualPage(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">X Konumu (pt)</label>
                      <input
                        type="number"
                        value={visualX}
                        onChange={(e) => setVisualX(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Y Konumu (pt)</label>
                      <input
                        type="number"
                        value={visualY}
                        onChange={(e) => setVisualY(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <div>🔒 <strong className="text-slate-300">Sıfır Bulut Sızıntısı:</strong> Özel anahtarlarınız ve parolalarınız kesinlikle sunucuya iletilmez veya diske kaydedilmez. Tüm imzalama işlemi doğrudan tarayıcı belleğinde gerçekleştirilir.</div>
                <div className="text-[11px] text-amber-400/90">⚠️ <strong className="text-amber-300">Hukuki Bilgilendirme:</strong> Bu imza SHA-256 tabanlı kriptografik bütünlük sağlar; 5070 sayılı E-İmza Kanunu kapsamındaki Nitelikli Elektronik Sertifika (NES) donanımı (akıllı kart/token) yerine geçmez.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Belgede tespit edilen dijital imzalar:</span>
                <button
                  type="button"
                  onClick={handleRunVerification}
                  disabled={loading}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700"
                >
                  Yeniden Tara
                </button>
              </div>

              {verificationResults.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  Bu belgede henüz standart bir dijital imza tespit edilmedi veya taranmadı.
                </div>
              ) : (
                <div className="space-y-3">
                  {verificationResults.map((sig, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border ${
                        sig.isValid
                          ? 'bg-emerald-950/20 border-emerald-800/60'
                          : 'bg-red-950/20 border-red-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-base ${sig.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                            {sig.isValid ? '✓' : '⚠️'}
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {sig.signerName || 'İmza ' + (idx + 1)}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            sig.isValid
                              ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                              : 'bg-red-900/40 text-red-300 border border-red-700/50'
                          }`}
                        >
                          {sig.isValid ? 'Bütünlük Doğrulandı (Öz-İmzalı / Yerel)' : 'Geçersiz / Bütünlük Bozulmuş'}
                        </span>
                      </div>

                      {sig.error && (
                        <div className="text-xs text-red-400 mb-2">{sig.error}</div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-2">
                        {sig.reason && <div><strong className="text-slate-300">Sebep:</strong> {sig.reason}</div>}
                        {sig.location && <div><strong className="text-slate-300">Konum:</strong> {sig.location}</div>}
                        {sig.signingTime && <div><strong className="text-slate-300">İmza Zamanı:</strong> {sig.signingTime}</div>}
                        {sig.certificate?.issuer && (
                          <div><strong className="text-slate-300">Sertifika Veren:</strong> {sig.certificate.issuer}</div>
                        )}
                        {sig.certificate?.validTo && (
                          <div><strong className="text-slate-300">Son Geçerlilik:</strong> {new Date(sig.certificate.validTo).toLocaleDateString('tr-TR')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
            Kapat
          </button>
          {activeTab === 'sign' && (
            <button
              onClick={handleSign}
              disabled={loading || !pdfBytes}
              className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/30"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>İmzalanıyor...</span>
                </>
              ) : (
                <span>Belgeyi İmzala ve Uygula</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
