"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Eraser,
  ScanText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Type,
  Layers,
  Bot,
  Zap,
  Key,
  ExternalLink,
  Target,
  RefreshCw,
  Paintbrush,
  Square,
  Undo2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Palette
} from "lucide-react";
import { toast } from "sonner";
import { detectWatermarks } from "./watermarkDetector";
import { removeWatermarks } from "./watermarkRemover";
import {
  renderPdfPageToDataUrl,
  detectWatermarksWithGemini,
  convertAiDetectionToCandidate,
  type AiDetectedWatermark
} from "./aiWatermarkService";
import {
  detectVisualWatermarks,
  renderPdfPageToCanvas,
  detectPageBackgroundColor
} from "./visualWatermarkDetector";
import type { WatermarkCandidate, WatermarkRemovalOptions, WatermarkBox } from "./watermarkTypes";

interface WatermarkRemovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBytes?: Uint8Array | null;
  fileName?: string;
  currentPage: number;
  totalPages: number;
  onApplyRemoval: (modifiedBytes: Uint8Array, count: number) => void;
}

const QUICK_KEYWORDS = [
  "GEÇERSİZ",
  "ÖRNEK BELGEDİR",
  "TASLAK",
  "KOPYA",
  "DRAFT",
  "CamScanner",
  "SAMPLE",
  "CONFIDENTIAL",
  "GİZLİ",
  "İPTAL"
];

