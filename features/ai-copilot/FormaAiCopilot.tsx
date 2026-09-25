"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  Send,
  X,
  Download,
  ExternalLink,
  Loader2,
  Paperclip,
  CheckCircle2,
  Bot,
  UploadCloud,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  FileText,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { parseUserIntent } from "./aiIntentEngine";
import type { AiActionResult, SelectedImageContext } from "./aiActionDispatcher";
import type { Mark } from "../../lib/documents.ts";
import type { TextRemoval } from "../../lib/pdf-text.ts";
import { toast } from "sonner";

export interface FormaAiCopilotProps {
  pdfBytes?: Uint8Array | null;
  fileName?: string;
  currentPage?: number;
  selectedImage?: SelectedImageContext | null;
  existingMarks?: Mark[];
  existingRemovals?: TextRemoval[];
  onApplyPdfBytes?: (bytes: Uint8Array, newFileName?: string) => Promise<void> | void;
  onApplyMarksAndRemovals?: (newMarks: Mark[], newRemovals: TextRemoval[]) => void;
  onRollbackMarksAndRemovals?: (marksToRemove: Mark[], removalsToRemove: TextRemoval[]) => void;
  onOpenDocument?: (files: File[]) => Promise<void> | void;
  className?: string;
}

export interface ActionPlan {
  id: string;
  intent: any;
  title: string;
  description: string;
  targetDetails: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'done';
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  actionResult?: AiActionResult;
  isProcessing?: boolean;
  plan?: ActionPlan;
  canRollback?: boolean;
}

