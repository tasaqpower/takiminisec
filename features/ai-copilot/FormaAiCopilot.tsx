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
} from "lucide-react";
import { parseUserIntent } from "./aiIntentEngine";
import type { AiActionResult } from "./aiActionDispatcher";
import { toast } from "sonner";

export interface FormaAiCopilotProps {
  pdfBytes?: Uint8Array | null;
  fileName?: string;
  currentPage?: number;
  onApplyPdfBytes?: (bytes: Uint8Array, newFileName?: string) => Promise<void> | void;
  onOpenDocument?: (files: File[]) => Promise<void> | void;
  className?: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  actionResult?: AiActionResult;
  isProcessing?: boolean;
}

export function FormaAiCopilot({
  pdfBytes,
  fileName,
  currentPage = 0,
  onApplyPdfBytes,
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
      text: "Merhaba! Ben **Forma AI**. Bana sesli konuşabilir veya yazabilirsiniz:\n\n• 👁️ *\"Görselde / belgede ne var?\"* (Görsel ve belge içeriği analizi)\n• 🗑️ *\"Aslanı sil\"* / *\"Resmi sil\"* / *\"Logoyu kaldır\"*\n• ✨ *\"Aslanı netleştir\"* / *\"Sadece fotoğrafı netleştir\"*\n• 🎙️ *\"Sesli yanıtı aç\"* / *\"Sesi kapat\"* (Mikrofon & sesli Türkçe konuşma)\n• 🌙 *\"Koyu mod yap\"* / ☀️ *\"Açık mod yap\"*\n• 🧹 *\"Filigranı kaldır\"* / 🔏 *\"Filigran ekle\"*\n• 🔒 *\"TC ve IBAN'ları sansürle (KVKK)\"*\n• 🗜️ *\"PDF'i sıkıştır\"*\n• 📝 *\"Word'e çevir\"* / 📊 *\"Excel'e aktar\"*\n• 🏷️ *\"ASLI GİBİDİR kaşesi bas\"*\n• 🔄 *\"Sayfaları 90 derece döndür\"* / 🗑️ *\"İlk/son sayfayı sil\"*",
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
      setTimeout(() => inputRef.current?.focus(), 150);
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

  const processAndLoadFile = async (file: File) => {
    setIsProcessing(true);
    setProgressText(`${file.name} taranıyor ve PDF formatına hazırlanıyor...`);

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
      } else if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
        setProgressText("Görsel sayfalanmış PDF'e dönüştürülüyor...");
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
        toast.error("Desteklenmeyen dosya formatı. (PDF, Word, Excel, Görsel veya TXT seçin)");
        setIsProcessing(false);
        setProgressText(null);
        return;
      }

      setActiveBytes(convertedPdfBytes);
      setActiveName(file.name);

      if (onApplyPdfBytes) {
        await onApplyPdfBytes(convertedPdfBytes, file.name);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: `📄 **${file.name}** başarıyla yüklendi ve işleme hazırlandı.\n\nŞimdi ne yapmamı istersin? Örneğin:\n• *"bu belgedeki filigranı kaldır"*\n• *"koyu mod yap"*\n• *"ASLI GİBİDİR kaşesi bas"*\n• *"yazıları netleştir"*\n• *"Word'e çevir"*\n• *"TC ve IBAN'ları sansürle"*`,
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
      toast.success(`${file.name} başarıyla yüklendi!`);
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
    setIsProcessing(true);
    setProgressText("İstek çözümleniyor...");

    const assistantMsgId = crypto.randomUUID();

    try {
      // 1. Natural Language Intent Parsing
      const intent = parseUserIntent(promptToSend);

      // 2. Dispatch Action
      const { dispatchAiAction } = await import("./aiActionDispatcher.ts");
      const result = await dispatchAiAction(
        intent,
        {
          pdfBytes: activeBytes,
          fileName: activeName,
          currentPage,
        },
        (prog) => setProgressText(prog)
      );

      // 3. Handle voice state changes if triggered by voice_toggle
      if (result.metadata?.voiceState === 'on') {
        setVoiceEnabled(true);
        if (typeof window !== 'undefined') localStorage.setItem('forma_ai_voice', 'true');
      } else if (result.metadata?.voiceState === 'off') {
        setVoiceEnabled(false);
        if (typeof window !== 'undefined') localStorage.setItem('forma_ai_voice', 'false');
        stopSpeaking();
      }

      // 4. If new PDF bytes returned, update active state & workspace
      if (result.newPdfBytes) {
        setActiveBytes(result.newPdfBytes);
        if (result.newFileName) {
          setActiveName(result.newFileName);
        }
        if (onApplyPdfBytes) {
          try {
            await onApplyPdfBytes(result.newPdfBytes, result.newFileName);
          } catch {
            // Workspace apply error logged
          }
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
        }
      ]);

      // 5. Read aloud if voice output is enabled
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
          className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-medium shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 group border border-white/20 backdrop-blur-sm ${className}`}
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
          className="fixed bottom-6 right-6 z-[9999] w-[420px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-48px)] rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
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

                  {/* Action Result Action Card */}
                  {msg.actionResult && (
                    <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-wrap gap-2">
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
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium text-[11px] shadow-sm transition-all"
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
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium text-[11px] shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF Olarak İndir</span>
                        </button>
                      ) : null}

                      {/* Open in Workspace or Apply to Workspace */}
                      {msg.actionResult.newPdfBytes && (
                        <button
                          onClick={() =>
                            handleOpenInWorkspace(
                              msg.actionResult!.newPdfBytes!,
                              msg.actionResult!.newFileName || activeName
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] shadow-sm transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Düzenleyicide Aç</span>
                        </button>
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
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isListening ? "Konuşmanız yazılıyor..." : "Örn: Aslanı sil, görselde ne var, netleştir..."}
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