export function WatermarkRemovalModal({
  open,
  onOpenChange,
  pdfBytes,
  fileName = "belge.pdf",
  currentPage = 1,
  totalPages = 1,
  onApplyRemoval
}: WatermarkRemovalModalProps) {
  // Navigation & Page State
  const [activePage, setActivePage] = useState<number>(currentPage);
  const [candidates, setCandidates] = useState<WatermarkCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState("");
  const [customCaseSensitive, setCustomCaseSensitive] = useState(false);
  const [pageScope, setPageScope] = useState<"all" | "current" | "custom">("all");
  const [customPagesStr, setCustomPagesStr] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isAutoCleaning, setIsAutoCleaning] = useState(false);
  const [activeTab, setActiveTab] = useState<"auto" | "visual" | "ai" | "custom">("visual");

  // Gemini API Key management
  const [apiKey, setApiKey] = useState("");
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiDetectedList, setAiDetectedList] = useState<AiDetectedWatermark[]>([]);

  // Visual Tab: Canvas & Multi-Box & Brush State
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const brushCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewPageSize, setPreviewPageSize] = useState<{ width: number; height: number; scale: number } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Tools: "box" | "brush"
  const [activeTool, setActiveTool] = useState<"box" | "brush">("box");
  const [brushSize, setBrushSize] = useState<number>(24);
  const [hasBrushStrokes, setHasBrushStrokes] = useState<boolean>(false);
  const isBrushingRef = useRef<boolean>(false);

  // Multi-box selection
  const [manualBoxes, setManualBoxes] = useState<WatermarkBox[]>([]);
  const [activeDrawingBox, setActiveDrawingBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const isDrawingBoxRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  // Background Paper Color Tone Matching
  const [detectedPaperColor, setDetectedPaperColor] = useState<{ r: number; g: number; b: number; hex: string }>({
    r: 1,
    g: 1,
    b: 1,
    hex: "#ffffff"
  });
  const [paperColorMode, setPaperColorMode] = useState<"auto" | "white" | "custom">("auto");
  const [customColorHex, setCustomColorHex] = useState<string>("#ffffff");

  const userSwitchedTabRef = useRef(false);

  // Sync activePage with prop when modal opens
  useEffect(() => {
    if (open) {
      setActivePage(currentPage);
    }
  }, [open, currentPage]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("forma_gemini_api_key") || "";
      setApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    if (typeof window !== "undefined") {
      if (trimmed) {
        localStorage.setItem("forma_gemini_api_key", trimmed);
        toast.success("Gemini API Anahtarı kaydedildi!");
      } else {
        localStorage.removeItem("forma_gemini_api_key");
        toast.info("Gemini API Anahtarı kaldırıldı.");
      }
    }
  };

  const switchTab = (tab: "auto" | "visual" | "ai" | "custom") => {
    userSwitchedTabRef.current = true;
    setActiveTab(tab);
  };

  // Run auto-detection when modal opens
  useEffect(() => {
    if (!open || !pdfBytes) {
      userSwitchedTabRef.current = false;
      setCandidates([]);
      setSelectedIds(new Set());
      setAiDetectedList([]);
      setManualBoxes([]);
      setHasBrushStrokes(false);
      return;
    }

    let active = true;
    setIsScanning(true);

    detectWatermarks(pdfBytes)
      .then(async (detected) => {
        if (!active) return;

        let finalCandidates = [...detected];

        // If vector detection found nothing, attempt local Visual OCR on active page
        if (finalCandidates.length === 0) {
          try {
            const vis = await detectVisualWatermarks(pdfBytes, activePage - 1);
            if (active && vis.length > 0) {
              finalCandidates = vis;
            }
          } catch (err) {
            console.warn("Visual OCR auto-detection error:", err);
          }
        }

        if (!active) return;
        setCandidates(finalCandidates);

        // Pre-select high confidence candidates
        const highConf = new Set(finalCandidates.filter((c) => c.confidence >= 50).map((c) => c.id));

        if (!userSwitchedTabRef.current) {
          if (highConf.size > 0) {
            setSelectedIds(highConf);
            setActiveTab("auto");
          } else if (finalCandidates.length > 0) {
            setSelectedIds(new Set([finalCandidates[0].id]));
            setActiveTab("auto");
          } else {
            // Default to visual area selection
            setActiveTab("visual");
          }
        } else {
          if (highConf.size > 0) {
            setSelectedIds(highConf);
          } else if (finalCandidates.length > 0) {
            setSelectedIds(new Set([finalCandidates[0].id]));
          }
        }
      })
      .catch((err) => {
        console.error("Watermark detection error:", err);
      })
      .finally(() => {
        if (active) setIsScanning(false);
      });

    return () => {
      active = false;
    };
  }, [open, pdfBytes, activePage]);

  // Load interactive page preview canvas for "Sayfada İşaretle ve Sil"
  useEffect(() => {
    if (!open || !pdfBytes || activeTab !== "visual") return;

    let active = true;
    setIsPreviewLoading(true);

    renderPdfPageToCanvas(pdfBytes, activePage - 1, 1.25)
      .then(({ canvas, pageWidth, pageHeight }) => {
        if (!active) return;

        // Automatically detect paper background tone from margin pixels
        const detectedColor = detectPageBackgroundColor(canvas);
        setDetectedPaperColor(detectedColor);

        // Draw preview
        if (previewCanvasRef.current) {
          const target = previewCanvasRef.current;
          target.width = canvas.width;
          target.height = canvas.height;
          const ctx = target.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, 0);
          }
        }

        // Setup brush overlay canvas with matching dimensions
        if (brushCanvasRef.current) {
          const bTarget = brushCanvasRef.current;
          bTarget.width = canvas.width;
          bTarget.height = canvas.height;
          const bCtx = bTarget.getContext("2d");
          if (bCtx) {
            bCtx.clearRect(0, 0, bTarget.width, bTarget.height);
          }
          setHasBrushStrokes(false);
        }

        setPreviewPageSize({
          width: pageWidth,
          height: pageHeight,
          scale: canvas.width / pageWidth
        });
      })
      .catch((err) => {
        console.error("Preview canvas render error:", err);
      })
      .finally(() => {
        if (active) setIsPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, pdfBytes, activePage, activeTab]);

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCandidates = () => {
    setSelectedIds(new Set(candidates.map((c) => c.id)));
  };

  const deselectAllCandidates = () => {
    setSelectedIds(new Set());
  };

  const parseCustomPages = (str: string, maxPages: number): number[] => {
    const pages = new Set<number>();
    const parts = str.split(/[,;\s]+/);
    for (const part of parts) {
      if (!part) continue;
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
            if (p >= 1 && p <= maxPages) pages.add(p - 1);
          }
        }
      } else {
        const p = Number(part);
        if (!isNaN(p) && p >= 1 && p <= maxPages) {
          pages.add(p - 1);
        }
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  // Get effective fill color based on paper color mode
  const getEffectiveFillColor = (): { r: number; g: number; b: number; hex: string } => {
    if (paperColorMode === "white") {
      return { r: 1, g: 1, b: 1, hex: "#ffffff" };
    }
    if (paperColorMode === "custom") {
      const clean = customColorHex.replace("#", "");
      const r = parseInt(clean.substring(0, 2) || "ff", 16) / 255;
      const g = parseInt(clean.substring(2, 4) || "ff", 16) / 255;
      const b = parseInt(clean.substring(4, 6) || "ff", 16) / 255;
      return { r, g, b, hex: customColorHex };
    }
    return detectedPaperColor;
  };

  // --- MULTI-BOX PRESETS & HANDLERS ---
  const addPresetBox = (type: "center" | "header" | "footer") => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    let newBox: WatermarkBox;
    const boxId = "box-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);

    if (type === "center") {
      const bw = Math.round(w * 0.76);
      const bh = Math.round(h * 0.35);
      newBox = {
        id: boxId,
        x: Math.round((w - bw) / 2),
        y: Math.round((h - bh) / 2),
        w: bw,
        h: bh,
        label: "Orta Filigran",
        page: activePage - 1
      };
    } else if (type === "header") {
      const bw = Math.round(w * 0.85);
      const bh = Math.round(h * 0.12);
      newBox = {
        id: boxId,
        x: Math.round((w - bw) / 2),
        y: Math.round(h * 0.03),
        w: bw,
        h: bh,
        label: "Üst Başlık (Header)",
        page: activePage - 1
      };
    } else {
      const bw = Math.round(w * 0.85);
      const bh = Math.round(h * 0.12);
      newBox = {
        id: boxId,
        x: Math.round((w - bw) / 2),
        y: Math.round(h * 0.85),
        w: bw,
        h: bh,
        label: "Alt Bilgi (Footer)",
        page: activePage - 1
      };
    }

    setManualBoxes((prev) => [...prev, newBox]);
    toast.success(`${newBox.label} kutusu eklendi.`);
  };

  const removeBox = (id: string) => {
    setManualBoxes((prev) => prev.filter((b) => b.id !== id));
  };

  const clearAllBoxes = () => {
    setManualBoxes([]);
    setActiveDrawingBox(null);
  };

  // --- CANVAS MOUSE / TOUCH EVENTS (BOX DRAWING & BRUSH) ---
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = brushCanvasRef.current || previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    if (activeTool === "brush") {
      const bCanvas = brushCanvasRef.current;
      if (!bCanvas) return;
      const ctx = bCanvas.getContext("2d");
      if (!ctx) return;

      isBrushingRef.current = true;
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
      setHasBrushStrokes(true);
    } else {
      // Box drawing
      isDrawingBoxRef.current = true;
      startPosRef.current = { x, y };
      setActiveDrawingBox({ x, y, w: 0, h: 0 });
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    if (activeTool === "brush" && isBrushingRef.current) {
      const bCanvas = brushCanvasRef.current;
      if (!bCanvas) return;
      const ctx = bCanvas.getContext("2d");
      if (!ctx) return;

      ctx.lineTo(x, y);
      ctx.stroke();
      setHasBrushStrokes(true);
    } else if (activeTool === "box" && isDrawingBoxRef.current && startPosRef.current) {
      const sx = startPosRef.current.x;
      const sy = startPosRef.current.y;
      const bx = Math.min(sx, x);
      const by = Math.min(sy, y);
      const bw = Math.abs(x - sx);
      const bh = Math.abs(y - sy);
      setActiveDrawingBox({ x: bx, y: by, w: bw, h: bh });
    }
  };

  const handlePointerUp = () => {
    if (activeTool === "brush") {
      isBrushingRef.current = false;
      const bCanvas = brushCanvasRef.current;
      if (bCanvas) {
        const ctx = bCanvas.getContext("2d");
        if (ctx) ctx.closePath();
      }
    } else if (activeTool === "box" && isDrawingBoxRef.current && activeDrawingBox) {
      isDrawingBoxRef.current = false;
      if (activeDrawingBox.w > 15 && activeDrawingBox.h > 15) {
        const newBox: WatermarkBox = {
          id: "box-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
          x: Math.round(activeDrawingBox.x),
          y: Math.round(activeDrawingBox.y),
          w: Math.round(activeDrawingBox.w),
          h: Math.round(activeDrawingBox.h),
          label: `Kutu ${manualBoxes.length + 1}`,
          page: activePage - 1
        };
        setManualBoxes((prev) => [...prev, newBox]);
      }
      setActiveDrawingBox(null);
      startPosRef.current = null;
    }
  };

  const clearBrushStrokes = () => {
    const bCanvas = brushCanvasRef.current;
    if (!bCanvas) return;
    const ctx = bCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, bCanvas.width, bCanvas.height);
    }
    setHasBrushStrokes(false);
    toast.info("Fırça temizlendi.");
  };

  // Export brush canvas mask to a PNG data URL where painted pixels are effectiveFillColor
  const exportBrushMaskDataUrl = (): string | undefined => {
    if (!hasBrushStrokes || !brushCanvasRef.current) return undefined;
    const bCanvas = brushCanvasRef.current;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = bCanvas.width;
    exportCanvas.height = bCanvas.height;
    const expCtx = exportCanvas.getContext("2d");
    if (!expCtx) return undefined;

    const bCtx = bCanvas.getContext("2d");
    if (!bCtx) return undefined;

    const imgData = bCtx.getImageData(0, 0, bCanvas.width, bCanvas.height);
    const data = imgData.data;
    const eff = getEffectiveFillColor();
    const targetR = Math.round(eff.r * 255);
    const targetG = Math.round(eff.g * 255);
    const targetB = Math.round(eff.b * 255);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 20) {
        data[i] = targetR;
        data[i + 1] = targetG;
        data[i + 2] = targetB;
        data[i + 3] = 255;
      } else {
        data[i + 3] = 0;
      }
    }

    expCtx.putImageData(imgData, 0, 0);
    return exportCanvas.toDataURL("image/png");
  };

  // Apply Visual Selections (Manual Boxes + Magic Brush Mask)
  const handleApplyVisualSelections = async () => {
    if (!pdfBytes || !previewPageSize || !previewCanvasRef.current) {
      toast.error("Lütfen önce belgenin yüklenmesini bekleyin.");
      return;
    }

    const hasBoxes = manualBoxes.length > 0;
    const brushMask = exportBrushMaskDataUrl();

    if (!hasBoxes && !brushMask) {
      toast.error("Lütfen sayfada en az bir kutu çizin veya sihirli fırça ile filigranı boyayın.");
      return;
    }

    setIsApplying(true);
    const toastId = toast.loading("Seçilen alanlar kusursuzca siliniyor...");

    try {
      const canvas = previewCanvasRef.current;
      const canvasW = canvas.width;
      const canvasH = canvas.height;
      const scaleX = previewPageSize.width / canvasW;
      const scaleY = previewPageSize.height / canvasH;

      // Convert manual boxes to PDF coordinates (PDF origin is bottom-left)
      const pdfBoxes: WatermarkBox[] = manualBoxes.map((b) => ({
        id: b.id,
        x: Math.max(0, b.x * scaleX),
        y: Math.max(0, previewPageSize.height - (b.y + b.h) * scaleY),
        w: Math.min(previewPageSize.width, b.w * scaleX),
        h: Math.min(previewPageSize.height, b.h * scaleY),
        label: b.label,
        page: activePage - 1
      }));

      const eff = getEffectiveFillColor();
      const options: WatermarkRemovalOptions = {
        candidateIds: [],
        pageScope,
        customPages: pageScope === "custom" ? parseCustomPages(customPagesStr, totalPages) : undefined,
        currentPage: activePage - 1,
        fillColor: { r: eff.r, g: eff.g, b: eff.b },
        manualBoxes: pdfBoxes,
        brushMaskDataUrl: brushMask
      };

      const result = await removeWatermarks(pdfBytes, [], options);

      if (result.totalRemoved > 0) {
        onApplyRemoval(result.pdfBytes, result.totalRemoved);
        onOpenChange(false);
        toast.success(`✨ ${result.totalRemoved} alan başarıyla silindi ve kağıt tonuyla eşitlendi!`, { id: toastId });
      } else {
        toast.warning("İşlem uygulanamadı, lütfen tekrar deneyin.", { id: toastId });
      }
    } catch (err: any) {
      console.error("Visual removal error:", err);
      toast.error("Filigran silinirken bir hata oluştu.", { id: toastId });
    } finally {
      setIsApplying(false);
    }
  };

  // 1-Click Auto Clean: Automatically find and eradicate watermarks
  const handleOneClickAutoClean = async () => {
    if (!pdfBytes) return;

    setIsAutoCleaning(true);
    const toastId = toast.loading("Filigranlar otomatik tespit ediliyor...");

    try {
      let activeCandidates: WatermarkCandidate[] = [...candidates];

      // 1. If Gemini API key is configured, use Gemini 2.5 Flash Vision first
      if (apiKey.trim()) {
        try {
          toast.loading("Yapay zeka görseli analiz ediyor (Gemini Vision)...", { id: toastId });
          const { dataUrl, width, height } = await renderPdfPageToDataUrl(pdfBytes, activePage - 1);
          const aiResults = await detectWatermarksWithGemini(dataUrl, apiKey.trim());
          if (aiResults && aiResults.length > 0) {
            const aiCandidates = aiResults.map((item, idx) =>
              convertAiDetectionToCandidate(item, activePage - 1, width, height, idx)
            );
            activeCandidates = [...aiCandidates, ...activeCandidates];
          }
        } catch (aiErr: any) {
          console.warn("Gemini Vision AI error during auto clean:", aiErr);
        }
      }

      // 2. If no candidates, run local detector (vector + visual OCR)
      if (activeCandidates.length === 0) {
        toast.loading("Belge katmanları taranıyor...", { id: toastId });
        activeCandidates = await detectWatermarks(pdfBytes);
      }

      // 3. If STILL no candidates, run local visual OCR on current page
      if (activeCandidates.length === 0) {
        toast.loading("Görsel yapay zeka ile taranıyor...", { id: toastId });
        try {
          const vis = await detectVisualWatermarks(pdfBytes, activePage - 1);
          if (vis.length > 0) {
            activeCandidates = vis;
          }
        } catch (visErr) {
          console.warn("Visual OCR error:", visErr);
        }
      }

      const eff = getEffectiveFillColor();

      // 4. If candidates found, remove them
      if (activeCandidates.length > 0) {
        toast.loading(`${activeCandidates.length} filigran temizleniyor...`, { id: toastId });
        const options: WatermarkRemovalOptions = {
          candidateIds: activeCandidates.map((c) => c.id),
          pageScope,
          customPages: pageScope === "custom" ? parseCustomPages(customPagesStr, totalPages) : undefined,
          currentPage: activePage - 1,
          fillColor: { r: eff.r, g: eff.g, b: eff.b }
        };

        const result = await removeWatermarks(pdfBytes, activeCandidates, options);
        if (result.totalRemoved > 0) {
          onApplyRemoval(result.pdfBytes, result.totalRemoved);
          onOpenChange(false);
          toast.success(`⚡ Harika! ${result.totalRemoved} filigran başarıyla tespit edilip temizlendi.`, { id: toastId });
          return;
        }
      }

      // 5. If still 0 candidates, try removing known high-frequency watermark keywords
      toast.loading("Ortak taslak ve filigran kalıpları kontrol ediliyor...", { id: toastId });
      let removedAny = false;
      let workingBytes = pdfBytes;
      let totalRem = 0;

      for (const kw of QUICK_KEYWORDS) {
        try {
          const res = await removeWatermarks(workingBytes, [], {
            candidateIds: [],
            customText: kw,
            customCaseSensitive: false,
            pageScope,
            customPages: pageScope === "custom" ? parseCustomPages(customPagesStr, totalPages) : undefined,
            currentPage: activePage - 1,
            fillColor: { r: eff.r, g: eff.g, b: eff.b }
          });
          if (res.totalRemoved > 0) {
            workingBytes = res.pdfBytes;
            totalRem += res.totalRemoved;
            removedAny = true;
          }
        } catch {}
      }

      if (removedAny && totalRem > 0) {
        onApplyRemoval(workingBytes, totalRem);
        onOpenChange(false);
        toast.success(`⚡ ${totalRem} adet taslak/filigran ibaresi temizlendi!`, { id: toastId });
        return;
      }

      // If nothing could be found automatically, switch to visual area selection
      toast.dismiss(toastId);
      toast.info("Belirgin bir metin filigranı otomatik bulunamadı. Lütfen '🎯 Sayfada İşaretle & Sil' sekmesinden filigranı kutu içine alın veya fırça ile boyayın.");
      setActiveTab("visual");
    } catch (err: any) {
      console.error("Auto clean failed:", err);
      toast.error("Otomatik temizleme sırasında bir hata oluştu.", { id: toastId });
    } finally {
      setIsAutoCleaning(false);
    }
  };

  // Run AI scan specifically on active page
  const handleRunAiScan = async () => {
    if (!pdfBytes) return;
    if (!apiKey.trim()) {
      toast.error("Lütfen önce bir Google Gemini API anahtarı girin.");
      return;
    }

    setIsAiScanning(true);
    const toastId = toast.loading("Mevcut sayfa Gemini Vision yapay zekasına gönderiliyor...");

    try {
      const { dataUrl, width, height } = await renderPdfPageToDataUrl(pdfBytes, activePage - 1);
      const aiResults = await detectWatermarksWithGemini(dataUrl, apiKey.trim());
      setAiDetectedList(aiResults);

      if (aiResults.length === 0) {
        toast.info("Yapay zeka bu sayfada belirgin bir filigran tespit edemedi.", { id: toastId });
        return;
      }

      const newAiCandidates = aiResults.map((item, idx) =>
        convertAiDetectionToCandidate(item, activePage - 1, width, height, idx)
      );

      setCandidates((prev) => {
        const nonAi = prev.filter((c) => !c.id.startsWith("wm-ai-"));
        return [...newAiCandidates, ...nonAi];
      });

      setSelectedIds((prev) => {
        const next = new Set(prev);
        newAiCandidates.forEach((c) => next.add(c.id));
        return next;
      });

      toast.success(`Yapay zeka ${aiResults.length} adet filigran/damga tespit etti!`, { id: toastId });
    } catch (err: any) {
      console.error("AI Scan error:", err);
      toast.error(err.message || "Yapay zeka analizi başarısız oldu.", { id: toastId });
    } finally {
      setIsAiScanning(false);
    }
  };

  // Apply Candidates or Custom Text
  const handleApply = async () => {
    if (!pdfBytes) return;

    const hasCandidates = selectedIds.size > 0;
    const hasCustomText = customText.trim().length > 0;

    if (!hasCandidates && !hasCustomText) {
      toast.error("Lütfen kaldırılacak en az bir filigran seçin veya özel bir metin girin.");
      return;
    }

    setIsApplying(true);
    try {
      const customPages = pageScope === "custom" ? parseCustomPages(customPagesStr, totalPages) : undefined;
      const eff = getEffectiveFillColor();
      const options: WatermarkRemovalOptions = {
        candidateIds: Array.from(selectedIds),
        customText: customText.trim() || undefined,
        customCaseSensitive,
        pageScope,
        customPages,
        currentPage: activePage - 1,
        fillColor: { r: eff.r, g: eff.g, b: eff.b }
      };

      const result = await removeWatermarks(pdfBytes, candidates, options);

      if (result.totalRemoved > 0) {
        onApplyRemoval(result.pdfBytes, result.totalRemoved);
        onOpenChange(false);
        toast.success(`Filigran başarıyla kaldırıldı! (${result.totalRemoved} öğe temizlendi)`);
      } else {
        toast.warning("Seçili kriterlerle eşleşen filigran bulunamadı veya kaldırılamadı.");
      }
    } catch (err) {
      console.error("Watermark removal failed:", err);
      toast.error("Filigran kaldırılırken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsApplying(false);
    }
  };

  const totalSelectedCount = selectedIds.size + (customText.trim().length > 0 ? 1 : 0);
  const visualTotalAreas = manualBoxes.length + (hasBrushStrokes ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-white rounded-xl shadow-2xl p-6 border border-slate-100 max-h-[92vh] overflow-y-auto">
        <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eraser className="w-5 h-5 text-indigo-600" />
            <span>Profesyonel Filigran Temizleme</span>
            <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              10/10 Suite
            </span>
          </div>
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-500 mt-0.5">
          Vektörel metinler, taranmış damgalar, arka plan logoları ve geçersiz ibarelerini akıllı kağıt rengi uyumuyla silin.
        </DialogDescription>

        {/* 1-Click Instant Auto Clean Banner */}
        <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[1px] rounded-xl mt-3.5">
          <div className="bg-white p-3.5 rounded-[11px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <Zap className="w-5 h-5 fill-indigo-500 text-indigo-600" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Tek Tıkla Otomatik Bul ve Sil</span>
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI & OCR Hibrit
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {apiKey.trim()
                    ? "Gemini Vision AI ve yerel görsel OCR ile tüm filigranları otomatik tespit edip yok eder."
                    : "Görsel OCR ve akıllı katman analizi ile filigran ve taslak damgalarını otomatik bulup temizler."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOneClickAutoClean}
              disabled={isApplying || isScanning || isAutoCleaning || isAiScanning}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isAutoCleaning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Otomatik Temizleniyor...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Oto Bul ve Sil</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 mt-4 gap-2 sm:gap-4 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => switchTab("visual")}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === "visual"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            🎯 Sayfada İşaretle & Sil (Kutu + Fırça)
            {visualTotalAreas > 0 && (
              <span className="px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">
                {visualTotalAreas}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => switchTab("auto")}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === "auto"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Otomatik Algılananlar
            {candidates.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
                {candidates.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => switchTab("custom")}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === "custom"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Özel Metin Sil
          </button>

          <button
            type="button"
            onClick={() => switchTab("ai")}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === "ai"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Gemini Vision (Bulut AI)
            {apiKey.trim() && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Gemini API Bağlı" />
            )}
          </button>
        </div>

        {/* TAB 1: 🎯 Sayfada İşaretle & Sil (Multi-Box + Magic Brush + Color Picker + Zoom/Pages) */}
        {activeTab === "visual" && (
          <div className="space-y-3 pt-3">
            {/* Toolbar: Tools, Presets, Paper Color, Page Navigator, Zoom */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              {/* Row 1: Tool Selection & Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Mode toggle: Box vs Brush */}
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setActiveTool("box")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeTool === "box"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Square className="w-3.5 h-3.5" />
                    Kutu Seçimi
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTool("brush")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeTool === "brush"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    🪄 Sihirli Fırça
                  </button>
                </div>

                {/* Sub-controls based on active tool */}
                {activeTool === "box" ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => addPresetBox("center")}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      📌 Orta Filigran Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => addPresetBox("header")}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      ⬆️ Üst Başlık
                    </button>
                    <button
                      type="button"
                      onClick={() => addPresetBox("footer")}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      ⬇️ Alt Bilgi
                    </button>
                    {manualBoxes.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllBoxes}
                        className="px-2 py-1 bg-red-50 hover:bg-red-100 border border-red-200 rounded text-[11px] font-semibold text-red-700 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Kutuları Temizle ({manualBoxes.length})
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-medium">Fırça Boyutu:</span>
                    {[
                      { size: 14, label: "İnce" },
                      { size: 24, label: "Orta" },
                      { size: 40, label: "Kalın" },
                      { size: 65, label: "Çok Kalın" }
                    ].map((b) => (
                      <button
                        key={b.size}
                        type="button"
                        onClick={() => setBrushSize(b.size)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                          brushSize === b.size
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                    {hasBrushStrokes && (
                      <button
                        type="button"
                        onClick={clearBrushStrokes}
                        className="px-2 py-0.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded text-[10px] font-semibold text-red-700 transition-colors cursor-pointer flex items-center gap-1 ml-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Fırçayı Sıfırla
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Row 2: Paper Color Tone Matching, Zoom, and Page Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                {/* Paper Color Tone Selector */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                    <Palette className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Daksil / Kağıt Rengi:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaperColorMode("auto")}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        paperColorMode === "auto"
                          ? "bg-indigo-50 border-indigo-300 text-indigo-800 ring-1 ring-indigo-400"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      title="Sayfa kenarlarından taranarak bulunan orijinal kağıt rengi"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs inline-block"
                        style={{ backgroundColor: detectedPaperColor.hex }}
                      />
                      <span>🪄 Oto Kağıt ({detectedPaperColor.hex.toUpperCase()})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaperColorMode("white")}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        paperColorMode === "white"
                          ? "bg-indigo-50 border-indigo-300 text-indigo-800 ring-1 ring-indigo-400"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-slate-300 bg-white shadow-2xs inline-block" />
                      <span>Saf Beyaz</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPaperColorMode("custom")}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          paperColorMode === "custom"
                            ? "bg-indigo-50 border-indigo-300 text-indigo-800 ring-1 ring-indigo-400"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs inline-block"
                          style={{ backgroundColor: customColorHex }}
                        />
                        <span>Özel Renk</span>
                      </button>
                      {paperColorMode === "custom" && (
                        <input
                          type="color"
                          value={customColorHex}
                          onChange={(e) => setCustomColorHex(e.target.value)}
                          className="w-6 h-6 p-0 border border-slate-300 rounded cursor-pointer"
                          title="Renk paletinden ton seç"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Page Navigation & Zoom Level */}
                <div className="flex items-center gap-3">
                  {/* Zoom controls */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.7, Math.round((z - 0.2) * 10) / 10))}
                      className="text-slate-600 hover:text-slate-900 cursor-pointer p-0.5"
                      title="Küçült"
                    >
                      <ZoomOut className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-mono text-slate-600 min-w-[32px] text-center">
                      %{Math.round(zoomLevel * 100)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(1.8, Math.round((z + 0.2) * 10) / 10))}
                      className="text-slate-600 hover:text-slate-900 cursor-pointer p-0.5"
                      title="Büyüt"
                    >
                      <ZoomIn className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Page switcher inside modal */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px]">
                      <button
                        type="button"
                        disabled={activePage <= 1}
                        onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                        className="text-slate-600 hover:text-slate-900 disabled:opacity-30 cursor-pointer p-0.5"
                        title="Önceki Sayfa"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-slate-700 font-medium px-1">
                        Sayfa {activePage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={activePage >= totalPages}
                        onClick={() => setActivePage((p) => Math.min(totalPages, p + 1))}
                        className="text-slate-600 hover:text-slate-900 disabled:opacity-30 cursor-pointer p-0.5"
                        title="Sonraki Sayfa"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Canvas Workspace */}
            <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-slate-200 flex items-center justify-center min-h-[340px] max-h-[440px] overflow-auto p-4">
              {isPreviewLoading && (
                <div className="absolute inset-0 z-30 bg-white/80 flex flex-col items-center justify-center gap-2 text-slate-600">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                  <span className="text-xs font-semibold">Sayfa ve kağıt tonu yükleniyor...</span>
                </div>
              )}

              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease-out"
                }}
                className="relative inline-block select-none shadow-xl bg-white rounded"
              >
                {/* Base Page Canvas */}
                <canvas ref={previewCanvasRef} className="block max-w-none" />

                {/* Freehand Magic Brush Canvas Overlay */}
                <canvas
                  ref={brushCanvasRef}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                  className={`absolute inset-0 z-10 block max-w-none ${
                    activeTool === "brush" ? "cursor-crosshair pointer-events-auto" : "cursor-crosshair pointer-events-auto"
                  }`}
                />

                {/* Active Drawing Box Preview */}
                {activeDrawingBox && activeDrawingBox.w > 0 && activeDrawingBox.h > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: activeDrawingBox.x,
                      top: activeDrawingBox.y,
                      width: activeDrawingBox.w,
                      height: activeDrawingBox.h,
                    }}
                    className="border-2 border-dashed border-red-500 bg-red-500/20 pointer-events-none rounded-sm z-20"
                  >
                    <span className="absolute -top-5 left-0 bg-red-600 text-white text-[9px] font-bold px-1 rounded shadow whitespace-nowrap">
                      {Math.round(activeDrawingBox.w)}x{Math.round(activeDrawingBox.h)}
                    </span>
                  </div>
                )}

                {/* Render All Confirmed Manual Boxes */}
                {manualBoxes.map((box, idx) => (
                  <div
                    key={box.id}
                    style={{
                      position: "absolute",
                      left: box.x,
                      top: box.y,
                      width: box.w,
                      height: box.h,
                    }}
                    className="border-2 border-dashed border-red-600 bg-red-500/25 rounded-sm z-20 group"
                  >
                    <div className="absolute -top-6 left-0 flex items-center gap-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                      <span>{box.label || `Kutu ${idx + 1}`}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBox(box.id);
                        }}
                        className="hover:bg-red-800 rounded px-0.5 cursor-pointer ml-1"
                        title="Kutuyu Kaldır"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Status & Removal Trigger */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-600">
                {visualTotalAreas > 0 ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {manualBoxes.length > 0 && `${manualBoxes.length} kutu`}
                    {manualBoxes.length > 0 && hasBrushStrokes && " + "}
                    {hasBrushStrokes && "Sihirli fırça alanı"} silinmek üzere hazır!
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Sayfada kutu çizerek veya sihirli fırça ile boyayarak kaldırılacak yerleri işaretleyin.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {visualTotalAreas > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAllBoxes();
                      clearBrushStrokes();
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Seçimleri Sıfırla
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleApplyVisualSelections}
                  disabled={isApplying || visualTotalAreas === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Kusursuzca Siliniyor...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Bu Alanları Sil ve Kağıda Uydur ({visualTotalAreas})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Otomatik Algılananlar */}
        {activeTab === "auto" && (
          <div className="space-y-4 pt-4">
            {isScanning ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-xs">Belge ve sayfa katmanları taranıyor...</p>
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-700">Otomatik filigran algılanamadı</p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Belgenizde standart bir vektörel filigran metni yakalanamadı. Taranmış damgaları silmek için <strong>🎯 Sayfada İşaretle & Sil</strong> sekmesindeki kutu veya sihirli fırçayı kullanabilir ya da <strong>Özel Metin Sil</strong> sekmesine geçebilirsiniz.
                </p>
                <div className="flex justify-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => switchTab("visual")}
                    className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Target className="w-3.5 h-3.5" />
                    Sayfada İşaretle & Sil →
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => switchTab("custom")}
                    className="text-xs text-slate-600 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Type className="w-3.5 h-3.5" />
                    Özel metin gir →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Tespit edilen filigranlar ({candidates.length})</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllCandidates}
                      className="text-indigo-600 hover:underline cursor-pointer"
                    >
                      Tümünü Seç
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={deselectAllCandidates}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Temizle
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {candidates.map((cand) => {
                    const isSelected = selectedIds.has(cand.id);
                    return (
                      <div
                        key={cand.id}
                        onClick={() => toggleCandidate(cand.id)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? "bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-400"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCandidate(cand.id)}
                          className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 break-all">
                              &ldquo;{cand.text}&rdquo;
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                cand.confidence >= 70
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              %{cand.confidence} Güven
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                              {cand.type === "image" ? "Görsel / Damga" : "Metin Filigranı"}
                            </span>
                            {cand.id.startsWith("wm-vis-") && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold">
                                Görsel OCR
                              </span>
                            )}
                            {cand.id.startsWith("wm-ai-") && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold">
                                AI Tespitli
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                            <span>{cand.reason}</span>
                            <span>·</span>
                            <span>
                              {cand.pages.length === totalPages
                                ? "Tüm sayfalarda"
                                : `${cand.pages.length} sayfada (${cand.pages.map((p) => p + 1).slice(0, 5).join(", ")}${cand.pages.length > 5 ? "..." : ""})`}
                            </span>
                            {cand.fontSize ? (
                              <>
                                <span>·</span>
                                <span>{cand.fontSize}pt</span>
                              </>
                            ) : null}
                            {cand.angle ? (
                              <>
                                <span>·</span>
                                <span>{cand.angle}° açı</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Özel Metin Sil + Quick Chips */}
        {activeTab === "custom" && (
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Kaldırılacak Metin veya İbare
              </label>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Örn: GEÇERSİZ, ÖRNEK BELGEDİR, TASLAK, www.site.com, CamScanner..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              {/* Quick Keywords Chips */}
              <div className="pt-1">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  Hızlı Seçim Kalıpları (Tek Tıkla Ekle):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_KEYWORDS.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setCustomText(kw)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                        customText === kw
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                      }`}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 pt-1">
                Girdiğiniz metin, hem vektörel PDF nesnelerinde hem de taranmış resim belgelerinde görsel OCR ile taranarak akıllı arka planla temizlenir.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="caseSensitive"
                checked={customCaseSensitive}
                onChange={(e) => setCustomCaseSensitive(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="caseSensitive" className="text-xs text-slate-600 cursor-pointer">
                Büyük / küçük harf duyarlı ara (Örn: &ldquo;TASLAK&rdquo; ile &ldquo;taslak&rdquo; ayrılsın)
              </label>
            </div>
          </div>
        )}

        {/* TAB 4: Gemini Vision AI */}
        {activeTab === "ai" && (
          <div className="space-y-4 pt-4">
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-purple-900">
                    Google Gemini 2.5 Flash Vision Entegrasyonu
                  </span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                >
                  Ücretsiz API Anahtarı Al
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-purple-800/80 leading-relaxed">
                Taranmış PDF&apos;lerde veya karmaşık tasarımlarda vektör metni bulunmayan filigranları yapay zeka görsel olarak tanır ve konumunu nokta atışı tespit ederek siler.
              </p>

              {/* API Key Input */}
              <div className="pt-2 flex gap-2">
                <div className="relative flex-1">
                  <Key className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy... (Gemini API Anahtarınızı yapıştırın)"
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-purple-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveApiKey(apiKey)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Kaydet
                </button>
              </div>
            </div>

            {/* AI Scan Trigger Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  {activePage}. Sayfayı Yapay Zeka ile Tara
                </div>
                <div className="text-[11px] text-slate-500">
                  Mevcut sayfa görüntüsü analiz edilir ve filigran koordinatları belirlenir.
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunAiScan}
                disabled={isAiScanning || !apiKey.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isAiScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Taranıyor...
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5" />
                    AI ile Tara
                  </>
                )}
              </button>
            </div>

            {/* AI Detection results */}
            {aiDetectedList.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Yapay Zeka Tarafından Tespit Edilenler ({aiDetectedList.length}):
                </div>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {aiDetectedList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-200 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-purple-950">&ldquo;{item.text}&rdquo;</div>
                        <div className="text-[10px] text-purple-700">{item.reason || "Filigran / Damga"}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-800 text-[10px] font-bold">
                        %{item.confidence}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Page Scope Configuration (for auto / custom / ai tabs) */}
        {activeTab !== "visual" && (
          <div className="pt-4 border-t border-slate-100 space-y-2 mt-4">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Sayfa Kapsamı
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "all", label: `Tüm Sayfalar (${totalPages})` },
                { id: "current", label: `Yalnızca Bu Sayfa (${activePage})` },
                { id: "custom", label: "Özel Sayfalar" }
              ].map((scope) => (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setPageScope(scope.id as any)}
                  className={`py-2 px-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                    pageScope === scope.id
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {scope.label}
                </button>
              ))}
            </div>

            {pageScope === "custom" && (
              <div className="pt-1">
                <input
                  type="text"
                  value={customPagesStr}
                  onChange={(e) => setCustomPagesStr(e.target.value)}
                  placeholder="Örn: 1, 3, 5-10"
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Virgülle ayrılmış sayfa numaraları veya aralıklar girin (1 ile ${totalPages} arasında).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Footer (for non-visual tabs) */}
        {activeTab !== "visual" && (
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isApplying || isAutoCleaning}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Vazgeç
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || (isScanning && !customText.trim()) || isAutoCleaning || totalSelectedCount === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all cursor-pointer ${
                totalSelectedCount > 0 && !isApplying && !isAutoCleaning
                  ? "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
                  : "bg-slate-300 cursor-not-allowed text-slate-500"
              }`}
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Filigran Temizleniyor...
                </>
              ) : (
                <>
                  <Eraser className="w-4 h-4" />
                  Seçilenleri Sil ve Uygula
                  {totalSelectedCount > 0 && ` (${totalSelectedCount})`}
                </>
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
