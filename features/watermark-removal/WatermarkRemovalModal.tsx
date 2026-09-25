"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Zap,
  Target,
  RefreshCw,
  Paintbrush,
  Square,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Palette,
  ShieldCheck,
  MousePointerClick,
  Eye,
  Sliders,
  Maximize2
} from "lucide-react";
import { toast } from "sonner";
import { detectWatermarks } from "./watermarkDetector";
import { removeWatermarks, buildSafeAutoCleanCandidateIds } from "./watermarkRemover";
import {
  detectVisualWatermarks,
  renderPdfPageToCanvas,
  detectPageBackgroundColor
} from "./visualWatermarkDetector";
import { loadPdf } from "@/lib/documents";
import { editablePageText, type EditableText } from "@/lib/pdf-text";
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

  // Tools: "pick" (Click to Erase) | "brush" (Magic Brush) | "box" (Multi-Box)
  const [activeTool, setActiveTool] = useState<"pick" | "brush" | "box">("pick");
  const [brushSize, setBrushSize] = useState<number>(28);
  const [hasBrushStrokes, setHasBrushStrokes] = useState<boolean>(false);
  const isBrushingRef = useRef<boolean>(false);
  const [brushMousePos, setBrushMousePos] = useState<{ x: number; y: number } | null>(null);

  // Undo / Redo Stack for brush & box
  const undoStackRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);

  // Before / After live comparison peek
  const [isPeekingOriginal, setIsPeekingOriginal] = useState<boolean>(false);

  // Secondary confirmation when selecting all candidates if image/logo candidates exist
  const [showImageRiskModal, setShowImageRiskModal] = useState<boolean>(false);
  const [showManualLogoModal, setShowManualLogoModal] = useState<boolean>(false);
  const confirmedLogoRemovalRef = useRef<boolean>(false);


  // Canvas & Preview Viewport
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const brushCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [previewPageSize, setPreviewPageSize] = useState<{ width: number; height: number; scale: number } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [canvasDims, setCanvasDims] = useState<{ width: number; height: number }>({ width: 800, height: 1130 });

  // Vector Text on active page (for 1-click Target Picker)
  const [pageTextItems, setPageTextItems] = useState<EditableText[]>([]);
  const [hoveredTextItem, setHoveredTextItem] = useState<EditableText | null>(null);
  const [selectedTextElement, setSelectedTextElement] = useState<string | null>(null);

  // Dark text preservation toggle
  const [protectDarkText, setProtectDarkText] = useState<boolean>(true);

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

  // Sync activePage with prop when modal opens
  useEffect(() => {
    if (open) {
      setActivePage(currentPage);
    }
  }, [open, currentPage]);



  // Run auto-detection when modal opens or activePage changes
  useEffect(() => {
    if (!open || !pdfBytes) {
      setCandidates([]);
      setSelectedIds(new Set());
      setManualBoxes([]);
      setHasBrushStrokes(false);
      setSelectedTextElement(null);
      undoStackRef.current = [];
      setCanUndo(false);
      return;
    }

    let active = true;
    setIsScanning(true);

    detectWatermarks(pdfBytes)
      .then(async (detected) => {
        if (!active) return;

        let finalCandidates = [...detected];

        // If no vector text watermarks found, try visual OCR on the active page
        if (finalCandidates.length === 0 && typeof window !== "undefined") {
          try {
            const visual = await detectVisualWatermarks(pdfBytes, activePage - 1);
            if (active && visual.length > 0) {
              finalCandidates = visual;
            }
          } catch (err) {
            console.warn("Visual OCR auto-detection error:", err);
          }
        }

        if (!active) return;
        setCandidates(finalCandidates);

        // Pre-select high confidence candidates:
        // STRICT SAFETY (V6): type === "image" candidates are NEVER auto-selected by default!
        // Explicit user action is required to select images/logos for deletion.
        const highConf = new Set(
          finalCandidates
            .filter((c) => c.type !== "image" && !c.isLogoOrHeader && c.confidence >= 55)
            .map((c) => c.id)
        );
        if (highConf.size > 0) {
          setSelectedIds(highConf);
        } else {
          // If only image candidates exist, leave selectedIds empty
          const firstNonImage = finalCandidates.find((c) => c.type !== "image" && !c.isLogoOrHeader);
          if (firstNonImage) {
            setSelectedIds(new Set([firstNonImage.id]));
          } else {
            setSelectedIds(new Set());
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

  // Load interactive page preview canvas and extract text items for "Tıkla ve Sil"
  useEffect(() => {
    if (!open || !pdfBytes) return;

    let active = true;
    setIsPreviewLoading(true);

    // 1. Render PDF page image
    renderPdfPageToCanvas(pdfBytes, activePage - 1, 1.35)
      .then(async ({ canvas, pageWidth, pageHeight }) => {
        if (!active) return;

        // Detect authentic paper background tone from margin pixels
        const detectedColor = detectPageBackgroundColor(canvas);
        setDetectedPaperColor(detectedColor);

        // Draw page image onto preview canvas
        if (previewCanvasRef.current) {
          const target = previewCanvasRef.current;
          target.width = canvas.width;
          target.height = canvas.height;
          const ctx = target.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, 0);
          }
          setCanvasDims({ width: canvas.width, height: canvas.height });
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
          undoStackRef.current = [];
          setCanUndo(false);
        }

        setPreviewPageSize({
          width: pageWidth,
          height: pageHeight,
          scale: canvas.width / pageWidth
        });

        // Auto-fit document page comfortably to viewport without clipping
        const fitContainer = () => {
          if (canvasContainerRef.current) {
            const cw = canvasContainerRef.current.clientWidth - 48;
            const ch = canvasContainerRef.current.clientHeight - 48;
            if (cw > 100 && ch > 100 && canvas.width > 0 && canvas.height > 0) {
              const fitScale = Math.min(cw / canvas.width, ch / canvas.height);
              setZoomLevel(Math.max(0.35, Math.min(1.0, Math.round(fitScale * 100) / 100)));
            }
          }
        };
        fitContainer();
        setTimeout(fitContainer, 120);

        // 2. Extract vector text items for 1-click Target Picker
        try {
          const doc = await loadPdf(pdfBytes);
          const page = await doc.getPage(activePage);
          const texts = await editablePageText(page);
          if (active) {
            setPageTextItems(texts);
          }
          await doc.loadingTask.destroy();
        } catch (e) {
          console.warn("Could not extract vector texts for page:", e);
        }
      })
      .catch((err) => {
        console.error("Canvas render error:", err);
      })
      .finally(() => {
        if (active) setIsPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, pdfBytes, activePage]);

  // Auto-fit zoom to current workspace dimensions
  const handleAutoFitZoom = useCallback(() => {
    if (canvasContainerRef.current && previewCanvasRef.current) {
      const cw = canvasContainerRef.current.clientWidth - 48;
      const ch = canvasContainerRef.current.clientHeight - 48;
      const pw = previewCanvasRef.current.width;
      const ph = previewCanvasRef.current.height;
      if (cw > 100 && ch > 100 && pw > 0 && ph > 0) {
        const fitScale = Math.min(cw / pw, ch / ph);
        setZoomLevel(Math.max(0.35, Math.min(1.0, Math.round(fitScale * 100) / 100)));
      }
    }
  }, []);

  // Undo Mechanism
  const handleUndo = useCallback(() => {
    if (activeTool === "box" && manualBoxes.length > 0) {
      setManualBoxes((prev) => prev.slice(0, -1));
      toast.info("Kutu geri alındı.");
      return;
    }

    const bCanvas = brushCanvasRef.current;
    if (bCanvas && undoStackRef.current.length > 0) {
      const ctx = bCanvas.getContext("2d");
      if (ctx) {
        const prevData = undoStackRef.current.pop();
        if (prevData) {
          ctx.putImageData(prevData, 0, 0);
          setCanUndo(undoStackRef.current.length > 0);
          toast.info("Fırça darbesi geri alındı.");
          return;
        }
      }
    }

    if (manualBoxes.length > 0) {
      setManualBoxes((prev) => prev.slice(0, -1));
      toast.info("Kutu geri alındı.");
    }
  }, [activeTool, manualBoxes]);

  // Keyboard Shortcuts: Ctrl+Z (Undo), 1/2/3 (Tools), Esc
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.key === "1") {
        setActiveTool("pick");
      } else if (e.key === "2") {
        setActiveTool("brush");
      } else if (e.key === "3") {
        setActiveTool("box");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleUndo]);

  // Pointer & Touch Events on Brush Canvas
  const getCanvasCoords = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    const bCanvas = brushCanvasRef.current;
    if (!bCanvas) return { x: 0, y: 0 };
    const rect = bCanvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * bCanvas.width;
    const y = ((clientY - rect.top) / rect.height) * bCanvas.height;
    return { x, y, clientX, clientY };
  };

  const handlePointerDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    if (activeTool === "pick") {
      const { x, y } = getCanvasCoords(e);
      if (!previewPageSize || !previewCanvasRef.current) return;
      const scaleX = previewCanvasRef.current.width / previewPageSize.width;
      const scaleY = previewCanvasRef.current.height / previewPageSize.height;

      let hitItem: EditableText | null = null;
      for (const item of pageTextItems) {
        const itemCanvasX = item.x * scaleX;
        const itemCanvasY = previewCanvasRef.current.height - (item.y + item.h) * scaleY;
        const itemCanvasW = item.w * scaleX;
        const itemCanvasH = item.h * scaleY;

        if (
          x >= itemCanvasX - 4 &&
          x <= itemCanvasX + itemCanvasW + 4 &&
          y >= itemCanvasY - 4 &&
          y <= itemCanvasY + itemCanvasH + 4
        ) {
          hitItem = item;
          break;
        }
      }

      if (hitItem && hitItem.text?.trim()) {
        setSelectedTextElement(hitItem.text.trim());
        toast.info(`Filigran seçildi: "${hitItem.text.trim()}"`);
      }
      return;
    }

    if (activeTool === "brush") {
      isBrushingRef.current = true;
      const bCanvas = brushCanvasRef.current;
      if (!bCanvas) return;
      const ctx = bCanvas.getContext("2d");
      if (!ctx) return;

      // Save state to undo stack before new stroke
      try {
        const snapshot = ctx.getImageData(0, 0, bCanvas.width, bCanvas.height);
        undoStackRef.current.push(snapshot);
        if (undoStackRef.current.length > 20) undoStackRef.current.shift();
        setCanUndo(true);
      } catch {}

      const { x, y } = getCanvasCoords(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.65)";
      ctx.stroke();
      setHasBrushStrokes(true);
    } else if (activeTool === "box") {
      isDrawingBoxRef.current = true;
      const { x, y } = getCanvasCoords(e);
      startPosRef.current = { x, y };
      setActiveDrawingBox({ x, y, w: 0, h: 0 });
    }
  };

  const handlePointerMove = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    const { x, y, clientX, clientY } = getCanvasCoords(e);

    // Track cursor pos for custom brush circle
    if (activeTool === "brush") {
      setBrushMousePos({ x, y });
    } else {
      setBrushMousePos(null);
    }

    if (activeTool === "pick") {
      if (!previewPageSize || !previewCanvasRef.current) return;
      const scaleX = previewCanvasRef.current.width / previewPageSize.width;
      const scaleY = previewCanvasRef.current.height / previewPageSize.height;

      let hitItem: EditableText | null = null;
      for (const item of pageTextItems) {
        const itemCanvasX = item.x * scaleX;
        const itemCanvasY = previewCanvasRef.current.height - (item.y + item.h) * scaleY;
        const itemCanvasW = item.w * scaleX;
        const itemCanvasH = item.h * scaleY;

        if (
          x >= itemCanvasX - 4 &&
          x <= itemCanvasX + itemCanvasW + 4 &&
          y >= itemCanvasY - 4 &&
          y <= itemCanvasY + itemCanvasH + 4
        ) {
          hitItem = item;
          break;
        }
      }
      setHoveredTextItem(hitItem);
      return;
    }

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
        setCanUndo(true);
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
    undoStackRef.current = [];
    setCanUndo(false);
    toast.info("Fırça temizlendi.");
  };

  // Export brush canvas mask to a PNG data URL with smart dark-text preservation
  const exportBrushMaskDataUrl = (): string | undefined => {
    const bCanvas = brushCanvasRef.current;
    const pCanvas = previewCanvasRef.current;
    if (!bCanvas || !hasBrushStrokes) return undefined;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = bCanvas.width;
    exportCanvas.height = bCanvas.height;
    const eCtx = exportCanvas.getContext("2d");
    if (!eCtx) return undefined;

    const bCtx = bCanvas.getContext("2d");
    const pCtx = pCanvas ? pCanvas.getContext("2d") : null;
    if (!bCtx) return undefined;

    const bImgData = bCtx.getImageData(0, 0, bCanvas.width, bCanvas.height);
    const pImgData = pCtx ? pCtx.getImageData(0, 0, bCanvas.width, bCanvas.height) : null;
    const outImgData = eCtx.createImageData(bCanvas.width, bCanvas.height);

    const bData = bImgData.data;
    const pData = pImgData ? pImgData.data : null;
    const outData = outImgData.data;

    const totalPixels = bCanvas.width * bCanvas.height;
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const brushAlpha = bData[idx + 3];

      if (brushAlpha > 20) {
        if (protectDarkText && pData) {
          const pr = pData[idx];
          const pg = pData[idx + 1];
          const pb = pData[idx + 2];
          const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;

          if (lum < 115) {
            outData[idx + 3] = 0;
            continue;
          }
        }

        outData[idx] = 255;
        outData[idx + 1] = 255;
        outData[idx + 2] = 255;
        outData[idx + 3] = 255;
      } else {
        outData[idx + 3] = 0;
      }
    }

    eCtx.putImageData(outImgData, 0, 0);
    return exportCanvas.toDataURL("image/png");
  };

  const getEffectiveFillColor = () => {
    if (paperColorMode === "white") {
      return { r: 1, g: 1, b: 1 };
    }
    if (paperColorMode === "custom") {
      const hex = customColorHex.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) / 255 || 1;
      const g = parseInt(hex.substring(2, 4), 16) / 255 || 1;
      const b = parseInt(hex.substring(4, 6), 16) / 255 || 1;
      return { r, g, b };
    }
    return {
      r: detectedPaperColor.r,
      g: detectedPaperColor.g,
      b: detectedPaperColor.b
    };
  };

  // Quick 1-Click Remove Specific Text from canvas click
  const handleQuickRemoveText = async (text: string, scope: "all" | "current" = "all") => {
    if (!pdfBytes || !text.trim()) return;

    setIsApplying(true);
    const toastId = toast.loading(`"${text}" cerrahi olarak temizleniyor...`);

    try {
      const eff = getEffectiveFillColor();
      const options: WatermarkRemovalOptions = {
        candidateIds: [],
        customText: text.trim(),
        customCaseSensitive: false,
        pageScope: scope,
        currentPage: activePage - 1,
        fillColor: { r: eff.r, g: eff.g, b: eff.b }
      };

      const result = await removeWatermarks(pdfBytes, [], options);

      if (result.totalRemoved > 0) {
        onApplyRemoval(result.pdfBytes, result.totalRemoved);
        onOpenChange(false);
        toast.success(`Filigran başarıyla kaldırıldı! (${result.totalRemoved} öğe temizlendi, çevre yazılar korundu)`, { id: toastId });
      } else {
        toast.warning(`"${text}" ifadesi bulunamadı veya silinemedi.`, { id: toastId });
      }
    } catch (err: any) {
      console.error("Quick remove failed:", err);
      toast.error("Silme sırasında bir hata oluştu.", { id: toastId });
    } finally {
      setIsApplying(false);
    }
  };

  // Presets: Add Box presets
  const handleAddBoxPreset = (preset: "center" | "header" | "footer") => {
    if (!previewCanvasRef.current) return;
    const cw = previewCanvasRef.current.width;
    const ch = previewCanvasRef.current.height;

    let newBox: WatermarkBox;
    if (preset === "center") {
      newBox = {
        id: "box-" + Date.now(),
        x: Math.round(cw * 0.12),
        y: Math.round(ch * 0.32),
        w: Math.round(cw * 0.76),
        h: Math.round(ch * 0.36),
        label: "Orta Filigran",
        page: activePage - 1
      };
    } else if (preset === "header") {
      newBox = {
        id: "box-" + Date.now(),
        x: Math.round(cw * 0.08),
        y: Math.round(ch * 0.03),
        w: Math.round(cw * 0.84),
        h: Math.round(ch * 0.12),
        label: "Üst Başlık",
        page: activePage - 1
      };
    } else {
      newBox = {
        id: "box-" + Date.now(),
        x: Math.round(cw * 0.08),
        y: Math.round(ch * 0.85),
        w: Math.round(cw * 0.84),
        h: Math.round(ch * 0.12),
        label: "Alt Bilgi",
        page: activePage - 1
      };
    }

    setManualBoxes((prev) => [...prev, newBox]);
    setCanUndo(true);
    toast.info(`${newBox.label} kutusu eklendi.`);
  };

  // 1-Click Auto Clean: Automatically find and eradicate watermarks
  const handleOneClickAutoClean = async () => {
    if (!pdfBytes) return;

    setIsAutoCleaning(true);
    const toastId = toast.loading("Filigranlar renk ve açı analizleriyle cerrahi olarak taranıyor...");

    try {
      let activeCandidates: WatermarkCandidate[] = [...candidates];

      // 1. If no candidates, run local detector
      if (activeCandidates.length === 0) {
        toast.loading("Belge katmanları taranıyor (renk, açı, desen)...", { id: toastId });
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

      // 4. Filter candidates strictly through safe auto-clean rules (V7: zero auto-deletion for logos/images)
      const safeCandidateIds = buildSafeAutoCleanCandidateIds(activeCandidates);
      if (safeCandidateIds.length > 0) {
        const safeSet = new Set(safeCandidateIds);
        const candidatesToClean = activeCandidates.filter((c) => safeSet.has(c.id));
        toast.loading(`${safeCandidateIds.length} güvenli filigran cerrahi olarak temizleniyor...`, { id: toastId });
        const options: WatermarkRemovalOptions = {
          candidateIds: safeCandidateIds,
          pageScope,
          customPages: pageScope === "custom" ? parseCustomPages(customPagesStr, totalPages) : undefined,
          currentPage: activePage - 1,
          fillColor: { r: eff.r, g: eff.g, b: eff.b }
        };

        const result = await removeWatermarks(pdfBytes, candidatesToClean, options);
        if (result.totalRemoved > 0) {
          onApplyRemoval(result.pdfBytes, result.totalRemoved);
          onOpenChange(false);
          toast.success(`Filigran başarıyla kaldırıldı! (${result.totalRemoved} öğe temizlendi, logolar ve çevre yazılar korundu)`, { id: toastId });
          return;
        }
      }

      // If no safe text candidates found automatically, inform the user honestly without blind deletion
      toast.dismiss(toastId);
      toast.info("Otomatik temizlenebilecek güvenli metin filigranı bulunamadı. Görseller, logolar veya özel alanlar için lütfen adayı listeden manuel seçin veya fırça/kutu ile işaretleyin.");
    } catch (err: any) {
      console.error("Auto clean failed:", err);
      toast.error("Otomatik temizleme sırasında bir hata oluştu.", { id: toastId });
    } finally {
      setIsAutoCleaning(false);
    }
  };


  // Comprehensive Main Apply Removal
  const executeApply = async (allowLogoRemoval = false) => {
    if (!pdfBytes) return;

    const hasCustomText = customText.trim().length > 0;
    const hasSelectedCandidates = selectedIds.size > 0;
    const hasBoxes = manualBoxes.length > 0;
    const brushMask = exportBrushMaskDataUrl();
    const hasBrush = !!brushMask;

    if (!hasCustomText && !hasSelectedCandidates && !hasBoxes && !hasBrush) {
      toast.warning("Lütfen silmek için bir filigran seçin, metin yazın veya fırça ile işaretleyin.");
      return;
    }

    setIsApplying(true);
    const toastId = toast.loading("Filigranlar çevre yazılara zarar verilmeden cerrahi olarak siliniyor...");

    try {
      const eff = getEffectiveFillColor();

      // Convert manual boxes to PDF coordinates if present
      let pdfBoxes: WatermarkBox[] | undefined = undefined;
      if (hasBoxes && previewPageSize && previewCanvasRef.current) {
        const canvasW = previewCanvasRef.current.width;
        const canvasH = previewCanvasRef.current.height;
        const scaleX = previewPageSize.width / canvasW;
        const scaleY = previewPageSize.height / canvasH;

        pdfBoxes = manualBoxes.map((b) => ({
          id: b.id,
          x: Math.max(0, b.x * scaleX),
          y: Math.max(0, previewPageSize.height - (b.y + b.h) * scaleY),
          w: Math.min(previewPageSize.width, b.w * scaleX),
          h: Math.min(previewPageSize.height, b.h * scaleY),
          label: b.label,
          page: activePage - 1
        }));
      }

      const options: WatermarkRemovalOptions = {
        candidateIds: Array.from(selectedIds),
        customText: hasCustomText ? customText.trim() : undefined,
        customCaseSensitive,
        pageScope,
        customPages: pageScope === "custom" ? parseCustomPages(customPagesStr, totalPages) : undefined,
        currentPage: activePage - 1,
        fillColor: { r: eff.r, g: eff.g, b: eff.b },
        manualBoxes: pdfBoxes,
        brushMaskDataUrl: brushMask,
        allowLogoRemoval
      };

      const result = await removeWatermarks(pdfBytes, candidates, options);

      if (result.totalRemoved > 0) {
        onApplyRemoval(result.pdfBytes, result.totalRemoved);
        onOpenChange(false);
        toast.success(`Seçtiğiniz filigran adayları kaldırıldı (${result.totalRemoved} öğe). Önemli belgelerde sonucu kontrol ederek dışa aktarın.`, { id: toastId });
      } else {
        toast.warning("Seçilen filigranlar bulunamadı veya silinemedi. Belge baytları değiştirilmedi.", { id: toastId });
      }
    } catch (err: any) {
      console.error("Removal failed:", err);
      toast.error("Filigran silme başarısız oldu: " + (err.message || ""), { id: toastId });
    } finally {
      setIsApplying(false);
    }
  };

  const handleApply = async () => {
    // V7.1: Check if any selected candidate is image or logo
    const hasImageOrLogoSelected = Array.from(selectedIds).some((id) => {
      const c = candidates.find((cand) => cand.id === id);
      return c && (c.type === "image" || c.isLogoOrHeader === true);
    });

    if (hasImageOrLogoSelected && !confirmedLogoRemovalRef.current) {
      setShowManualLogoModal(true);
      return;
    }

    await executeApply(confirmedLogoRemovalRef.current);
  };

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const hasImageCandidates = candidates.some((c) => c.type === "image");
    if (hasImageCandidates) {
      setShowImageRiskModal(true);
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const confirmSelectAllWithImages = () => {
    setSelectedIds(new Set(candidates.map((c) => c.id)));
    setShowImageRiskModal(false);
    toast.warning("Görsel adayları seçildi. Kurumsal logonuzun silinmediğinden emin olmak için önizlemeyi kontrol edin.");
  };

  const selectOnlyTextCandidates = () => {
    setSelectedIds(new Set(candidates.filter((c) => c.type !== "image").map((c) => c.id)));
    setShowImageRiskModal(false);
    toast.info("Yalnızca metin filigranları seçildi. Kurumsal görseller ve logolar korundu.");
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const removeBox = (id: string) => {
    setManualBoxes((prev) => prev.filter((b) => b.id !== id));
  };

  const totalSelectedCount =
    selectedIds.size +
    (customText.trim() ? 1 : 0) +
    manualBoxes.length +
    (hasBrushStrokes ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[98vw] max-w-[1440px] sm:max-w-[1440px] md:max-w-[1440px] lg:max-w-[1440px] xl:max-w-[1440px] h-[94vh] max-h-[94vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-900 border-slate-800 text-slate-100 rounded-2xl shadow-2xl"
        style={{
          width: "min(1440px, 98vw)",
          maxWidth: "min(1440px, 98vw)",
          height: "94vh",
          maxHeight: "94vh"
        }}
      >
        <DialogTitle className="sr-only">Filigran Temizleme Stüdyosu</DialogTitle>
        <DialogDescription className="sr-only">
          Belgenizdeki filigran, damga ve mühürleri çevre sözleşme yazılarına zarar vermeden cerrahi olarak silin.
        </DialogDescription>

        {/* Studio Header */}
        <header className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Eraser className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-tight">Kusursuz Filigran Temizleyici</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                  Yerel Cerrahi Silme
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Seçilen filigran adaylarını temizler. Önemli belgelerde sonucu kontrol ederek dışa aktarın.
              </p>
            </div>
          </div>

          {/* Center Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setActiveTool("pick")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "pick"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Klavye Kısayolu: 1"
            >
              <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
              <span>🎯 Tıkla ve Sil</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("brush")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "brush"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Klavye Kısayolu: 2"
            >
              <Paintbrush className="w-3.5 h-3.5 shrink-0" />
              <span>🪄 Akıllı Fırça</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("box")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "box"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Klavye Kısayolu: 3"
            >
              <Square className="w-3.5 h-3.5 shrink-0" />
              <span>🔲 Kutu Seçimi</span>
            </button>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            {/* Before / After Peek Toggle */}
            <button
              type="button"
              onMouseDown={() => setIsPeekingOriginal(true)}
              onMouseUp={() => setIsPeekingOriginal(false)}
              onTouchStart={() => setIsPeekingOriginal(true)}
              onTouchEnd={() => setIsPeekingOriginal(false)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer select-none"
              title="Orijinal sayfayı görmek için basılı tutun"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span className="inline">Öncesini Gör</span>
            </button>

            {/* Undo button */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo && manualBoxes.length === 0}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-slate-700 transition-colors cursor-pointer"
              title="Geri Al (Ctrl + Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>

            {/* Close modal */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Kapat (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Studio Body: Left Canvas Viewport + Right Intelligence Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
          {/* LEFT: Spacious Interactive Canvas Viewport */}
          <div className="flex-1 flex flex-col bg-slate-950/90 border-r border-slate-800 overflow-hidden relative min-w-0 min-h-0">
            {/* Viewport Floating Top Bar */}
            <div className="px-4 py-2 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
              <div className="flex items-center gap-3 flex-wrap">
                {activeTool === "brush" && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Fırça:</span>
                    <input
                      type="range"
                      min={10}
                      max={75}
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                      className="w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[11px] font-mono text-indigo-400 min-w-[28px]">{brushSize}px</span>

                    {/* Dark text protection toggle */}
                    <button
                      type="button"
                      onClick={() => setProtectDarkText(!protectDarkText)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ml-2 ${
                        protectDarkText
                          ? "bg-emerald-950/80 border-emerald-600 text-emerald-300"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                      }`}
                      title="Fırça boyarken siyah sözleşme metinlerini korur"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>🛡️ Metinleri Koru: {protectDarkText ? "Açık" : "Kapalı"}</span>
                    </button>

                    {hasBrushStrokes && (
                      <button
                        type="button"
                        onClick={clearBrushStrokes}
                        className="px-2 py-1 bg-red-950/50 hover:bg-red-900/60 border border-red-800/80 rounded-lg text-[10px] font-semibold text-red-300 transition-colors cursor-pointer flex items-center gap-1 ml-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Sıfırla</span>
                      </button>
                    )}
                  </div>
                )}

                {activeTool === "box" && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Hazır Şablonlar:</span>
                    <button
                      type="button"
                      onClick={() => handleAddBoxPreset("center")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 transition-all cursor-pointer"
                    >
                      📌 Orta Filigran
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBoxPreset("header")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 transition-all cursor-pointer"
                    >
                      ⬆️ Üst Başlık
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBoxPreset("footer")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 transition-all cursor-pointer"
                    >
                      ⬇️ Alt Bilgi
                    </button>
                  </div>
                )}

                {activeTool === "pick" && (
                  <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium truncate">
                    <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">Sayfadaki herhangi bir filigrana tıklayın; tüm belgeden tek tıkla cerrahi olarak silinsin.</span>
                  </div>
                )}
              </div>

              {/* Viewport Zoom & Page Navigation */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Zoom */}
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.35, Math.round((z - 0.1) * 100) / 100))}
                    className="text-slate-400 hover:text-white cursor-pointer p-0.5"
                    title="Küçült"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-300 min-w-[34px] text-center">
                    %{Math.round(zoomLevel * 100)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(2.0, Math.round((z + 0.1) * 100) / 100))}
                    className="text-slate-400 hover:text-white cursor-pointer p-0.5"
                    title="Büyüt"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoFitZoom}
                    className="text-[9px] text-indigo-400 hover:text-indigo-300 hover:underline px-1 font-semibold cursor-pointer"
                    title="Sayfayı ekrana sığdır"
                  >
                    Sığdır
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1.0)}
                    className="text-[9px] text-slate-400 hover:text-white px-1 cursor-pointer"
                    title="Gerçek boyut"
                  >
                    1:1
                  </button>
                </div>

                {/* Page Navigation */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5 text-xs">
                    <button
                      type="button"
                      disabled={activePage <= 1}
                      onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                      className="text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer p-0.5"
                      title="Önceki Sayfa"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-slate-200 font-medium px-1 text-[11px]">
                      {activePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={activePage >= totalPages}
                      onClick={() => setActivePage((p) => Math.min(totalPages, p + 1))}
                      className="text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer p-0.5"
                      title="Sonraki Sayfa"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Canvas Scrollable Workspace */}
            <div
              ref={canvasContainerRef}
              className="flex-1 overflow-auto flex items-center justify-center p-4 lg:p-6 relative select-none min-w-0 min-h-0 bg-slate-950/70"
            >
              {isPreviewLoading && (
                <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-slate-300">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <span className="text-xs font-semibold">Sayfa yüksek çözünürlükte taranıyor...</span>
                </div>
              )}

              {/* Document Outer Scaled Wrapper (matches exact visual bounding box to prevent phantom scrollbars) */}
              <div
                style={{
                  width: canvasDims.width > 0
                    ? `${canvasDims.width * zoomLevel}px`
                    : undefined,
                  height: canvasDims.height > 0
                    ? `${canvasDims.height * zoomLevel}px`
                    : undefined
                }}
                className="relative shrink-0 flex items-center justify-center m-auto"
              >
                {/* Document Inner Canvas Wrapper (scaled from top-left) */}
                <div
                  style={{
                    width: canvasDims.width || 800,
                    height: canvasDims.height || 1130,
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: "top left",
                    transition: "transform 0.12s ease-out"
                  }}
                  className="relative inline-block select-none shadow-2xl rounded-sm bg-white overflow-visible"
                >
                  {/* 1. Base Document Page Image Canvas */}
                  <canvas ref={previewCanvasRef} className="block max-w-none rounded-sm" />

                {/* 2. Detected Candidate Bounding Overlays */}
                {!isPeekingOriginal &&
                  candidates.map((cand) => {
                    if (!cand.imageBounds || !previewPageSize) return null;
                    const scaleX = canvasDims.width / previewPageSize.width;
                    const scaleY = canvasDims.height / previewPageSize.height;

                    const bx = cand.imageBounds.x * scaleX;
                    const by = canvasDims.height - (cand.imageBounds.y + cand.imageBounds.h) * scaleY;
                    const bw = cand.imageBounds.w * scaleX;
                    const bh = cand.imageBounds.h * scaleY;
                    const isSelected = selectedIds.has(cand.id);

                    return (
                      <div
                        key={cand.id}
                        style={{
                          position: "absolute",
                          left: bx,
                          top: by,
                          width: bw,
                          height: bh
                        }}
                        className={`pointer-events-none rounded transition-all z-15 ${
                          isSelected
                            ? "border-2 border-dashed border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/20"
                            : "border border-dashed border-slate-400/50 opacity-40"
                        }`}
                      >
                        <span className="absolute -top-5 left-0 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                          {cand.text ? cand.text.slice(0, 24) : "Filigran"}
                        </span>
                      </div>
                    );
                  })}

                {/* 3. Freehand Brush & Event Overlay Canvas */}
                <canvas
                  ref={brushCanvasRef}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                  className={`absolute inset-0 z-20 block max-w-none ${
                    isPeekingOriginal ? "opacity-0" : "opacity-100"
                  } ${
                    activeTool === "pick"
                      ? "cursor-pointer pointer-events-auto"
                      : activeTool === "brush"
                      ? "cursor-crosshair pointer-events-auto"
                      : "cursor-crosshair pointer-events-auto"
                  }`}
                />

                {/* 4. Hover text highlight in "Pick" mode */}
                {activeTool === "pick" && hoveredTextItem && previewPageSize && (
                  <div
                    style={{
                      position: "absolute",
                      left: hoveredTextItem.x * (canvasDims.width / previewPageSize.width),
                      top:
                        canvasDims.height -
                        (hoveredTextItem.y + hoveredTextItem.h) * (canvasDims.height / previewPageSize.height),
                      width: hoveredTextItem.w * (canvasDims.width / previewPageSize.width),
                      height: hoveredTextItem.h * (canvasDims.height / previewPageSize.height)
                    }}
                    className="border-2 border-indigo-500 bg-indigo-500/30 pointer-events-none rounded-xs z-25 transition-all shadow-md"
                  >
                    <span className="absolute -top-6 left-0 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                      🎯 Tıkla ve Sil: {hoveredTextItem.text}
                    </span>
                  </div>
                )}

                {/* 5. Active Drawing Box */}
                {activeDrawingBox && activeDrawingBox.w > 0 && activeDrawingBox.h > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: activeDrawingBox.x,
                      top: activeDrawingBox.y,
                      width: activeDrawingBox.w,
                      height: activeDrawingBox.h
                    }}
                    className="border-2 border-red-500 bg-red-500/20 pointer-events-none z-25 rounded-xs"
                  />
                )}

                {/* 6. Saved Manual Boxes */}
                {!isPeekingOriginal &&
                  manualBoxes.map((box) => (
                    <div
                      key={box.id}
                      style={{
                        position: "absolute",
                        left: box.x,
                        top: box.y,
                        width: box.w,
                        height: box.h
                      }}
                      className="border-2 border-dashed border-red-500 bg-red-500/20 group pointer-events-auto z-25 rounded-xs"
                    >
                      <div className="absolute -top-5 left-0 flex items-center gap-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                        <span>{box.label}</span>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            removeBox(box.id);
                          }}
                          className="hover:bg-red-700 rounded p-0.5 cursor-pointer ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Interactive Target Popover Bar for Clicked Element */}
            {selectedTextElement && (
              <div className="px-5 py-3 bg-indigo-950/90 border-t border-indigo-800 flex items-center justify-between gap-3 z-30 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs text-indigo-200 truncate">
                    Seçilen Filigran: <strong className="font-bold text-white">&ldquo;{selectedTextElement}&rdquo;</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuickRemoveText(selectedTextElement, "all")}
                    disabled={isApplying}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Tüm Sayfalardan Sil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRemoveText(selectedTextElement, "current")}
                    disabled={isApplying}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    Sadece Bu Sayfadan Sil
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTextElement(null)}
                    className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                    title="İptal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Intelligent Control Studio Panel */}
          <aside className="w-full md:w-80 lg:w-92 xl:w-96 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col justify-between overflow-hidden shrink-0">
            {/* Scrollable controls */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* HERO: 1-Click Auto Eradicate Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/70 via-slate-800 to-slate-900 border border-indigo-500/30 shadow-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">Tek Tıkla Akıllı Temizle</span>
                  </div>
                  {candidates.length > 0 && (
                    <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                      {candidates.length} Tespit Edildi
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300">
                  Sayfa renkleri, açıları ve glif baytları taranarak tüm filigranlar çevre yazılara sıfır hasarla yok edilir.
                </p>
                <button
                  type="button"
                  onClick={handleOneClickAutoClean}
                  disabled={isAutoCleaning || isApplying}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAutoCleaning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cerrahi Temizleniyor...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>⚡ Filigranları Otomatik Temizle</span>
                    </>
                  )}
                </button>
              </div>

              {/* Detected Watermark Candidates Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ScanText className="w-3.5 h-3.5 text-slate-400" />
                    Algılanan Filigranlar ({candidates.length})
                  </span>
                  {candidates.length > 0 && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-indigo-400 hover:underline cursor-pointer"
                      >
                        Tümünü Seç
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="text-slate-400 hover:underline cursor-pointer"
                      >
                        Temizle
                      </button>
                    </div>
                  )}
                </div>

                {isScanning ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    <span className="text-[11px]">Belge taranıyor (renk, açı, desen)...</span>
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 text-center space-y-1">
                    <p className="text-xs text-slate-300 font-medium">Otomatik filigran algılanamadı</p>
                    <p className="text-[10px] text-slate-500">
                      Soldaki tuvalden filigrana tıklayabilir veya fırça ile boyayabilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {candidates.map((cand) => {
                      const isSelected = selectedIds.has(cand.id);
                      return (
                        <div
                          key={cand.id}
                          onClick={() => toggleCandidate(cand.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                            isSelected
                              ? "bg-slate-800/90 border-indigo-500/60 shadow-sm"
                              : "bg-slate-950/40 border-slate-800 hover:border-slate-700 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCandidate(cand.id)}
                              className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-slate-100 truncate font-mono flex items-center gap-1.5">
                                {cand.type === "image" && (
                                  <ImageIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                )}
                                <span className="truncate">&ldquo;{cand.text}&rdquo;</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
                                {cand.type === "image" && (
                                  <span className="text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                    {cand.isLogoOrHeader ? "Logo / Antet" : "Görsel"}
                                  </span>
                                )}
                                {cand.angle ? (
                                  <span className="text-indigo-400 font-medium">{cand.angle}° Çapraz</span>
                                ) : null}
                                {cand.color && cand.color !== "#222222" && (
                                  <span className="flex items-center gap-1">
                                    <span
                                      className="w-2 h-2 rounded-full inline-block border border-white/20"
                                      style={{ backgroundColor: cand.color }}
                                    />
                                    {cand.color}
                                  </span>
                                )}
                                <span>· {cand.reason || "Filigran"}</span>
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              cand.confidence >= 80
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-indigo-500/20 text-indigo-300"
                            }`}
                          >
                            %{cand.confidence}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Text Eraser with Quick Chips */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  Özel Metin Sil
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Örn: GEÇERSİZ, ÖRNEK BELGEDİR..."
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  {customText && (
                    <button
                      type="button"
                      onClick={() => setCustomText("")}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_KEYWORDS.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setCustomText(kw)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                        customText === kw
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paper Tone Matching (For raster/scanned cleaning) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-400" />
                  Kağıt Rengi Eşitleme
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaperColorMode("auto")}
                    className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${
                      paperColorMode === "auto"
                        ? "bg-indigo-950/70 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: detectedPaperColor.hex }}
                    />
                    <span className="truncate">🪄 Oto Kağıt ({detectedPaperColor.hex.toUpperCase()})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaperColorMode("white")}
                    className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${
                      paperColorMode === "white"
                        ? "bg-indigo-950/70 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 shrink-0" />
                    <span>Saf Beyaz</span>
                  </button>
                </div>
              </div>

              {/* Page Scope Configuration */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Sayfa Kapsamı
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "all", label: `Tümü (${totalPages})` },
                    { id: "current", label: `Bu Sayfa (${activePage})` },
                    { id: "custom", label: "Özel" }
                  ].map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => setPageScope(scope.id as any)}
                      className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                        pageScope === scope.id
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>

                {pageScope === "custom" && (
                  <input
                    type="text"
                    value={customPagesStr}
                    onChange={(e) => setCustomPagesStr(e.target.value)}
                    placeholder="Örn: 1, 3, 5-10"
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 mt-1"
                  />
                )}
              </div>

            </div>

            {/* Panel Sticky Footer: Apply Actions */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isApplying || isAutoCleaning}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || isAutoCleaning || totalSelectedCount === 0}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer ${
                  totalSelectedCount > 0 && !isApplying && !isAutoCleaning
                    ? "bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white shadow-indigo-600/30 active:scale-[0.98]"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                }`}
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cerrahi Olarak Siliniyor...</span>
                  </>
                ) : (
                  <>
                    <Eraser className="w-4 h-4" />
                    <span>Seçilenleri Sil ve Uygula</span>
                    {totalSelectedCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
                        {totalSelectedCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </aside>
        </div>

        {/* Secondary Risk Confirmation Modal when Selecting All with Images */}
        {showImageRiskModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-100">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>Görsel ve Logo Koruma Uyarısı</span>
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Belgede <span className="font-semibold text-amber-400">{candidates.filter((c) => c.type === "image").length} adet görsel/antet</span> adayı bulundu.
                    Tümünü seçmek kurumsal logonuzun veya antetli başlığın silinmesine yol açabilir.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-300/90 leading-normal flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Öneri: Şirket logolarının korunması için yalnızca metin filigranlarını seçin.</span>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={selectOnlyTextCandidates}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Yalnızca Metinleri Seç (Önerilen & Güvenli)</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImageRiskModal(false)}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={confirmSelectAllWithImages}
                    className="flex-1 py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Görselleri de Seç
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Secondary Confirmation Modal for Manual Image/Logo Removal */}
        {showManualLogoModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
            <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-100">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>Görsel ve Logo Koruma Uyarısı</span>
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold text-amber-300">
                    Bu öğe logo, antet veya belge görseli olabilir.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-300/90 leading-normal flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Seçtiğiniz öğeler arasında görsel, antet veya kurumsal logo bulunmaktadır. Silme işlemini onaylıyor musunuz?</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualLogoModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center"
                >
                  İptal (Değişiklik Yapma)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowManualLogoModal(false);
                    confirmedLogoRemovalRef.current = true;
                    void executeApply(true).finally(() => {
                      confirmedLogoRemovalRef.current = false;
                    });
                  }}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer text-center shadow-md shadow-rose-600/30"
                >
                  Onayla ve Sil
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseCustomPages(str: string, maxPage: number): number[] {
  const pages: number[] = [];
  const parts = str.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(maxPage, end); i++) {
          pages.push(i - 1);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= maxPage) {
        pages.push(p - 1);
      }
    }
  }
  return Array.from(new Set(pages));
}
