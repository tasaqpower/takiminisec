"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldCheck,
  EyeOff,
  Lock,
  Unlock,
  CheckCircle2,
  Download,
  Trash2,
  Key,
  AlertTriangle,
  ScanText,
  Search,
  Loader2,
  FileCheck2,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { getPdfMetadata, sanitizePdfMetadata, type PdfMetadata } from "./metadataSanitizer";
import { encryptPdfWithPassword, decryptPdfWithPassword, isEncryptedPdf } from "./pdfEncryption";
import { scanPdfForSensitiveEntities, redactDetectedEntities, type DetectedEntity } from "./autoRedact";
import { download } from "@/lib/documents";

interface SecurityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBytes?: Uint8Array;
  fileName?: string;
  onApplySanitizedBytes?: (newBytes: Uint8Array) => void;
}

export function SecurityDialog({
  open,
  onOpenChange,
  pdfBytes,
  fileName = "belge.pdf",
  onApplySanitizedBytes
}: SecurityDialogProps) {
  const [activeTab, setActiveTab] = useState("metadata");
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);

  // Unlock tab state
  const [unlockPassword, setUnlockPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Metadata options
  const [clearTitle, setClearTitle] = useState(true);
  const [clearAuthor, setClearAuthor] = useState(true);
  const [clearDates, setClearDates] = useState(true);
  const [clearXmp, setClearXmp] = useState(true);
  const [clearJs, setClearJs] = useState(true);
  const [clearEmbeddedFiles, setClearEmbeddedFiles] = useState(true);

  // KVKK / Auto-Redact state
  const [isScanningKvkk, setIsScanningKvkk] = useState(false);
  const [isRedactingKvkk, setIsRedactingKvkk] = useState(false);
  const [detectedEntities, setDetectedEntities] = useState<DetectedEntity[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  useEffect(() => {
    if (open && pdfBytes) {
      getPdfMetadata(pdfBytes)
        .then((meta) => setMetadata(meta))
        .catch(() => setMetadata(null));
    }
  }, [open, pdfBytes]);

  const handleScanKvkk = async () => {
    if (!pdfBytes) {
      toast.error("Taranacak belge bulunamadı.");
      return;
    }
    try {
      setIsScanningKvkk(true);
      const results = await scanPdfForSensitiveEntities(pdfBytes);
      setDetectedEntities(results);
      setHasScanned(true);
      if (results.length > 0) {
        toast.success(`Belgede ${results.length} adet hassas veri (TCKN, IBAN, Telefon vb.) tespit edildi.`);
      } else {
        toast.info("Belgede standart hassas veri tespit edilmedi.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Tarama hatası: " + (err.message || ""));
    } finally {
      setIsScanningKvkk(false);
    }
  };

  const handleToggleEntity = (id: string) => {
    setDetectedEntities(prev =>
      prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    );
  };

  const handleToggleAllEntities = (selected: boolean) => {
    setDetectedEntities(prev => prev.map(item => ({ ...item, selected })));
  };

  const handleApplyKvkkRedaction = async () => {
    if (!pdfBytes) return;
    const selected = detectedEntities.filter(e => e.selected);
    if (selected.length === 0) {
      toast.warning("Lütfen maskelenecek en az bir öğe seçin.");
      return;
    }

    try {
      setIsRedactingKvkk(true);
      const redacted = await redactDetectedEntities(pdfBytes, selected);
      onApplySanitizedBytes?.(redacted);
      toast.success(`${selected.length} adet hassas veri kalıcı olarak maskelendi ve PDF içerik akışından silindi.`);
      setDetectedEntities(prev => prev.filter(e => !e.selected));
    } catch (err: any) {
      console.error(err);
      toast.error("Maskeleme hatası: " + (err.message || ""));
    } finally {
      setIsRedactingKvkk(false);
    }
  };

  const handleClearMetadata = async () => {
    if (!pdfBytes) return;
    try {
      const sanitized = await sanitizePdfMetadata(pdfBytes, {
        clearAll: false,
        title: clearTitle,
        author: clearAuthor,
        subject: clearTitle,
        keywords: clearTitle,
        producer: clearAuthor,
        creator: clearAuthor,
        dates: clearDates,
        xmp: clearXmp,
        javascript: clearJs,
        embeddedFiles: clearEmbeddedFiles
      });
      onApplySanitizedBytes?.(sanitized);
      setMetadata((prev) => prev ? {
        ...prev,
        title: clearTitle ? "" : prev.title,
        author: clearAuthor ? "" : prev.author,
        hasXmp: clearXmp ? false : prev.hasXmp,
        hasJavaScript: clearJs ? false : prev.hasJavaScript,
        hasEmbeddedFiles: clearEmbeddedFiles ? false : prev.hasEmbeddedFiles
      } : null);
      toast.success("Seçilen üstveriler başarıyla temizlendi.");
    } catch (e) {
      console.error(e);
      toast.error("Metadata temizlenirken hata oluştu.");
    }
  };

  const handleEncryptAndDownload = async () => {
    if (!pdfBytes) return;
    if (!password) {
      toast.error("Lütfen bir parola belirleyin.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Parolalar birbiriyle eşleşmiyor.");
      return;
    }
    if (password.length < 4) {
      toast.error("Parola en az 4 karakter olmalıdır.");
      return;
    }

    try {
      const encrypted = await encryptPdfWithPassword(pdfBytes, password, {
        allowPrinting,
        allowCopying
      });
      const cleanName = fileName.replace(/\.pdf$/i, "");
      download(
        new Blob([encrypted.buffer as ArrayBuffer], { type: "application/pdf" }),
        `${cleanName}_sifreli.pdf`
      );
      toast.success("Belge standart ISO 32000 AES-256 ile şifrelendi ve indirildi.");
      setPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Şifreleme sırasında bir hata oluştu: " + (e.message || ""));
    }
  };

  const handleUnlockAndDownload = async () => {
    if (!pdfBytes) return;
    if (!unlockPassword) {
      toast.error("Lütfen açılış parolasını girin.");
      return;
    }

    try {
      setIsUnlocking(true);
      const decrypted = await decryptPdfWithPassword(pdfBytes, unlockPassword);
      const cleanName = fileName.replace(/\.pdf$/i, "");
      download(
        new Blob([decrypted.buffer as ArrayBuffer], { type: "application/pdf" }),
        `${cleanName}_sifresiz.pdf`
      );
      toast.success("Belge kilidi açıldı ve şifresiz standart PDF olarak indirildi.");
      setUnlockPassword("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Parola hatalı.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const selectedCount = detectedEntities.filter(e => e.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-2xl p-6 border border-slate-100 max-h-[90vh] overflow-y-auto text-slate-900">
        <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          Gizlilik ve Güvenlik Araçları
        </DialogTitle>
        <DialogDescription className="text-xs text-slate-500 mt-1">
          Belgenizi koruyun: KVKK hassas verilerini otomatik maskeleyin, üstverileri temizleyin, AES-256 ile şifreleyin.
        </DialogDescription>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-4 bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="kvkk" className="text-xs font-semibold text-indigo-700 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              KVKK &amp; Sansür
            </TabsTrigger>
            <TabsTrigger value="metadata" className="text-xs font-medium">
              Metadata Temizleyici
            </TabsTrigger>
            <TabsTrigger value="encrypt" className="text-xs font-medium">
              Parola Koruması
            </TabsTrigger>
            <TabsTrigger value="unlock" className="text-xs font-medium">
              Kilit Açma
            </TabsTrigger>
          </TabsList>

          {/* TAB: KVKK & Auto-Redaction */}
          <TabsContent value="kvkk" className="space-y-4 pt-3">
            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2 text-xs text-indigo-950">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-sm text-indigo-900">
                  <EyeOff className="w-4 h-4 text-indigo-600" />
                  1-Tıkla Otomatik KVKK &amp; PII Sansürleme
                </span>
                <span className="text-[10px] bg-indigo-200/60 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                  Kalıcı Silme
                </span>
              </div>
              <p className="text-slate-600 text-xs">
                Belge içerisindeki T.C. Kimlik Numaralarını (11 haneli algoritma doğrulamalı), TR IBAN hesaplarını, kredi kartlarını, GSM numaralarını ve e-postaları tarar ve tek tıkla geri getirilemez şekilde maskeler.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleScanKvkk}
                disabled={isScanningKvkk}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {isScanningKvkk ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Belge Taranıyor...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Belgeyi Hassas Veriler İçin Tara</span>
                  </>
                )}
              </button>

              {hasScanned && detectedEntities.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleAllEntities(true)}
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    Tümünü Seç
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAllEntities(false)}
                    className="text-slate-500 hover:underline"
                  >
                    Temizle
                  </button>
                </div>
              )}
            </div>

            {/* Results Table */}
            {hasScanned && (
              <div className="space-y-3">
                {detectedEntities.length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                    <p className="text-xs font-bold text-emerald-900">Hassas Veri Tespit Edilmedi</p>
                    <p className="text-[11px] text-emerald-700">
                      Belgede TCKN, IBAN, kredi kartı veya telefon bilgisine rastlanmadı. Belgeniz temiz görünüyor.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="p-2.5 w-8 text-center">✓</th>
                            <th className="p-2.5">Hassas Veri Türü</th>
                            <th className="p-2.5">Maskeli Önizleme</th>
                            <th className="p-2.5 w-20 text-center">Sayfa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detectedEntities.map(ent => (
                            <tr
                              key={ent.id}
                              onClick={() => handleToggleEntity(ent.id)}
                              className={`cursor-pointer transition-colors ${
                                ent.selected ? "bg-indigo-50/50" : "hover:bg-slate-50"
                              }`}
                            >
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={ent.selected}
                                  onChange={() => {}}
                                  className="accent-indigo-600 rounded cursor-pointer"
                                />
                              </td>
                              <td className="p-2.5 font-medium text-slate-800 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${
                                  ent.type === 'tckn' ? 'bg-red-500' : ent.type === 'iban' ? 'bg-blue-500' : 'bg-amber-500'
                                }`} />
                                <span>{ent.label}</span>
                              </td>
                              <td className="p-2.5 font-mono text-slate-600 text-[11px]">
                                {ent.maskedValue}
                              </td>
                              <td className="p-2.5 text-center text-slate-500 text-[11px]">
                                Sayfa {ent.page + 1}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-500">
                        {selectedCount} / {detectedEntities.length} öğe seçili
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyKvkkRedaction}
                        disabled={isRedactingKvkk || selectedCount === 0}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                      >
                        {isRedactingKvkk ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Maskeleniyor...</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Seçili Verileri Kalıcı Olarak Maskele</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB: Metadata Sanitizer */}
          <TabsContent value="metadata" className="space-y-4 pt-3">
            <p className="text-xs text-slate-500">
              PDF belgeleri yazar adı, bilgisayar adı, oluşturulma tarihi, XMP akışları ve komut dosyaları gibi gizli üstveriler barındırabilir.
            </p>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Yazar (Author):</span>
                <span className="text-slate-800 font-semibold">{metadata?.author || "— (Boş)"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Başlık (Title):</span>
                <span className="text-slate-800 font-semibold">{metadata?.title || "— (Boş)"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">XMP Metadata:</span>
                <span className="text-slate-800 font-semibold">{metadata?.hasXmp ? "Mevcut (Gizli üstveri var)" : "Yok"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">JavaScript / Eylemler:</span>
                <span className="text-slate-800 font-semibold">{metadata?.hasJavaScript ? "Mevcut" : "Yok"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Gömülü Dosyalar:</span>
                <span className="text-slate-800 font-semibold">{metadata?.hasEmbeddedFiles ? "Mevcut" : "Yok"}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearTitle}
                  onChange={(e) => setClearTitle(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Başlık, Konu ve Anahtar Kelimeleri Sıfırla
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearAuthor}
                  onChange={(e) => setClearAuthor(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Yazar ve Oluşturucu Program Bilgilerini Temizle
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearDates}
                  onChange={(e) => setClearDates(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Oluşturma ve Değiştirilme Zaman Damgalarını Kaldır
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearXmp}
                  onChange={(e) => setClearXmp(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Genişletilmiş XMP Meta Veri Akışını Sil
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearJs}
                  onChange={(e) => setClearJs(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Gömülü JavaScript ve Otomatik Eylemleri Kaldır
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearEmbeddedFiles}
                  onChange={(e) => setClearEmbeddedFiles(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                İliştirilmiş Gömülü Dosyaları Temizle
              </label>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClearMetadata}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Seçili Üstverileri Kalıcı Olarak Temizle
              </button>
            </div>
          </TabsContent>

          {/* TAB: Encryption */}
          <TabsContent value="encrypt" className="space-y-4 pt-3">
            <p className="text-xs text-slate-500">
              Belgenizi standart ISO 32000 AES-256 standardı ile şifreleyin. Adobe Acrobat, Google Chrome ve tüm standart PDF okuyucular tarafından desteklenir.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Açılış Parolası
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="En az 4 karakter girin"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Parolayı Doğrula
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Parolayı tekrar girin"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2 pt-1 text-xs text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPrinting}
                    onChange={(e) => setAllowPrinting(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Yazdırmaya izin ver
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowCopying}
                    onChange={(e) => setAllowCopying(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Metin ve içerik kopyalamaya izin ver
                </label>
              </div>

              <button
                type="button"
                onClick={handleEncryptAndDownload}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors mt-2"
              >
                <Lock className="w-3.5 h-3.5" />
                Şifrele ve İndir (.pdf)
              </button>
            </div>
          </TabsContent>

          {/* TAB: Unlock */}
          <TabsContent value="unlock" className="space-y-4 pt-3">
            <p className="text-xs text-slate-500">
              Parolasını bildiğiniz şifreli bir PDF belgesinin parolasını kaldırarak standart şifresiz bir PDF olarak kaydedin.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mevcut Belge Parolası
                </label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Belge parolasını girin"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleUnlockAndDownload}
                disabled={isUnlocking}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                <Unlock className="w-3.5 h-3.5" />
                {isUnlocking ? "Kilit Açılıyor..." : "Kilidi Kaldır ve İndir"}
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
