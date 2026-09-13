"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  X,
  Download,
  ExternalLink,
  Loader2,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCw,
  Moon,
  Sun,
  Shield,
  FileSpreadsheet,
  FileType,
  Stamp,
  RefreshCw,
  HelpCircle,
  Bot
} from "lucide-react";
import { parseUserIntent, type AiActionType } from "./aiIntentEngine";
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

const QUICK_ACTIONS = [
  { label: "Koyu mod yap", prompt: "koyu mod yap", icon: Moon, color: "text-indigo-400" },
  { label: "Açık mod yap", prompt: "açık mod yap", icon: Sun, color: "text-amber-400" },
  { label: "Filigranı kaldır", prompt: "bu belgedeki filigranı ve taslak damgalarını kaldır", icon: RefreshCw, color: "text-cyan-400" },
  { label: "Yazıları netleştir", prompt: "taranmış belgedeki soluk yazıları netleştir ve arka planı beyazlat", icon: Sparkles, color: "text-rose-400" },
  { label: "TC & IBAN sansürle", prompt: "belgedeki TC kimlik ve IBAN numaralarını KVKK kapsamında sansürle", icon: Shield, color: "text-emerald-400" },
  { label: "PDF sıkıştır", prompt: "PDF dosyasını kaliteyi koruyarak sıkıştır", icon: FileText, color: "text-blue-400" },
  { label: "Word'e çevir", prompt: "bu PDF belgesini düzenlenebilir Word (.docx) formatına çevir", icon: FileType, color: "text-sky-400" },
  { label: "Excel'e aktar", prompt: "belgedeki tabloları Excel tablosuna (.xlsx) aktar", icon: FileSpreadsheet, color: "text-teal-400" },
  { label: "Aslı gibidir kaşesi", prompt: "belgeye resmi ASLI GİBİDİR kaşesi bas", icon: Stamp, color: "text-red-400" },
  { label: "Sayfaları 90° döndür", prompt: "sayfaları saat yönünde 90 derece döndür", icon: RotateCw, color: "text-purple-400" },
];

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

  useEffect(() => {
    setMounted(true);
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "Merhaba! Ben **Forma AI Belge Asistanı**. Doğal dille söylediğin her komutu doğrudan belgende uygulayabilirim.\n\nNeler yapmamı istersin?",
      timestamp: "Forma AI",
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
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
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      toast.error("Lütfen geçerli bir PDF dosyası seçin.");
      return;
    }

    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      setActiveBytes(bytes);
      setActiveName(file.name);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: `📄 **${file.name}** yüklendi ve incelendi. Şimdi ne yapmak istersin? Filigran kaldırabilir, netleştirebilir, sansürleyebilir veya Word'e çevirebilirim.`,
          timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
      toast.success(`${file.name} yapay zekaya yüklendi.`);
    } catch {
      toast.error("Dosya okunurken bir hata oluştu.");
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
      const { dispatchAiAction } = await import("./aiActionDispatcher");
      const result = await dispatchAiAction(
        intent,
        {
          pdfBytes: activeBytes,
          fileName: activeName,
          currentPage,
        },
        (prog) => setProgressText(prog)
      );

      // 3. If new PDF bytes returned, update active state & workspace
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

  if (!mounted) return null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-medium shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 group border border-white/20 backdrop-blur-sm ${className}`}
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
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-32px)] h-[590px] max-h-[calc(100vh-64px)] rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-5 duration-200 text-slate-800 dark:text-slate-100">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70 backdrop-blur flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
                <Sparkles className="w-4 h-4 text-amber-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                    Forma AI Belge Asistanı
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
                onClick={() => fileInputRef.current?.click()}
                title="Yeni PDF Yükle"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
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
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
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

                  <div
                    className={`text-[9px] text-right ${
                      msg.sender === "user" ? "text-violet-200" : "text-slate-400"
                    }`}
                  >
                    {msg.timestamp}
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

          {/* Quick Action Chips Carousel */}
          <div className="px-3 py-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 overflow-x-auto flex gap-1.5 no-scrollbar">
            {QUICK_ACTIONS.map((qa, i) => (
              <button
                key={i}
                type="button"
                onClick={() => void handleSendMessage(qa.prompt)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70 hover:border-violet-500/50 hover:bg-violet-500/5 dark:hover:bg-violet-500/10 text-[11px] font-medium text-slate-700 dark:text-slate-300 shrink-0 transition-all active:scale-95 disabled:opacity-50"
              >
                <qa.icon className={`w-3.5 h-3.5 ${qa.color}`} />
                <span>{qa.label}</span>
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Örn: Filigranı kaldır, koyu mod yap..."
                disabled={isProcessing}
                className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
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
    </>
  );
}
