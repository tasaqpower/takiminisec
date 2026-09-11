"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, EyeOff, Lock, Unlock, CheckCircle2, Download, Trash2, Key, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getPdfMetadata, sanitizePdfMetadata, type PdfMetadata } from "./metadataSanitizer";
import { encryptPdfWithPassword, decryptPdfWithPassword, isEncryptedPdf } from "./pdfEncryption";
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

  useEffect(() => {
    if (open && pdfBytes) {
      getPdfMetadata(pdfBytes)
        .then((meta) => setMetadata(meta))
        .catch(() => setMetadata(null));
    }
  }, [open, pdfBytes]);

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
      toast.error("Lütfen belgenin parolasını girin.");
      return;
    }

    setIsUnlocking(true);
    try {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-white rounded-xl shadow-2xl p-6 border border-slate-100 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          Gizlilik ve Güvenlik Araçları
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-500 mt-1">
          Belgenizi koruyun: Üstverileri temizleyin, kalıcı karartma uygulayın, standart AES-256 ile kilitleyin veya şifresini çözün.
        </DialogDescription>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-4 bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="metadata" className="text-xs font-medium">
              Metadata Temizleyici
            </TabsTrigger>
            <TabsTrigger value="redaction" className="text-xs font-medium">
              Kalıcı Karartma
            </TabsTrigger>
            <TabsTrigger value="encrypt" className="text-xs font-medium">
              Parola Koruması
            </TabsTrigger>
            <TabsTrigger value="unlock" className="text-xs font-medium">
              Kilit Açma
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Metadata Sanitizer */}
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

            {/* Selection Checkboxes */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={clearAuthor} onChange={e => setClearAuthor(e.target.checked)} className="rounded text-indigo-600" />
                <span>Yazar ve Üretici Bilgisi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={clearTitle} onChange={e => setClearTitle(e.target.checked)} className="rounded text-indigo-600" />
                <span>Başlık ve Konu</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={clearDates} onChange={e => setClearDates(e.target.checked)} className="rounded text-indigo-600" />
                <span>Oluşturma Tarihleri</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={clearXmp} onChange={e => setClearXmp(e.target.checked)} className="rounded text-indigo-600" />
                <span>XMP Metadata Akışı</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={clearJs} onChange={e => setClearJs(e.target.checked)} className="rounded text-indigo-600" />
                <span>JavaScript ve Otomatik Eylemler</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={clearEmbeddedFiles} onChange={e => setClearEmbeddedFiles(e.target.checked)} className="rounded text-indigo-600" />
                <span>Gömülü Ek Dosyalar</span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Cihazınızda yerel temizleme
              </span>
              <button
                type="button"
                onClick={handleClearMetadata}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Tüm Üstverileri Temizle
              </button>
            </div>
          </TabsContent>

          {/* TAB 2: Redaction info */}
          <TabsContent value="redaction" className="space-y-4 pt-3">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2 text-amber-900">
              <h4 className="font-bold flex items-center gap-1.5 text-sm">
                <EyeOff className="w-4 h-4 text-amber-700" />
                Gerçek / Kalıcı Karartma (True Redaction)
              </h4>
              <p>
                Geleneksel editörler yalnızca metnin üzerine siyah bir kutu çizer; bu durum metnin kopyalanabilmesine veya seçilebilmesine yol açar.
              </p>
              <p className="font-semibold">
                Forma Kalıcı Karartma Sistemi: PDFium WASM motoru ile alttaki metin karakterlerini doğrudan PDF içerik akışından siler, böylece geri getirilmesi imkansız hale gelir.
              </p>
            </div>

            <p className="text-xs text-slate-600">
              Belge üzerindeki herhangi bir metni seçip silebilir, veya Karartma aracıyla istediğiniz alanı tamamen geri getirilemez şekilde karartabilirsiniz.
            </p>
          </TabsContent>

          {/* TAB 3: Encryption */}
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
                  placeholder="En az 4 karakter girin…"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Parolayı Doğrulayın
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Parolayı tekrar girin…"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">Güvenlik İzinleri</span>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPrinting}
                    onChange={(e) => setAllowPrinting(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Belgenin yazdırılmasına izin ver</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowCopying}
                    onChange={(e) => setAllowCopying(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Metin kopyalamaya izin ver</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={handleEncryptAndDownload}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                Standart Parola ile Kilitle ve İndir
              </button>
            </div>
          </TabsContent>

          {/* TAB 4: Unlock PDF */}
          <TabsContent value="unlock" className="space-y-4 pt-3">
            <p className="text-xs text-slate-500">
              Parolasını bildiğiniz korumalı bir PDF belgesinin parolasını kaldırarak standart, şifresiz bir PDF olarak indirin.
            </p>

            <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs space-y-2 text-indigo-950">
              <span className="font-semibold flex items-center gap-1.5">
                <Key className="w-4 h-4 text-indigo-600" />
                Yasal ve Güvenli Kilit Kaldırma
              </span>
              <p className="text-indigo-800">
                Parola kırma işlemi yapılmaz. Sadece bildiğiniz geçerli parolayı girerek korumayı kalıcı olarak kaldırabilirsiniz. Parolanız hiçbir yere kaydedilmez.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mevcut Belge Parolası
              </label>
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Belgenin geçerli parolasını girin…"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                disabled={isUnlocking}
                onClick={handleUnlockAndDownload}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <Unlock className="w-3.5 h-3.5" />
                {isUnlocking ? "Kilit Açılıyor…" : "Şifreyi Kaldır ve İndir"}
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