export function FormaAiCopilot({
  pdfBytes,
  fileName,
  currentPage = 0,
  selectedImage,
  existingMarks = [],
  existingRemovals = [],
  onApplyPdfBytes,
  onApplyMarksAndRemovals,
  onRollbackMarksAndRemovals,
  onOpenDocument,
  className = ""
}: FormaAiCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [activeBytes, setActiveBytes] = useState<Uint8Array | null>(pdfBytes || null);
  const [activeName, setActiveName] = useState<string>(fileName || "Belge.pdf");
  const [isDragging, setIsDragging] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [pendingPlan, setPendingPlan] = useState<ActionPlan | null>(null);
  const [historyStack, setHistoryStack] = useState<{ bytes: Uint8Array; name: string }[]>([]);
  const [lastExecutedAction, setLastExecutedAction] = useState<any>(null);
  const [selectedWatermarkCandidateIds, setSelectedWatermarkCandidateIds] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setVoiceEnabled(localStorage.getItem("forma_ai_voice") === "true");
    }
  }, []);

  const stripMarkdownForSpeech = (md: string): string => {
    return md
      .replace(/[\*\_~`#>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/•/g, "")
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/\n+/g, ". ")
      .trim();
  };

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = stripMarkdownForSpeech(text);
      if (!clean) return;
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "tr-TR";
      const voices = window.speechSynthesis.getVoices();
      const trVoice = voices.find(v => v.lang.startsWith("tr") || v.lang === "tr-TR");
      if (trVoice) utterance.voice = trVoice;
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech errors
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("forma_ai_voice", String(next));
    }
    if (next) {
      speakText("Sesli yanıt sistemi açıldı! Sizi dinlemeye ve yanıt vermeye hazırım.");
      toast.success("Sesli yanıt sistemi açıldı (Türkçe)");
    } else {
      stopSpeaking();
      toast.info("Sesli yanıt kapatıldı");
    }
  };

  const startListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error("Tarayıcınız ses tanımayı desteklemiyor. (Google Chrome veya Edge önerilir)");
      return;
    }

    if (typeof window !== "undefined") {
      const acknowledged = localStorage.getItem("forma_voice_privacy_acknowledged");
      if (!acknowledged) {
        toast.info(
          "Ses tanıma tarayıcınız tarafından sağlanır ve bazı tarayıcılarda ses işlenmek üzere tarayıcı sağlayıcısına gönderilebilir.",
          { duration: 6000 }
        );
        localStorage.setItem("forma_voice_privacy_acknowledged", "true");
      }
    }

    try {
      stopSpeaking();
      const recognition = new SpeechRec();
      recognition.lang = "tr-TR";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0]?.transcript || "")
          .join("");
        setInputText(transcript);
      };

      recognition.onerror = (e: any) => {
        setIsListening(false);
        if (e.error === "not-allowed") {
          toast.error("Mikrofon erişim izni verilmedi. Lütfen tarayıcı ayarlarından mikrofona izin verin.");
        } else if (e.error !== "no-speech") {
          toast.error(`Ses tanıma uyarısı: ${e.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      toast.error("Mikrofon başlatılamadı.");
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsListening(false);
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "Merhaba! Ben **Forma AI**. Bana sesli konuşabilir veya yazabilirsiniz:\n\n• 📄 *\"Belgenin yapısını ve metnini özetle\"*\n• 🗑️ *\"Seçili görseli sil\"* / *\"Bu görseli kaldır\"*\n• ✨ *\"Seçili görseli netleştir\"*\n• 🎙️ *\"Sesli yanıtı aç\"* / *\"Sesi kapat\"*\n• 🌙 *\"Koyu mod yap\"* / ☀️ *\"Açık mod yap\"*\n• 🧹 *\"Filigranı kaldır\"* / 🔏 *\"Filigran ekle\"*\n• 🔒 *\"TC ve IBAN'ları sansürle (KVKK)\"*\n• 🗜️ *\"PDF'i sıkıştır\"*\n• 📝 *\"Word'e çevir\"* / 📊 *\"Excel'e aktar\"*\n• 🏷️ *\"ASLI GİBİDİR kaşesi bas\"*\n• 🔄 *\"Sayfaları 90 derece döndür\"* / 🗑️ *\"İlk/son sayfayı sil\"*",
      timestamp: "Forma AI",
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pdfBytes) {
      setActiveBytes(pdfBytes);
    }
  }, [pdfBytes]);

  useEffect(() => {
    if (fileName) {
      setActiveName(fileName);
    }
  }, [fileName]);

  useEffect(() => {
    if (isOpen) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      setTimeout(() => {
        try {
          inputRef.current?.focus({ preventScroll: true });
        } catch {
          inputRef.current?.focus();
        }
      }, 150);
    }
  }, [isOpen, messages]);

  const handleDownload = (bytes: Uint8Array, downloadFileName: string, mime = "application/pdf") => {
    try {
      const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${downloadFileName} başarıyla indirildi.`);
    } catch {
      toast.error("Dosya indirilirken bir hata oluştu.");
    }
  };

  const handleOpenInWorkspace = async (bytes: Uint8Array, targetName: string) => {
    const file = new File([bytes as unknown as BlobPart], targetName, { type: "application/pdf" });
    if (onOpenDocument) {
      await onOpenDocument([file]);
      toast.success("Belge düzenleme alanında açıldı!");
      setIsOpen(false);
    } else if (onApplyPdfBytes) {
      await onApplyPdfBytes(bytes, targetName);
      toast.success("Çalışma alanındaki belge güncellendi!");
    }
  };

  const buildActionPlan = (intent: any, currentDocName: string, pageIdx: number): ActionPlan | null => {
    const pageNum = pageIdx + 1;
    switch (intent.action) {
      case 'watermark_remove':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '🧹 Filigran Temizleme',
          description: 'Tespit edilen filigran ve taslak damgası nesneleri onayınızla temizlenecek.',
          targetDetails: `${currentDocName} · Tüm Sayfalar`,
          status: 'pending',
        };
      case 'delete_object':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '🗑️ Seçili Görseli Silme',
          description: 'Seçili görsel nesnesi doğrulanıp belgeden kalıcı olarak silinecek.',
          targetDetails: `${currentDocName} · Sayfa ${pageNum}`,
          status: 'pending',
        };
      case 'enhance_selective':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '✨ Seçili Görseli Netleştirme',
          description: 'Diğer görseller ve vektörel metinler korunarak yalnızca seçili görsel izole edilip netleştirilecek.',
          targetDetails: `${currentDocName} · Sayfa ${pageNum}`,
          status: 'pending',
        };
      case 'enhance_document':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '✨ Belge & Taranmış Yazı Netleştirme',
          description: 'Bulanık ve soluk taranmış yazılar koyulaştırılacak, kontrast artırılıp arka plan temizlenecek.',
          targetDetails: `${currentDocName} · Tüm Sayfalar`,
          status: 'pending',
        };
      case 'theme_dark':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '🌙 Koyu Moda Geçiş',
          description: 'Uygulama arayüzü ve çalışma alanı koyu tema kontrastına dönüştürülecek.',
          targetDetails: 'Forma Arayüzü',
          status: 'pending',
        };
      case 'theme_light':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '☀️ Açık Moda Geçiş',
          description: 'Uygulama arayüzü ve çalışma alanı aydınlık temaya dönüştürülecek.',
          targetDetails: 'Forma Arayüzü',
          status: 'pending',
        };
      case 'compress_pdf':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '📦 PDF Boyutu Sıkıştırma',
          description: 'Görseller optimize edilecek, gereksiz meta veriler temizlenip dosya boyutu küçültülecek.',
          targetDetails: `${currentDocName}`,
          status: 'pending',
        };
      case 'convert_word':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '📝 PDF → Düzenlenebilir Word (.docx)',
          description: 'PDF metinleri, başlıkları ve tabloları Microsoft Word (.docx) formatına dönüştürülecek.',
          targetDetails: `${currentDocName}`,
          status: 'pending',
        };
      case 'convert_excel':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '📊 PDF → Excel (.xlsx)',
          description: 'PDF içerisindeki tablo ve sayısal veriler hücrelere ayrılarak Excel formatına aktarılacak.',
          targetDetails: `${currentDocName}`,
          status: 'pending',
        };
      case 'convert_img':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '🖼️ PDF → Yüksek Çözünürlüklü Görsel',
          description: 'PDF sayfaları yüksek DPI değerinde PNG/JPG görsellerine dönüştürülüp paketlenecek.',
          targetDetails: `${currentDocName}`,
          status: 'pending',
        };
      case 'redact_pii':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '🛡️ KVKK & Gizli Veri Sansürleme',
          description: 'TC Kimlik No, IBAN, telefon ve hassas kişisel veriler tespit edilip geri döndürülemez şekilde maskelenecek.',
          targetDetails: `${currentDocName}`,
          status: 'pending',
        };
      case 'stamp_document':
        return {
          id: crypto.randomUUID(),
          intent,
          title: `📑 Resmî Kaşe Basımı: ${intent.parameters?.stampType?.toUpperCase() || 'ASLI GİBİDİR'}`,
          description: 'Resmî onay kaşesi bugünün tarihi ve tasdik koduyla sayfaya eklenecek.',
          targetDetails: `${currentDocName} · Sayfa ${pageNum}`,
          status: 'pending',
        };
      case 'rotate_pages':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '🔄 Sayfa Döndürme',
          description: `Sayfalar ${intent.parameters?.angle || 90}° döndürülecek.`,
          targetDetails: `${currentDocName}`,
          status: 'pending',
        };
      case 'delete_pages':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '✂️ Sayfa Silme',
          description: 'Belirtilen sayfalar belgeden çıkarılacak.',
          targetDetails: `${currentDocName}`,
          status: 'pending',
        };
      case 'protect_pdf':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '🔒 PDF Şifreleme & Koruma',
          description: 'Belge 128-bit şifreleme ile korumaya alınacak.',
          targetDetails: `${currentDocName}`,
          status: 'pending',
        };
      case 'find_replace':
        return {
          id: crypto.randomUUID(),
          intent,
          title: '🔄 Akıllı Metin & İsim Değiştirme',
          description: `'${intent.parameters?.searchTerm || ''}' ifadesi '${intent.parameters?.replaceTerm || ''}' ile değiştirilecek. Orijinal etiketler, font, punto ve satır yerleşimi korunacak.`,
          targetDetails: `${currentDocName} · Sayfa İçi Değiştirme`,
          status: 'pending',
        };
      default:
        return null;
    }
  };

  const executeConfirmedAction = async (intentToRun: any) => {
    setIsProcessing(true);
    setProgressText("İşlem gerçekleştiriliyor...");
    setPendingPlan(null);

    // Save rollback snapshot
    if (activeBytes) {
      setHistoryStack((prev) => [...prev.slice(-9), { bytes: activeBytes, name: activeName }]);
    }
    setLastExecutedAction(intentToRun);

    const assistantMsgId = crypto.randomUUID();

    try {
      const { dispatchAiAction } = await import("./aiActionDispatcher.ts");
      const result = await dispatchAiAction(
        intentToRun,
        {
          pdfBytes: activeBytes,
          fileName: activeName,
          currentPage,
          selectedImage: selectedImage || null,
          confirmedCandidateIds: intentToRun.confirmedCandidateIds,
          existingMarks,
          existingRemovals,
        },
        (prog) => setProgressText(prog)
      );

      setLastExecutedAction(result);

      if (result.metadata?.voiceState === 'on') {
        setVoiceEnabled(true);
        if (typeof window !== 'undefined') localStorage.setItem('forma_ai_voice', 'true');
      } else if (result.metadata?.voiceState === 'off') {
        setVoiceEnabled(false);
        if (typeof window !== 'undefined') localStorage.setItem('forma_ai_voice', 'false');
        stopSpeaking();
      }

      if (result.newMarks && result.newRemovals && onApplyMarksAndRemovals) {
        onApplyMarksAndRemovals(result.newMarks, result.newRemovals);
        // Do NOT set activeBytes to newPdfBytes: changes are managed as workspace marks/removals
        // over the clean base PDF bytes so exportPdf applies them exactly once.
      } else if (result.newPdfBytes) {
        setActiveBytes(result.newPdfBytes);
        if (result.newFileName) {
          setActiveName(result.newFileName);
        }
        if (onApplyPdfBytes) {
          try {
            await onApplyPdfBytes(result.newPdfBytes, result.newFileName);
          } catch {}
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: "assistant",
          text: result.message,
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
          actionResult: result,
          canRollback: true,
        }
      ]);

      if (voiceEnabled || result.metadata?.voiceState === 'on') {
        speakText(result.message);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: "assistant",
          text: `İşlem gerçekleştirilirken bir hata oluştu: ${err?.message || "Bilinmeyen hata"}`,
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
    } finally {
      setIsProcessing(false);
      setProgressText(null);
    }
  };

  const handleRollback = async () => {
    if (lastExecutedAction?.newMarks && lastExecutedAction?.newRemovals && onRollbackMarksAndRemovals) {
      onRollbackMarksAndRemovals(lastExecutedAction.newMarks, lastExecutedAction.newRemovals);
      setLastExecutedAction(null);
      toast.success("Önceki duruma başarıyla geri dönüldü!");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: `↩️ **Geri Alındı:** Yapılan metin değişikliği çalışma alanından kaldırıldı. Orijinal belgeniz korundu. ✨`,
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
      return;
    }
    if (historyStack.length === 0) {
      toast.info("Geri alınacak önceki bir sürüm bulunamadı.");
      return;
    }
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setActiveBytes(previous.bytes);
    setActiveName(previous.name);
    if (onApplyPdfBytes) {
      try {
        await onApplyPdfBytes(previous.bytes, previous.name);
      } catch {}
    }
    toast.success("Önceki duruma başarıyla geri dönüldü!");
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sender: "assistant",
        text: `↩️ **Geri Alındı:** Belgeniz yapılan son değişiklikten önceki orijinal haline döndürüldü. Başka bir düzeltme veya işlem isterseniz hemen söyleyebilirsiniz. ✨`,
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      }
    ]);
  };

  const handleCorrection = async (feedbackType?: string) => {
    if (!lastExecutedAction) {
      toast.info("Düzeltilecek aktif bir işlem bulunamadı. Lütfen yapmak istediğiniz işlemi söyleyin.");
      return;
    }

    if (feedbackType === 'more_enhance' || lastExecutedAction.action === 'enhance_document' || lastExecutedAction.action === 'enhance_selective') {
      const adjustedIntent = {
        ...lastExecutedAction,
        parameters: {
          ...lastExecutedAction.parameters,
          enhanceMode: 'document',
        }
      };
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "user",
          text: "Daha fazla netleştir ve kontrastı artır.",
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
      await executeConfirmedAction(adjustedIntent);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sender: "assistant",
        text: `🛠️ **Hata Düzeltme Modu**: Lütfen düzeltmek istediğiniz kısmı belirtin (örneğin: *"arka plan çok koyu oldu"*, *"filigranın sol kısmı kaldı"*, *"yazı çok kalınlaştı"*). Dilerseniz **Geri Al** butonuyla hemen eski haline dönebilirsiniz.`,
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        canRollback: historyStack.length > 0,
      }
    ]);
  };

  const processAndLoadFile = async (file: File) => {
    setIsProcessing(true);
    setProgressText(`${file.name} inceleniyor ve PDF formatına hazırlanıyor...`);

    try {
      const buf = await file.arrayBuffer();
      let convertedPdfBytes: Uint8Array;
      const baseName = file.name.replace(/\.[^/.]+$/, "");

      if (/\.pdf$/i.test(file.name)) {
        convertedPdfBytes = new Uint8Array(buf);
      } else if (/\.(docx|doc)$/i.test(file.name)) {
        setProgressText("Word belgesi PDF sayfalarına dönüştürülüyor...");
        const { docxToPdf } = await import("../conversion/docxConverter.ts");
        convertedPdfBytes = await docxToPdf(new Uint8Array(buf), { title: baseName });
      } else if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        setProgressText("Excel tablosu PDF sayfalarına dönüştürülüyor...");
        const { excelToPdf } = await import("../conversion/excelToPdf.ts");
        convertedPdfBytes = await excelToPdf(new Uint8Array(buf), { title: baseName, orientation: "auto" });
      } else if (/\.(png|jpe?g|webp|jfif|bmp)$/i.test(file.name)) {
        setProgressText("Görsel taranıyor ve yüksek kaliteli PDF'e dönüştürülüyor...");
        const { imagesToPdf } = await import("../conversion/conversionEngine.ts");
        const isPng = /\.png$/i.test(file.name);
        convertedPdfBytes = await imagesToPdf(
          [{ name: file.name, bytes: new Uint8Array(buf), type: isPng ? "png" : "jpeg" }],
          { pageSize: "A4", orientation: "auto", margin: 15 }
        );
      } else if (/\.txt$/i.test(file.name)) {
        const textContent = new TextDecoder().decode(buf);
        const { PDFDocument, StandardFonts } = await import("pdf-lib");
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const lines = textContent.split(/\r?\n/);
        let page = doc.addPage([595, 842]);
        let y = 800;
        for (const line of lines) {
          if (y < 40) {
            page = doc.addPage([595, 842]);
            y = 800;
          }
          const cleanLine = line.slice(0, 90).replace(/[^\x20-\x7E]/g, " ");
          page.drawText(cleanLine, { x: 40, y, size: 10, font });
          y -= 14;
        }
        convertedPdfBytes = await doc.save();
      } else {
        toast.error("Desteklenmeyen dosya formatı. (PDF, JPG, PNG, Excel, Word veya TXT seçin)");
        setIsProcessing(false);
        setProgressText(null);
        return;
      }

      if (activeBytes) {
        setHistoryStack((prev) => [...prev.slice(-9), { bytes: activeBytes, name: activeName }]);
      }

      const targetFileName = `${baseName}.pdf`;
      setActiveBytes(convertedPdfBytes);
      setActiveName(targetFileName);

      const pdfFile = new File([convertedPdfBytes as unknown as BlobPart], targetFileName, { type: "application/pdf" });

      if (onOpenDocument) {
        try {
          await onOpenDocument([pdfFile]);
        } catch {}
      } else if (onApplyPdfBytes) {
        try {
          await onApplyPdfBytes(convertedPdfBytes, targetFileName);
        } catch {}
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: `📄 **${file.name}** başarıyla yüklendi ve işleme hazırlandı! 🎉\n\nŞimdi ne yapmamı istersin? İster sesli söyle, ister yaz:\n• *"Belgenin yapısını ve metnini özetle"*\n• *"Seçili görseli sil"*\n• *"Seçili görseli netleştir"*\n• *"Bu belgedeki filigranı kaldır"*\n• *"Word'e / Excel'e çevir"*\n• *"Koyu mod yap"*`,
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
      toast.success(`${file.name} başarıyla açıldı!`);
    } catch (err: any) {
      toast.error(`Dosya yüklenemedi: ${err?.message || "Bilinmeyen hata"}`);
    } finally {
      setIsProcessing(false);
      setProgressText(null);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || inputText).trim();
    if (!promptToSend || isProcessing) return;

    const userMsgId = crypto.randomUUID();
    const timeStr = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: "user",
        text: promptToSend,
        timestamp: timeStr,
      }
    ]);

    setInputText("");

    // 1. Natural Language Intent Parsing
    const intent = parseUserIntent(promptToSend);

    // 2. Intercept Confirm Action ("evet", "onayla", "yap")
    if (intent.action === 'confirm_action') {
      if (pendingPlan) {
        await executeConfirmedAction(pendingPlan.intent);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: "Şu an onay bekleyen bir işlem bulunmuyor. Yapmak istediğiniz işlemi söyleyebilirsiniz (örneğin: *'aslanı sil'*, *'filigranı kaldır'*). ✨",
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
      return;
    }

    // 3. Intercept Cancel Action ("vazgeç", "hayır", "iptal")
    if (intent.action === 'cancel_action') {
      setPendingPlan(null);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: "İşlem onaylanmadı ve iptal edildi. Başka nasıl yardımcı olabilirim? ✨",
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
      return;
    }

    // 4. Intercept Undo Action ("geri al", "eski haline getir")
    if (intent.action === 'undo_action') {
      await handleRollback();
      return;
    }

    // 5. Intercept Correction Request ("şurada hata var", "düzelt", "olmadı")
    if (intent.action === 'correction_request') {
      await handleCorrection();
      return;
    }

    // 6. Check if this is a modifying action that needs Preview & Confirmation
    const plan = buildActionPlan(intent, activeName, currentPage);
    if (plan) {
      if (!activeBytes && !intent.action.startsWith('theme_')) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: "assistant",
            text: `⚠️ **${plan.title}** işlemini uygulayabilmek için önce bir belge veya görsel yüklemelisiniz.\n\nAşağıdaki ataş butonuna basarak veya pencereye sürükleyerek **PDF, JPG, PNG, Excel, Word** dosyası yükleyebilirsiniz. 📎`,
            timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
          }
        ]);
        return;
      }

      setPendingPlan(plan);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: `📌 **İşlem Önizlemesi & Onay İsteği:**\n\n**${plan.title}**\n${plan.description}\n\n👉 Onaylıyorsanız aşağıdaki **"Onayla ve Uygula"** butonuna tıklayın veya *"evet / onayla"* yazın.`,
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
          plan,
        }
      ]);
      return;
    }

    // 7. Non-modifying action (e.g. Vision QA, Voice Toggle, General Help) -> execute immediately
    await executeConfirmedAction(intent);
  };

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void processAndLoadFile(file);
        }}
      />

      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`forma-ai-trigger fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-medium shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 group border border-white/20 backdrop-blur-sm ${className}`}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            top: "auto",
            left: "auto",
            zIndex: 99999,
          }}
          aria-label="Forma AI Asistanını Aç"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-300 group-hover:rotate-12 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <span className="text-sm font-semibold tracking-wide pr-1">Forma AI</span>
          <span className="hidden sm:inline-block text-[11px] bg-white/20 px-2 py-0.5 rounded-full text-violet-100 font-normal">
            Asistan
          </span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) void processAndLoadFile(droppedFile);
          }}
          className="forma-ai-modal fixed bottom-6 right-6 z-[9999] w-[420px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-48px)] rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            top: "auto",
            left: "auto",
            zIndex: 99999,
            width: "420px",
            maxWidth: "calc(100vw - 32px)",
            height: "560px",
            maxHeight: "calc(100vh - 48px)",
          }}
        >
          {/* Drag Overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-violet-600/90 text-white flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm animate-in fade-in duration-150">
              <UploadCloud className="w-12 h-12 mb-3 animate-bounce" />
              <h4 className="text-base font-bold">Dosyayı Buraya Bırakın</h4>
              <p className="text-xs text-violet-200 mt-1">
                PDF, Word (.docx), Excel (.xlsx), Resim (PNG, JPG) veya TXT dosyası kabul edilir.
              </p>
            </div>
          )}

          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70 backdrop-blur flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
                <Sparkles className="w-4 h-4 text-amber-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                    Forma AI
                  </h3>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[210px]">
                  {activeBytes ? `📄 ${activeName}` : "Cihazında %100 Yerel & Gizli"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleVoice}
                title={voiceEnabled ? "Sesli Yanıtı Kapat" : "Sesli Yanıtı Aç (Türkçe Konuşma)"}
                className={`p-1.5 rounded-lg transition-colors ${
                  voiceEnabled
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                }`}
                aria-label="Sesli Yanıt Aç/Kapat"
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Dosya Yükle (PDF, Word, Excel, Resim)"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  stopSpeaking();
                  setIsOpen(false);
                }}
                title="Kapat"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Document Pill if any */}
          {activeBytes && (
            <div className="px-4 py-1.5 bg-violet-500/10 border-b border-violet-500/20 flex items-center justify-between text-xs text-violet-700 dark:text-violet-300">
              <div className="flex items-center gap-1.5 truncate max-w-[280px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate font-medium">{activeName}</span>
                <span className="text-[10px] text-violet-400 dark:text-violet-400">
                  ({Math.round(activeBytes.byteLength / 1024)} KB)
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                Aktif Belge
              </span>
            </div>
          )}

          {/* Messages Container */}
          <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-2.5 ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-none shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200/60 dark:border-slate-700/60 shadow-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Pending Action Plan / Preview Card */}
                  {msg.plan && (
                    <div className="mt-2.5 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-xs shadow-sm space-y-2">
                      <div className="flex items-center gap-2 font-bold text-violet-800 dark:text-violet-200">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>{msg.plan.title}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                        {msg.plan.description}
                      </p>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                        <span>Hedef: <strong>{msg.plan.targetDetails}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => executeConfirmedAction(msg.plan!.intent)}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-sm transition-all text-[11px] active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Onayla ve Uygula</span>
                        </button>
                        <button
                          onClick={() => {
                            setPendingPlan(null);
                            setMessages((prev) => [
                              ...prev,
                              {
                                id: crypto.randomUUID(),
                                sender: "assistant",
                                text: "İşlem onaylanmadı ve iptal edildi. Başka bir şey yapmak isterseniz hemen söyleyebilirsiniz. ✨",
                                timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
                              }
                            ]);
                          }}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-[11px] transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Vazgeç</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Unsupported Font Characters Warning Card */}
                  {msg.actionResult?.stoppedDueToUnsupportedChars && (
                    <div className="mt-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs shadow-sm space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Yazı Tipi Karakter Uyarısı</span>
                      </div>
                      <p className="text-[11px] text-amber-900 dark:text-amber-300">
                        Hedef metin, belgenin orijinal yazı tipinde bulunmayan karakterler içermektedir. Belge orijinalliğini korumak için işlem durduruldu.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            if (msg.actionResult?.metadata?.searchTerm && msg.actionResult?.metadata?.replaceTerm) {
                              executeConfirmedAction({
                                action: "find_replace",
                                parameters: {
                                  searchTerm: msg.actionResult.metadata.searchTerm,
                                  replaceTerm: msg.actionResult.metadata.replaceTerm,
                                  allowApproximateFont: true,
                                },
                                confirmedCandidateIds: ['allow_approximate']
                              });
                            }
                          }}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium shadow-sm transition-all text-[11px] active:scale-95 disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Yaklaşık Yazı Tipi İle Uygula</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Watermark Candidate Confirmation Card */}
                  {msg.actionResult?.metadata?.pendingConfirmation && msg.actionResult.metadata.candidates && (
                    <div className="mt-2.5 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-xs shadow-sm space-y-2.5">
                      <div className="flex items-center gap-1.5 font-bold text-violet-800 dark:text-violet-200">
                        <Sparkles className="w-4 h-4 text-violet-600" />
                        <span>Filigran Adayları (Kaldırmak İstediklerinizi Seçin)</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {msg.actionResult.metadata.candidates.map((cand: any) => {
                          const currentSelected = selectedWatermarkCandidateIds[msg.id] ?? msg.actionResult!.metadata!.candidates.map((c: any) => c.id);
                          const isChecked = currentSelected.includes(cand.id);
                          return (
                            <label
                              key={cand.id}
                              className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-violet-300 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...currentSelected, cand.id]
                                    : currentSelected.filter((id: string) => id !== cand.id);
                                  setSelectedWatermarkCandidateIds((prev) => ({ ...prev, [msg.id]: next }));
                                }}
                                className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {cand.text || "Görsel / Damga Nesnesi"}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>Sayfa: {cand.pages ? cand.pages.map((p: number) => p + 1).join(", ") : "1"}</span>
                                  <span>Güven: %{cand.confidence}</span>
                                  {cand.reason && <span className="truncate">({cand.reason})</span>}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            const currentSelected = selectedWatermarkCandidateIds[msg.id] ?? msg.actionResult!.metadata!.candidates.map((c: any) => c.id);
                            if (currentSelected.length === 0) {
                              toast.error("Lütfen temizlemek için en az bir filigran adayı seçin.");
                              return;
                            }
                            executeConfirmedAction({
                              action: "watermark_remove",
                              confirmedCandidateIds: currentSelected,
                            });
                          }}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-sm transition-all text-[11px] active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Seçilen Filigranları Temizle</span>
                        </button>
                        <button
                          onClick={() => {
                            setMessages((prev) => [
                              ...prev,
                              {
                                id: crypto.randomUUID(),
                                sender: "assistant",
                                text: "Filigran temizleme işlemi iptal edildi. Belgenizde hiçbir değişiklik yapılmadı. ✨",
                                timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
                              }
                            ]);
                          }}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-[11px] transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Vazgeç</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Result Action Card with Correction Loop */}
                  {msg.actionResult && (
                    <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {/* Direct Download Button */}
                        {msg.actionResult.downloadData ? (
                          <button
                            onClick={() =>
                              handleDownload(
                                msg.actionResult!.downloadData!.bytes,
                                msg.actionResult!.downloadData!.fileName,
                                msg.actionResult!.downloadData!.mimeType
                              )
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] shadow-sm transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{msg.actionResult.downloadData.fileName} İndir</span>
                          </button>
                        ) : msg.actionResult.newPdfBytes ? (
                          <button
                            onClick={() =>
                              handleDownload(
                                msg.actionResult!.newPdfBytes!,
                                msg.actionResult!.newFileName || "Forma_Sonuc.pdf"
                              )
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] shadow-sm transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF Olarak İndir</span>
                          </button>
                        ) : null}

                        {/* Open in Workspace */}
                        {msg.actionResult.newPdfBytes && (
                          <button
                            onClick={() =>
                              handleOpenInWorkspace(
                                msg.actionResult!.newPdfBytes!,
                                msg.actionResult!.newFileName || activeName
                              )
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium text-[11px] shadow-sm transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Düzenleyicide Aç</span>
                          </button>
                        )}
                      </div>

                      {/* Hata Düzeltme & Geri Bildirim Butonları */}
                      {msg.actionResult.success && msg.actionResult.newPdfBytes && (
                        <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1.5">
                            Hata veya beğenmediğiniz bir yer var mı?
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={handleRollback}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-[10px] font-medium transition-all"
                              title="Yapılan işlemi geri alıp orijinal haline dön"
                            >
                              <RotateCcw className="w-3 h-3 text-rose-500" />
                              <span>Geri Al (Eski Hali)</span>
                            </button>
                            <button
                              onClick={() => handleCorrection('more_enhance')}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-violet-50 dark:hover:bg-violet-950/30 text-slate-600 dark:text-slate-300 hover:text-violet-600 text-[10px] font-medium transition-all"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>Daha Fazla Netleştir</span>
                            </button>
                            <button
                              onClick={() => handleCorrection()}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 text-[10px] font-medium transition-all"
                            >
                              <Wrench className="w-3 h-3 text-blue-500" />
                              <span>Hata Bildir / Düzelt</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    {msg.sender === "assistant" ? (
                      <button
                        onClick={() => speakText(msg.text)}
                        title="Sesli Dinle"
                        className="p-1 rounded text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors flex items-center gap-1 text-[10px]"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Dinle</span>
                      </button>
                    ) : <span />}

                    <div
                      className={`text-[9px] ${
                        msg.sender === "user" ? "text-violet-200" : "text-slate-400"
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="flex gap-2.5 items-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-violet-500 shrink-0" />
                <span>{progressText || "Forma AI işlemi gerçekleştiriyor..."}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {isListening && (
              <div className="mb-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-medium">Sizi dinliyorum... Şimdi Türkçe konuşabilirsiniz</span>
                </div>
                <button
                  type="button"
                  onClick={stopListening}
                  className="text-[11px] underline hover:text-rose-700"
                >
                  Tamamla
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isListening) stopListening();
                void handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                title="Dosya Yükle (PDF, JPG, PNG, Excel, Word, TXT)"
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-all shadow-sm shrink-0"
                aria-label="Dosya Ekle"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isListening ? "Konuşmanız yazılıyor..." : "Örn: Seçili görseli sil, belgenin yapısını özetle, netleştir..."}
                disabled={isProcessing}
                className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessing}
                title={isListening ? "Dinlemeyi Durdur" : "Sesle Söyle (Mikrofon)"}
                className={`p-2.5 rounded-xl transition-all shadow-sm ${
                  isListening
                    ? "bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/30 shadow-rose-500/40"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
                }`}
                aria-label="Mikrofon ile Sesli Komut"
              >
                {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                type="submit"
                disabled={!inputText.trim() || isProcessing}
                className="p-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-violet-500/20"
                aria-label="Gönder"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
