"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  Highlighter,
  Italic,
  List,
  LoaderCircle,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  RotateCw,
  Scissors,
  Trash2,
  Type,
  Underline,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  Archive,
  Search,
  ScanText,
  Layers,
  ShieldCheck,
  FormInput,
  Sparkles,
  Eraser,
  Loader2,
  Stamp as StampIcon,
  EyeOff
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  download,
  exportPdf,
  extractPdfText,
  imagePdf,
  importWord,
  loadPdf,
  mergePdf,
  safeHtml,
  stem,
  wordDocx,
  wordPdf,
  type Mark,
  type PageItem
} from "@/lib/documents";
import { editablePageText, removePdfText, removePdfImages, canRemovePdfImage, type EditableText, type TextRemoval, type ImageRemoval } from "@/lib/pdf-text";
import { PDF_FONTS, pdfFont, type PdfFont } from "@/lib/pdf-fonts";
import { useAutosave } from "@/features/autosave/useAutosave";
import { AutosaveIndicator } from "@/features/autosave/AutosaveIndicator";
import type { FormaDraft } from "@/features/autosave/db";
import { OcrModal } from "@/features/ocr/OcrModal";
import type { OcrPageResult, OcrLine, OcrWord } from "@/features/ocr/ocrEngine";
import { CompressDialog } from "@/features/compression/CompressDialog";
import { ImageOverlay } from "@/features/image-editor/ImageOverlay";
import {
  TextEditControls,
  TextAddControls,
  HighlightControls,
  DrawControls,
  SignatureControls,
  ImageControls,
  PageActionsMenu
} from "@/features/toolbar";
import { detectImagesOnPage } from "@/features/image-editor/imageDetector";
import type { PdfImageItem, PdfDetectedImage, PdfImageEdit } from "@/features/image-editor/imageTypes";
import { FindReplaceBar } from "@/features/find-replace/FindReplaceBar";
import { PageOrganizerModal } from "@/features/page-organizer/PageOrganizerModal";
import { FormDesignerOverlay } from "@/features/forms/FormDesignerOverlay";
import { FormFieldsLayer } from "@/features/forms/FormFieldsLayer";
import { embedFormFieldsInPdf, extractFormFieldsFromPdf } from "@/features/forms/formBuilder";
import type { FormFieldItem } from "@/features/forms/formTypes";
import { SecurityDialog } from "@/features/security/SecurityDialog";
import { ToolHubModal, type ProfessionalToolId } from "@/features/hub/ToolHubModal";
import { DocumentScannerModal } from "@/features/scanner/DocumentScannerModal";
import { PageDecorationModal } from "@/features/page-decoration/PageDecorationModal";
import { AnnotationSidePanel } from "@/features/annotations/AnnotationSidePanel";
import { writeAnnotationsToPdf } from "@/features/annotations/annotationEngine";
import type { PdfAnnotation } from "@/features/annotations/annotationTypes";
import { PdfCompareModal } from "@/features/compare/PdfCompareModal";
import { BatchProcessingModal } from "@/features/batch/BatchProcessingModal";
import { NavigationModal } from "@/features/navigation/NavigationModal";
import { PageSizingModal } from "@/features/page-sizing/PageSizingModal";
import { AdvancedConversionModal } from "@/features/conversion/AdvancedConversionModal";
import { DigitalSignatureModal } from "@/features/digital-signature/DigitalSignatureModal";
import { ComplianceModal } from "@/features/compliance/ComplianceModal";
import { StampGeneratorModal } from "@/features/stamp/StampGeneratorModal";
import { DocumentEnhancerModal } from "@/features/enhancer/DocumentEnhancerModal";

type Snapshot = { pages: PageItem[]; marks: Mark[]; removals: TextRemoval[]; images?: PdfImageItem[] };
type Tool = "select" | "text" | "draw" | "highlight" | "signature";

const HANDLE_SIZE = 8;

function getTextDimensions(m: Mark) {
  const lines = (m.text || "").split("\n");
  const maxLen = Math.max(...lines.map(l => l.length), 1);
  const charW = m.font === "serif" ? 0.52 : 0.58;
  const textW = Math.ceil(maxLen * m.size * charW) + 8;
  const w = Math.max(textW, 25);
  const lineHeight = m.size * 1.25;
  const h = Math.max(Math.ceil(lines.length * lineHeight) + 4, m.size * 1.2);
  return { w, h };
}

function renderResizeHandles(
  bx: number,
  by: number,
  bw: number,
  bh: number,
  getHandler: (corner: "nw" | "ne" | "se" | "sw") => (e: React.PointerEvent) => void
) {
  const corners: { corner: "nw" | "ne" | "se" | "sw"; x: number; y: number }[] = [
    { corner: "nw", x: bx, y: by },
    { corner: "ne", x: bx + bw, y: by },
    { corner: "se", x: bx + bw, y: by + bh },
    { corner: "sw", x: bx, y: by + bh }
  ];

  return corners.map(({ corner, x, y }) => (
    <rect
      key={corner}
      className={`resize-handle ${corner}`}
      x={x - HANDLE_SIZE / 2}
      y={y - HANDLE_SIZE / 2}
      width={HANDLE_SIZE}
      height={HANDLE_SIZE}
      onPointerDown={getHandler(corner)}
    />
  ));
}

function splitLineIntoSegments(line: OcrLine, scaleX: number) {
  if (!line.words || line.words.length <= 1) {
    return [{ text: line.text, bbox: line.bbox }];
  }
  const segments: { text: string; bbox: { x: number; y: number; width: number; height: number } }[] = [];
  let curWords: OcrWord[] = [line.words[0]];

  for (let i = 1; i < line.words.length; i++) {
    const prev = line.words[i - 1];
    const curr = line.words[i];
    const gap = (curr.bbox.x - (prev.bbox.x + prev.bbox.width)) * scaleX;
    if (gap > 35) {
      const minX = curWords[0].bbox.x;
      const minY = Math.min(...curWords.map(w => w.bbox.y));
      const maxX = curWords[curWords.length - 1].bbox.x + curWords[curWords.length - 1].bbox.width;
      const maxY = Math.max(...curWords.map(w => w.bbox.y + w.bbox.height));
      segments.push({
        text: curWords.map(w => w.text).join(" "),
        bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      });
      curWords = [curr];
    } else {
      curWords.push(curr);
    }
  }

  if (curWords.length > 0) {
    const minX = curWords[0].bbox.x;
    const minY = Math.min(...curWords.map(w => w.bbox.y));
    const maxX = curWords[curWords.length - 1].bbox.x + curWords[curWords.length - 1].bbox.width;
    const maxY = Math.max(...curWords.map(w => w.bbox.y + w.bbox.height));
    segments.push({
      text: curWords.map(w => w.text).join(" "),
      bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    });
  }

  return segments;
}

function Choice({
  value,
  onChange,
  items,
  label
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="editor-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(i => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button {...props} className={`icon-button ${props.className || ""}`} aria-label={label} title={label}>
      {children}
    </button>
  );
}

function TextFields({
  value,
  onChange,
  onBlur
}: {
  value: Mark;
  onChange: (v: Partial<Mark>) => void;
  onBlur?: () => void;
}) {
  return (
    <>
      <label>
        Metin
        <textarea
          aria-label="Seçili metin"
          rows={3}
          value={value.text || ""}
          onChange={e => onChange({ text: e.target.value })}
          onBlur={onBlur}
        />
      </label>
      <label>
        Yazı tipi
        <Choice
          label="Yazı tipi"
          value={value.font || "sans"}
          onChange={v =>
            onChange({
              font: v as PdfFont,
              bold: value.bold,
              italic: value.italic
            })
          }
          items={[...PDF_FONTS]}
        />
      </label>
      <div className="text-format-row">
        <label>
          Boyut
          <input
            aria-label="Yazı boyutu"
            type="number"
            min="4"
            max="200"
            value={value.size}
            onChange={e =>
              onChange({ size: Math.max(4, Math.min(200, Number(e.target.value) || 16)) })
            }
          />
        </label>
        <IconButton
          label="Kalın yazı"
          aria-pressed={!!value.bold}
          onClick={() => onChange({ bold: !value.bold })}
        >
          <Bold size={17} />
        </IconButton>
        <IconButton
          label="İtalik yazı"
          aria-pressed={!!value.italic}
          onClick={() => onChange({ italic: !value.italic })}
        >
          <Italic size={17} />
        </IconButton>
      </div>
    </>
  );
}

export default function Workspace({
  files,
  intent,
  initialDraft,
  onClose,
  onOpen,
  onDirty
}: {
  files: File[];
  intent: string;
  initialDraft?: FormaDraft;
  onClose: () => void;
  onOpen: (s: string) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const [kind, setKind] = useState<"pdf" | "word">("pdf");
  const [name, setName] = useState(stem(files[0].name));
  const [busy, setBusy] = useState("Belgen açılıyor…");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [exit, setExit] = useState(false);

  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showOcr, setShowOcr] = useState(intent === "ocr");
  const [showCompress, setShowCompress] = useState(intent === "compress");
  const [showPageOrganizer, setShowPageOrganizer] = useState(intent === "pages");
  const [isCleaningWatermarks, setIsCleaningWatermarks] = useState(false);
  const [showSecurity, setShowSecurity] = useState(intent === "kvkk");
  const [showStampModal, setShowStampModal] = useState(intent === "stamp");
  const [showToolHub, setShowToolHub] = useState(false);
  const [activeProfessionalTool, setActiveProfessionalTool] = useState<ProfessionalToolId | null>(
    intent === "convert"
      ? "conversion"
      : ["scanner", "decoration", "navigation", "annotations", "compare", "batch", "page-sizing", "conversion", "signature", "compliance", "stamp", "kvkk"].includes(intent as any)
      ? (intent as ProfessionalToolId)
      : null
  );
  const [formMode, setFormMode] = useState<"none" | "design" | "fill">("none");
  const [formFields, setFormFields] = useState<FormFieldItem[]>([]);
  const [detectedImages, setDetectedImages] = useState<PdfDetectedImage[]>([]);
  const [imageEdits, setImageEdits] = useState<PdfImageEdit[]>([]);
  const pageImages = imageEdits;
  const setPageImages = setImageEdits;
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [pdfAnnotations, setPdfAnnotations] = useState<PdfAnnotation[]>([]);

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [state, setState] = useState<Snapshot>({ pages: [], marks: [], removals: [] });
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);

  const [active, setActive] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedOriginal, setSelectedOriginal] = useState<EditableText | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  if (typeof window !== "undefined") {
    (window as any).__setZoomForTest = (z: number) => setZoom(z);
  }
  const [color, setColor] = useState("#30294d");
  const [text, setText] = useState("Yeni metin");
  const [size, setSize] = useState(16);
  const [sig, setSig] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [format, setFormat] = useState("pdf");
  const [range, setRange] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [flattenForms, setFlattenForms] = useState(false);
  const [highlightColor, setHighlightColor] = useState("#ffeb3b");
  const [highlightOpacity, setHighlightOpacity] = useState(0.35);
  const [highlightHeight, setHighlightHeight] = useState(24);
  const [drawColor, setDrawColor] = useState("#30294d");
  const [drawSize, setDrawSize] = useState(2);
  const [drawOpacity, setDrawOpacity] = useState(1);
  const [isEraser, setIsEraser] = useState(false);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");

  const [dimensions, setDimensions] = useState({ width: 595, height: 842, baseWidth: 595, baseHeight: 842 });
  const [rendering, setRendering] = useState(false);
  if (typeof window !== "undefined") {
    (window as any).__isRendering = rendering;
  }
  const [count, setCount] = useState(0);
  const [draft, setDraft] = useState<Mark | null>(null);
  const draftRef = useRef<Mark | null>(null);
  function applyDraft(m: Mark | null) {
    draftRef.current = m;
    setDraft(m);
  }

  if (typeof window !== "undefined" && (window as any).__isTestingDrag && (window as any).__dragTestCounters) {
    (window as any).__dragTestCounters.reactRenderCount++;
    (window as any).__lastRenderReasons = (window as any).__lastRenderReasons || [];
    (window as any).__lastRenderReasons.push({
      time: Date.now(),
      state: { rendering, busy, zoom, active, selectedImageId, imageEditsCount: imageEdits.length }
    });
  }

  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const mergeInput = useRef<HTMLInputElement>(null);
  const htmlRef = useRef("<p><br></p>");
  const selection = useRef<Range | null>(null);
  const gesture = useRef<any>(null);
  const renderTask = useRef<any>(null);
  const sessionInitialRef = useRef<Snapshot | null>(null);
  const commitTimerRef = useRef<any>(null);
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);

  const [textItems, setTextItems] = useState<EditableText[]>([]);
  const [ocrItemsByPage, setOcrItemsByPage] = useState<Record<number, EditableText[]>>({});
  const [allOriginalTexts, setAllOriginalTexts] = useState<EditableText[]>([]);
  const [textLoading, setTextLoading] = useState(false);
  const [font, setFont] = useState<PdfFont>("roboto");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);

  const handleApplyOcr = useCallback(async (ocrResults: OcrPageResult[]) => {
    if (!pdf || !ocrResults.length) return;
    
    const newOcrMap: Record<number, EditableText[]> = { ...ocrItemsByPage };

    for (const res of ocrResults) {
      const pageIndex = res.pageNumber - 1;
      let baseWidth = dimensions.baseWidth;
      let baseHeight = dimensions.baseHeight;

      try {
        const page = await pdf.getPage(res.pageNumber);
        const vp = page.getViewport({ scale: 1 });
        baseWidth = vp.width;
        baseHeight = vp.height;
      } catch {}

      const scaleX = baseWidth / res.width;
      const scaleY = baseHeight / res.height;
      const pageItems: EditableText[] = [];

      res.lines.forEach((line, lineIdx) => {
        const segments = splitLineIntoSegments(line, scaleX);
        
        segments.forEach((seg, segIdx) => {
          const segX = seg.bbox.x * scaleX;
          const segY = seg.bbox.y * scaleY;
          const segW = seg.bbox.width * scaleX;
          const segH = seg.bbox.height * scaleY;
          const fontSize = Math.max(8, Math.min(72, Math.round(segH * 0.82)));

          const quad = [
            segX, segY,
            segX + segW, segY,
            segX, segY + segH,
            segX + segW, segY + segH
          ];

          pageItems.push({
            id: `ocr-${pageIndex}-${lineIdx}-${segIdx}`,
            page: pageIndex,
            quad,
            text: seg.text,
            x: segX,
            y: segY,
            w: segW,
            h: segH,
            size: fontSize,
            angle: 0,
            fontName: "sans",
            fontFamily: "sans",
            originalFontName: "LiberationSans",
            bold: false,
            italic: false,
            color: "#000000",
            isOcr: true
          });
        });
      });

      newOcrMap[pageIndex] = pageItems;
    }

    setOcrItemsByPage(newOcrMap);
    const activePageItems = newOcrMap[active] || [];
    if (activePageItems.length > 0) {
      setTextItems(prev => [...prev.filter(p => !(p as any).isOcr), ...activePageItems]);
      setSelectedOriginal(activePageItems[0]);
    }
    setTool("select");
    setShowOcr(false);
    toast.success(`${activePageItems.length} metin bloğu sayfada düzenlemeye hazır!`);
  }, [pdf, dimensions, ocrItemsByPage, active]);
  const [viewPdf, setViewPdf] = useState<any>(null);
  const [previewError, setPreviewError] = useState("");
  const cleanCache = useRef(new WeakMap<TextRemoval[], { source: Uint8Array; result: Uint8Array }>());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
    if (typeof window !== "undefined") {
      (window as any).__formaEditorState = {
        state,
        active,
        dirty,
        zoom,
        formFields,
        pageImages,
        bytes
      };
    }
  }, [state, active, dirty, zoom, formFields, pageImages, bytes]);

  const { clearCurrentDraft } = useAutosave({
    file: files[0] || null,
    type: kind,
    bytes,
    marks: state.marks,
    removals: state.removals,
    wordContent: kind === "word" ? (editor.current?.innerHTML || htmlRef.current) : undefined,
    pageRotations: Object.fromEntries(state.pages.map((p, i) => [i, p.rotation])),
    currentPage: active + 1,
    formFields,
    pageImages: imageEdits.filter(i => i.isModified || i.deleted || !i.isOriginal),
    pageOrder: state.pages.map((p) => p.index),
    annotations: pdfAnnotations,
    zoom,
    isDirty: dirty,
    intent,
    enabled: dirty,
    isDragging: isDraggingImage
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowFindReplace(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowToolHub((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleApplyProfessionalPdf = async (newPdfBytes: Uint8Array) => {
    try {
      const next = await loadPdf(newPdfBytes);
      renderTask.current?.cancel();
      setPdf((old: any) => {
        void old?.loadingTask.destroy().catch(() => {});
        return next;
      });
      setBytes(newPdfBytes);
      setKind("pdf");
      const newPages = Array.from({ length: next.numPages }, (_, index) => ({
        index,
        rotation: 0
      }));
      setState((prev) => ({
        ...prev,
        pages: newPages,
      }));
      setActive(0);
      setDirty(true);
      toast.success("Değişiklikler başarıyla uygulandı.");
    } catch (err) {
      console.error("Failed to reload PDF after applying professional tool:", err);
      setBytes(newPdfBytes);
      setDirty(true);
      toast.success("Değişiklikler uygulandı.");
    }
  };

  const handleOneClickWatermarkRemoval = async () => {
    if (!bytes) {
      toast.error("Lütfen önce bir PDF belgesi açın.");
      return;
    }

    setIsCleaningWatermarks(true);
    const toastId = toast.loading("⚡ Belgedeki tüm filigranlar taranıyor ve kusursuz temizleniyor...");

    try {
      // 1. Detect candidate watermarks via surgical vector & metadata inspection
      const { detectWatermarks } = await import("@/features/watermark-removal/watermarkDetector");
      const candidates = await detectWatermarks(bytes);

      // 2. Only if no vector watermark candidates were found (e.g. scanned document or flat image PDF),
      // fall back to visual OCR to prevent drawing opaque covers over legitimate vector text!
      let visualCands: any[] = [];
      if (candidates.length === 0 && typeof window !== "undefined") {
        try {
          const { detectVisualWatermarks } = await import("@/features/watermark-removal/visualWatermarkDetector");
          visualCands = await detectVisualWatermarks(bytes, 0);
        } catch {}
      }

      const allCandidates = [...candidates, ...visualCands];

      // Automatically sample authentic page background tone
      let fillColor = { r: 1, g: 1, b: 1 };
      try {
        const { renderPdfPageToCanvas, detectPageBackgroundColor } = await import("@/features/watermark-removal/visualWatermarkDetector");
        const { canvas } = await renderPdfPageToCanvas(bytes, 0, 1.0);
        const bg = detectPageBackgroundColor(canvas);
        if (bg) fillColor = { r: bg.r, g: bg.g, b: bg.b };
      } catch {}

      const { removeWatermarks } = await import("@/features/watermark-removal/watermarkRemover");
      const result = await removeWatermarks(bytes, allCandidates, {
        candidateIds: allCandidates.map(c => c.id),
        pageScope: "all",
        currentPage: active + 1,
        fillColor
      });

      if (typeof window !== "undefined") {
        (window as any).__lastWatermarkResult = { candidates: allCandidates, result };
      }

      if (result.totalRemoved > 0) {
        await handleApplyProfessionalPdf(result.pdfBytes);
        toast.success(
          `🎉 ${result.totalRemoved} adet filigran çevre yazılara sıfır hasarla tek tıkla kusursuz temizlendi!`,
          { id: toastId, duration: 4500 }
        );
      } else {
        toast.info("Belgenizde belirgin bir filigran veya taslak damgası tespit edilmedi. Belgeniz zaten tertemiz.", { id: toastId });
      }
    } catch (err: any) {
      console.error("1-click watermark removal error:", err);
      toast.error("Filigran temizleme sırasında hata oluştu: " + (err.message || ""), { id: toastId });
    } finally {
      setIsCleaningWatermarks(false);
    }
  };

  // Auto-run 1-click watermark cleaner if opened with intent: "watermark"
  const autoCleanWatermarkDone = useRef(false);
  useEffect(() => {
    if ((intent === "watermark" || intent === "remove-watermark") && bytes && !autoCleanWatermarkDone.current) {
      autoCleanWatermarkDone.current = true;
      void handleOneClickWatermarkRemoval();
    }
  }, [intent, bytes]);

  // Detect and maintain images across pages
  useEffect(() => {
    if (!pdf || kind !== "pdf") return;
    let mounted = true;
    const pageRotation = state.pages[active]?.rotation || 0;
    pdf.getPage(active + 1).then((p: any) => {
      return detectImagesOnPage(p, active, pageRotation);
    }).then((imgs: PdfImageItem[]) => {
      if (mounted) {
        setDetectedImages((prev) => {
          const existingThisPage = prev.filter((img) => img.page === active);
          if (existingThisPage.length > 0) return prev;
          const others = prev.filter((img) => img.page !== active);
          return [...others, ...(imgs as PdfDetectedImage[])];
        });
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [pdf, active, kind, state.pages]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      pageImages.forEach(img => {
        if (img.previewUrl?.startsWith("blob:")) {
          try { URL.revokeObjectURL(img.previewUrl); } catch {}
        }
      });
    };
  }, [pageImages]);

  // Extract all pages' original text for document-wide find & replace
  useEffect(() => {
    if (!pdf || kind !== "pdf") {
      setAllOriginalTexts([]);
      return;
    }
    let stopped = false;
    (async () => {
      const all: EditableText[] = [];
      for (let i = 0; i < pdf.numPages; i++) {
        if (stopped) return;
        try {
          const page = await pdf.getPage(i + 1);
          const items = await editablePageText(page);
          const ocrItems = ocrItemsByPage[i] || [];
          all.push(...items, ...ocrItems);
        } catch {
          const ocrItems = ocrItemsByPage[i] || [];
          all.push(...ocrItems);
        }
      }
      if (!stopped) setAllOriginalTexts(all);
    })();
    return () => {
      stopped = true;
    };
  }, [pdf, kind, ocrItemsByPage]);

  const current = state.pages[active];
  const currentMark = state.marks.find(m => m.id === selected);
  const activeMark = draft && draft.id === selected ? draft : currentMark;

  const hydrated = useRef(false);
  const pdfRef = useRef<any>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    onDirty?.(dirty);
    return () => onDirty?.(false);
  }, [dirty, onDirty]);

  useEffect(() => {
    pdfRef.current = pdf;
  }, [pdf]);

  useEffect(() => {
    return () => {
      void pdfRef.current?.loadingTask.destroy().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (editingId && inlineTextareaRef.current) {
      const el = inlineTextareaRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editingId]);

  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (spec: any) => {
      try {
        Promise.resolve(ctx.registerTool(spec, { signal: lifecycle.signal })).catch(() => {});
      } catch {}
    };
    register({
      name: "read_document_status",
      description: "Read the open document type, page count, current page, and unsaved-change status. Does not expose document contents.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => ({
        type: kind,
        pages: state.pages.length,
        currentPage: active + 1,
        annotations: state.marks.length,
        unsaved: dirty,
        busy: !!busy
      })
    });
    register({
      name: "add_pdf_text",
      description: "Add a visible text annotation to the currently selected PDF page. Does not download the file.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", minLength: 1, maxLength: 300 },
          x: { type: "number", minimum: 0 },
          y: { type: "number", minimum: 0 }
        },
        required: ["text", "x", "y"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false },
      execute: async (input: any) => {
        if (kind !== "pdf" || !current || busy) throw Error("No PDF is ready.");
        if (
          typeof input?.text !== "string" ||
          !input.text.trim() ||
          input.text.length > 300 ||
          !Number.isFinite(input.x) ||
          !Number.isFinite(input.y) ||
          input.x < 0 ||
          input.y < 0 ||
          input.x > dimensions.baseWidth ||
          input.y > dimensions.baseHeight
        )
          throw Error("Invalid text or page position.");
        const mark = { ...newMark("text", input.x, input.y), text: input.text };
        addMark(mark);
        await new Promise(requestAnimationFrame);
        return { added: true, page: active + 1, id: mark.id };
      }
    });
    return () => lifecycle.abort();
  }, [kind, state, active, dirty, busy, dimensions]);

  function change(next: Snapshot) {
    setHistory(h => [...h.slice(-39), state]);
    setFuture([]);
    setState(next);
    setDirty(true);
  }

  function commitSession(initialSnapshot: Snapshot, nextState: Snapshot) {
    const marksChanged = JSON.stringify(initialSnapshot.marks) !== JSON.stringify(nextState.marks);
    const removalsChanged = JSON.stringify(initialSnapshot.removals) !== JSON.stringify(nextState.removals);
    if (!marksChanged && !removalsChanged) {
      setState(nextState);
      return;
    }
    setHistory(h => [...h.slice(-39), initialSnapshot]);
    setFuture([]);
    setState(nextState);
    setDirty(true);
  }

  function undo() {
    if (!history.length) return;
    finishInlineEdit();
    setSelectedOriginal(null);
    setFuture(f => [{ ...state, images: pageImages }, ...f]);
    const next = history[history.length - 1];
    setState(next);
    if (next.images) setPageImages(next.images);
    setHistory(h => h.slice(0, -1));
    setActive(a => Math.min(a, next.pages.length - 1));
    setSelected(null);
    setDirty(true);
  }

  function redo() {
    if (!future.length) return;
    finishInlineEdit();
    setSelectedOriginal(null);
    setHistory(h => [...h, { ...state, images: pageImages }]);
    const next = future[0];
    setState(next);
    if (next.images) setPageImages(next.images);
    setActive(a => Math.min(a, next.pages.length - 1));
    setFuture(f => f.slice(1));
    setSelected(null);
    setDirty(true);
  }

  async function installPdf(data: Uint8Array) {
    const next = await loadPdf(data);
    if (!alive.current) {
      await next.loadingTask.destroy();
      return;
    }
    setPdf((old: any) => {
      void old?.loadingTask.destroy().catch(() => {});
      return next;
    });
    setBytes(data);
    const restoredMarks = initialDraft?.marks || [];
    const restoredRemovals = initialDraft?.removals || [];
    const initialPages = initialDraft?.pageOrder?.length
      ? initialDraft.pageOrder.map((idx) => ({
          index: idx,
          rotation: initialDraft?.pageRotations?.[idx] ?? 0
        }))
      : Array.from({ length: next.numPages }, (_, index) => ({
          index,
          rotation: initialDraft?.pageRotations?.[index] ?? 0
        }));
    setState({ pages: initialPages, marks: restoredMarks, removals: restoredRemovals });
    setHistory([]);
    setFuture([]);
    setActive(initialDraft?.currentPage ? Math.max(0, initialDraft.currentPage - 1) : 0);
    setSelected(null);
    setSelectedOriginal(null);
    setEditingId(null);
    setKind("pdf");
    if (initialDraft?.formFields?.length) {
      setFormFields(initialDraft.formFields);
    } else {
      void extractFormFieldsFromPdf(data).then((fields) => {
        if (fields.length) setFormFields(fields);
      }).catch(() => {});
    }
    setDetectedImages([]);
    setSelectedImageId(null);
    if (initialDraft?.imageEdits?.length || initialDraft?.pageImages?.length) {
      const draftImgs = (initialDraft.imageEdits || initialDraft.pageImages || []).filter(
        (img: any) => img.isModified || img.deleted || !img.isOriginal
      );
      setImageEdits(draftImgs);
    } else {
      setImageEdits([]);
    }
    if (initialDraft?.annotations?.length) {
      setPdfAnnotations(initialDraft.annotations);
    }
    if (initialDraft?.zoom) {
      setZoom(initialDraft.zoom);
    }
    if (
      restoredMarks.length ||
      restoredRemovals.length ||
      initialDraft?.formFields?.length ||
      initialDraft?.pageImages?.length ||
      initialDraft?.annotations?.length
    ) {
      setDirty(true);
    }
  }

  useEffect(() => {
    let stopped = false;
    async function start() {
      try {
        const first = files[0];
        if (/\.(docx|txt)$/i.test(first.name)) {
          let html = await importWord(first);
          if (stopped) return;
          if (initialDraft?.wordContent) {
            html = initialDraft.wordContent;
            setDirty(true);
          }
          htmlRef.current = html;
          setKind("word");
          setCount(html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length);
          setFormat(intent === "convert" ? "pdf" : "docx");
        } else {
          const data = /\.(png|jpe?g)$/i.test(first.name)
            ? await imagePdf(files)
            : files.length > 1
            ? await mergePdf(files)
            : new Uint8Array(await first.arrayBuffer());
          if (stopped) return;
          await installPdf(data);
          if (intent === "sign") setSignOpen(true);
          if (intent === "stamp") setShowStampModal(true);
          if (intent === "kvkk") setShowSecurity(true);
          if (intent === "convert" || intent === "conversion") setActiveProfessionalTool("conversion");
          else if (["scanner", "decoration", "navigation", "annotations", "compare", "batch", "page-sizing", "compliance"].includes(intent)) {
            setActiveProfessionalTool(intent as ProfessionalToolId);
          }
        }
      } catch (e) {
        if (!stopped)
          setError(
            /encrypt|password/i.test(String(e))
              ? "Bu PDF şifreli. Önce parolasını kaldırarak yeniden aç."
              : "Bu dosya açılamadı. Dosyanın geçerli ve bozulmamış bir PDF veya DOCX olduğundan emin ol."
          );
      } finally {
        if (!stopped) setBusy("");
      }
    }
    void start();
    return () => {
      stopped = true;
    };
  }, [files, intent]);

  useEffect(() => {
    if (kind === "word" && !busy && editor.current && !hydrated.current) {
      editor.current.innerHTML = htmlRef.current;
      hydrated.current = true;
    }
  }, [kind, busy]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    return () => {
      renderTask.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!viewPdf || !current || !canvas.current || kind !== "pdf") return;
    let cancelled = false;
    const prevTask = renderTask.current;
    if (prevTask) {
      try {
        prevTask.cancel();
      } catch {}
    }
    setRendering(true);
    if (typeof window !== "undefined" && (window as any).__dragTestCounters) {
      (window as any).__dragTestCounters.canvasRenderCount++;
    }
    void (async () => {
      try {
        if (prevTask) {
          try {
            await prevTask.promise;
          } catch {}
        }
        if (cancelled) return;
        const page = await viewPdf.getPage(current.index + 1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const view = page.getViewport({ scale: 1, rotation: (page.rotate + current.rotation) % 360 });
        setDimensions({ width: view.width, height: view.height, baseWidth: base.width, baseHeight: base.height });
        const c = canvas.current;
        if (!c || cancelled) return;
        const viewport = page.getViewport({
          scale: Math.min(window.devicePixelRatio || 1, 2) * zoom,
          rotation: (page.rotate + current.rotation) % 360
        });
        // Offscreen-first rendering: avoids white flash and flickering
        const offscreen = document.createElement("canvas");
        offscreen.width = viewport.width;
        offscreen.height = viewport.height;
        const offCtx = offscreen.getContext("2d");
        if (!offCtx || cancelled) return;

        const task = page.render({ canvasContext: offCtx, canvas: offscreen, viewport });
        renderTask.current = task;
        await task.promise;
        if (cancelled) return;

        if (c.width !== viewport.width || c.height !== viewport.height) {
          c.width = viewport.width;
          c.height = viewport.height;
        }
        const visibleCtx = c.getContext("2d");
        if (visibleCtx) {
          visibleCtx.drawImage(offscreen, 0, 0);
        }
        if (!cancelled) setRendering(false);
      } catch (e) {
        if (!cancelled && !/RenderingCancelled|cancelled/i.test(String(e))) {
          toast.error("Sayfa görüntülenemedi.");
          setRendering(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTask.current?.cancel();
    };
  }, [viewPdf, current?.index, current?.rotation, zoom, kind, busy]);

  useEffect(() => {
    finishInlineEdit();
    setSelected(null);
    setSelectedOriginal(null);
  }, [active, tool]);

  useEffect(() => {
    let stopped = false;
    const currentOcr = ocrItemsByPage[current?.index ?? -1] || [];
    if (currentOcr.length > 0) {
      setTextItems(currentOcr);
    } else {
      setTextItems([]);
    }
    if (!pdf || !current) return;
    setTextLoading(true);
    void pdf
      .getPage(current.index + 1)
      .then(editablePageText)
      .then((items: EditableText[]) => {
        if (!stopped) {
          const ocrItems = ocrItemsByPage[current.index] || [];
          if (items.length === 0 && ocrItems.length > 0) {
            setTextItems(ocrItems);
          } else if (items.length > 0 && ocrItems.length > 0) {
            const existingIds = new Set(ocrItems.map(o => o.id));
            setTextItems([...items.filter(i => !existingIds.has(i.id)), ...ocrItems]);
          } else {
            setTextItems(items);
          }
        }
      })
      .catch(() => {
        if (!stopped) {
          const ocrItems = ocrItemsByPage[current.index] || [];
          if (ocrItems.length > 0) {
            setTextItems(ocrItems);
          } else {
            toast.error("Bu sayfanın metni okunamadı.");
          }
        }
      })
      .finally(() => {
        if (!stopped) setTextLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [pdf, current?.index, ocrItemsByPage]);

  const modifiedImagesKey = pageImages
    .filter(img => img.page === active && (img.deleted || img.isModified))
    .map(i => `${i.id}-${i.deleted}-${i.isModified}-${i.x}-${i.y}`)
    .join(",");

  useEffect(() => {
    let stopped = false;
    let owned: Awaited<ReturnType<typeof loadPdf>> | null = null;
    if (!bytes || !pdf) {
      setViewPdf(null);
      return;
    }
    void (async () => {
      setPreviewError("");
      setRendering(true);
      try {
        const imageRemovals: ImageRemoval[] = pageImages
          .filter(
            img =>
              img.page === active &&
              img.isOriginal &&
              img.originalBounds &&
              (img.isModified || img.deleted)
          )
          .map(img => ({
            page: img.page,
            bounds: img.originalBounds,
            imageId: img.id,
            objectRef: img.objectRef,
            imageIndex: img.imageIndex,
            pixelWidth: img.pixelWidth,
            pixelHeight: img.pixelHeight,
            matrix: img.matrix
          }));

        if (!state.removals.length && !imageRemovals.length) {
          setViewPdf(pdf);
          setRendering(false);
          return;
        }
        let clean = bytes;
        if (state.removals.length) {
          const cached = cleanCache.current.get(state.removals);
          clean = cached?.source === bytes ? cached.result : await removePdfText(bytes, state.removals);
          cleanCache.current.set(state.removals, { source: bytes, result: clean });
        }
        if (imageRemovals.length) {
          clean = await removePdfImages(clean, imageRemovals);
        }
        const next = await loadPdf(clean);
        if (stopped) {
          await next.loadingTask.destroy();
          return;
        }
        owned = next;
        setViewPdf(next);
      } catch (e) {
        if (!stopped) {
          setPreviewError((e as Error).message);
          setRendering(false);
        }
      }
    })();
    return () => {
      stopped = true;
      renderTask.current?.cancel();
      if (owned) void owned.loadingTask.destroy().catch(() => {});
    };
  }, [bytes, pdf, state.removals, active, modifiedImagesKey]);

  const cleanCanvasCache = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Pre-render clean canvases for detected images on the current page during idle time
  useEffect(() => {
    if (!bytes || !pdf || !canvas.current || kind !== "pdf") return;
    let cancelled = false;

    const pageDetected = detectedImages.filter(d => d.page === active && d.isMovable !== false);
    if (pageDetected.length === 0) return;

    const preRender = async () => {
      for (const det of pageDetected) {
        if (cancelled) break;
        if (cleanCanvasCache.current.has(det.id)) continue;
        try {
          const removal: ImageRemoval = {
            page: det.page,
            bounds: det.originalBounds,
            imageId: det.id,
            objectRef: det.objectRef,
            imageIndex: det.imageIndex,
            pixelWidth: det.pixelWidth,
            pixelHeight: det.pixelHeight,
            matrix: det.matrix
          };
          const cleanBytes = await removePdfImages(bytes, [removal]);
          if (cancelled) break;
          const cleanDoc = await loadPdf(cleanBytes);
          const p = await cleanDoc.getPage(active + 1);
          const c = canvas.current;
          if (!c || cancelled) {
            void cleanDoc.loadingTask.destroy().catch(() => {});
            break;
          }
          const off = document.createElement("canvas");
          off.width = c.width;
          off.height = c.height;
          const offCtx = off.getContext("2d");
          if (!offCtx) {
            void cleanDoc.loadingTask.destroy().catch(() => {});
            continue;
          }
          const viewport = p.getViewport({
            scale: Math.min(window.devicePixelRatio || 1, 2) * zoom,
            rotation: (p.rotate + (current?.rotation || 0)) % 360
          });
          const task = p.render({ canvasContext: offCtx, canvas: off, viewport });
          await task.promise;
          void cleanDoc.loadingTask.destroy().catch(() => {});
          if (!cancelled) {
            cleanCanvasCache.current.set(det.id, off);
          }
        } catch {}
      }
    };

    const timer = setTimeout(preRender, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bytes, pdf, active, kind, zoom, detectedImages, current?.rotation]);

  // Function to prepare and apply clean background atomically
  const handleRequestEdit = useCallback(async (detImg: PdfDetectedImage) => {
    if (!bytes || !pdf || !canvas.current || kind !== "pdf") return;
    if (detImg.isMovable === false) {
      toast.error("Bu görsel korumalı PDF yapısı nedeniyle taşınamaz.");
      return;
    }

    const existing = imageEdits.find(e => e.id === detImg.id);
    if (existing) {
      setSelectedImageId(detImg.id);
      return;
    }

    const c = canvas.current;
    if (!c) return;

    // Check if we have an offscreen canvas ready in cache
    const cachedOffscreen = cleanCanvasCache.current.get(detImg.id);
    if (cachedOffscreen && cachedOffscreen.width === c.width && cachedOffscreen.height === c.height) {
      requestAnimationFrame(() => {
        const visibleCtx = c.getContext("2d");
        if (visibleCtx) {
          visibleCtx.drawImage(cachedOffscreen, 0, 0);
        }
        const newEdit: PdfImageEdit = {
          ...detImg,
          dataUrl: detImg.dataUrl || "",
          format: detImg.format || "png",
          opacity: detImg.opacity ?? 1,
          isOriginal: true,
          isModified: false,
          deleted: false
        };
        setImageEdits(prev => [...prev.filter(e => e.id !== detImg.id), newEdit]);
        setSelectedImageId(detImg.id);
      });
      return;
    }

    const removal: ImageRemoval = {
      page: detImg.page,
      bounds: detImg.originalBounds,
      imageId: detImg.id,
      objectRef: detImg.objectRef,
      imageIndex: detImg.imageIndex,
      pixelWidth: detImg.pixelWidth,
      pixelHeight: detImg.pixelHeight,
      matrix: detImg.matrix
    };

    const canRemove = await canRemovePdfImage(bytes, removal);
    if (!canRemove) {
      setDetectedImages(prev => prev.map(item => item.id === detImg.id ? { ...item, isMovable: false } : item));
      toast.error("Bu görsel korumalı PDF yapısı nedeniyle taşınamaz.");
      return;
    }

    try {
      let clean = bytes;
      if (state.removals.length) {
        const cached = cleanCache.current.get(state.removals);
        clean = cached?.source === bytes ? cached.result : await removePdfText(bytes, state.removals);
      }
      const existingRemovals = imageEdits
        .filter(e => e.page === active && e.isOriginal && (e.isModified || e.deleted) && e.originalBounds)
        .map(e => ({
          page: e.page,
          bounds: e.originalBounds!,
          imageId: e.id,
          objectRef: e.objectRef,
          imageIndex: e.imageIndex,
          pixelWidth: e.pixelWidth,
          pixelHeight: e.pixelHeight,
          matrix: e.matrix
        }));

      const allRemovals = [...existingRemovals, removal];
      const cleanBytes = await removePdfImages(clean, allRemovals);

      const cleanDoc = await loadPdf(cleanBytes);
      const page = await cleanDoc.getPage(active + 1);

      const offscreen = document.createElement("canvas");
      offscreen.width = c.width;
      offscreen.height = c.height;
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) {
        void cleanDoc.loadingTask.destroy().catch(() => {});
        return;
      }

      const viewport = page.getViewport({
        scale: Math.min(window.devicePixelRatio || 1, 2) * zoom,
        rotation: (page.rotate + (current?.rotation || 0)) % 360
      });

      const task = page.render({ canvasContext: offCtx, canvas: offscreen, viewport });
      await task.promise;
      void cleanDoc.loadingTask.destroy().catch(() => {});

      requestAnimationFrame(() => {
        const visibleCtx = c.getContext("2d");
        if (visibleCtx) {
          visibleCtx.drawImage(offscreen, 0, 0);
        }
        const newEdit: PdfImageEdit = {
          ...detImg,
          dataUrl: detImg.dataUrl || "",
          format: detImg.format || "png",
          opacity: detImg.opacity ?? 1,
          isOriginal: true,
          isModified: false,
          deleted: false
        };
        setImageEdits(prev => [...prev.filter(e => e.id !== detImg.id), newEdit]);
        setSelectedImageId(detImg.id);
      });
    } catch (err) {
      console.warn("Could not prepare atomic clean background:", err);
    }
  }, [bytes, pdf, kind, state.removals, imageEdits, active, zoom, current]);

  function convertOriginalToMark(item: EditableText, updates: Partial<Mark>, isSession = false): Mark {
    const removals = state.removals.some(r => r.id === item.id)
      ? state.removals
      : [...state.removals, { id: item.id, page: item.page, quad: item.quad }];

    const isOcr = Boolean((item as any).isOcr || item.id.startsWith("ocr-"));
    const existing = state.marks.find(m => m.sourceId === item.id);
    const baseMark: Mark = existing
      ? { ...existing, ...updates }
      : {
          id: crypto.randomUUID(),
          page: item.page,
          kind: "text",
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          size: Math.round(item.size * 10) / 10,
          color: item.color || "#222222",
          text: item.text,
          font: item.fontFamily === "serif" ? "serif" : item.fontFamily === "roboto" ? "roboto" : "sans",
          bold: Boolean(item.bold),
          italic: Boolean(item.italic),
          angle: item.angle,
          sourceId: item.id,
          bg: item.bg || "#ffffff",
          ...updates
        };

    let nextMarks = [...state.marks.filter(m => m.id !== baseMark.id && m.sourceId !== item.id), baseMark];
    if (isOcr) {
      const coverId = `cover-${item.id}`;
      if (!nextMarks.some(m => m.id === coverId || m.sourceId === coverId)) {
        const coverMark: Mark = {
          id: coverId,
          page: item.page,
          kind: "highlight",
          x: item.x - 2,
          y: item.y - 1,
          w: item.w + 4,
          h: Math.max(item.h, item.size * 1.25) + 2,
          color: "#ffffff",
          size: 1,
          opacity: 1,
          sourceId: coverId
        };
        nextMarks = [coverMark, ...nextMarks];
      }
    }
    const nextState = { ...state, removals, marks: nextMarks };

    if (isSession) {
      if (!sessionInitialRef.current) sessionInitialRef.current = state;
      setState(nextState);
      setDirty(true);
    } else {
      change(nextState);
    }
    setSelectedOriginal(null);
    setSelected(baseMark.id);
    return baseMark;
  }

  function startInlineEditOriginal(item: EditableText) {
    const initial = sessionInitialRef.current || state;
    sessionInitialRef.current = initial;
    const mark = convertOriginalToMark(item, {}, true);
    setEditingId(mark.id);
  }

  function startInlineEditMark(m: Mark) {
    if (m.kind !== "text") return;
    if (!sessionInitialRef.current) {
      sessionInitialRef.current = state;
    }
    setSelected(m.id);
    setSelectedOriginal(null);
    setEditingId(m.id);
  }

  function finishInlineEdit() {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (sessionInitialRef.current) {
      commitSession(sessionInitialRef.current, stateRef.current);
      sessionInitialRef.current = null;
    }
    setEditingId(null);
  }

  function cancelInlineEdit() {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (sessionInitialRef.current) {
      setState(sessionInitialRef.current);
      sessionInitialRef.current = null;
    }
    setEditingId(null);
  }

  function updateActiveText(newText: string, isSession = true) {
    if (selectedOriginal) {
      convertOriginalToMark(selectedOriginal, { text: newText }, isSession);
      return;
    }
    if (selected) {
      const cur = stateRef.current;
      if (isSession) {
        if (!sessionInitialRef.current) {
          sessionInitialRef.current = cur;
        }
        setState({
          ...cur,
          marks: cur.marks.map(m => (m.id === selected ? { ...m, text: newText } : m))
        });
        setDirty(true);
        if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
        commitTimerRef.current = setTimeout(() => {
          if (sessionInitialRef.current) {
            commitSession(sessionInitialRef.current, stateRef.current);
            sessionInitialRef.current = null;
          }
        }, 700);
      } else {
        change({
          ...cur,
          marks: cur.marks.map(m => (m.id === selected ? { ...m, text: newText } : m))
        });
      }
    }
  }

  function updateActiveFormat(updates: Partial<Mark>) {
    if (selectedOriginal) {
      convertOriginalToMark(selectedOriginal, updates, false);
      return;
    }
    if (selected) {
      const cur = stateRef.current;
      change({
        ...cur,
        marks: cur.marks.map(m => (m.id === selected ? { ...m, ...updates } : m))
      });
    } else {
      if (updates.text !== undefined) setText(updates.text);
      if (updates.font) setFont(updates.font);
      if (updates.bold !== undefined) setBold(updates.bold);
      if (updates.italic !== undefined) setItalic(updates.italic);
      if (updates.size !== undefined) setSize(updates.size);
      if (updates.color !== undefined) setColor(updates.color);
    }
  }

  function deleteOriginal(item: EditableText) {
    const removals = state.removals.some(r => r.id === item.id)
      ? state.removals
      : [...state.removals, { id: item.id, page: item.page, quad: item.quad }];
    let nextMarks = state.marks.filter(m => m.sourceId !== item.id);
    const isOcr = Boolean((item as any).isOcr || item.id.startsWith("ocr-"));
    if (isOcr) {
      const coverId = `cover-${item.id}`;
      const coverMark: Mark = {
        id: coverId,
        page: item.page,
        kind: "highlight",
        x: item.x - 2,
        y: item.y - 1,
        w: item.w + 4,
        h: Math.max(item.h, item.size * 1.25) + 2,
        color: "#ffffff",
        size: 1,
        opacity: 1,
        sourceId: coverId
      };
      nextMarks = [coverMark, ...nextMarks.filter(m => m.id !== coverId)];
    }
    change({ ...state, removals, marks: nextMarks });
    setSelectedOriginal(null);
    setSelected(null);
    setEditingId(null);
    toast.success("Mevcut metin silindi.");
  }

  function deleteSelected() {
    if (editingId) return;
    if (selectedOriginal) {
      deleteOriginal(selectedOriginal);
    } else if (selected) {
      const targetMark = state.marks.find(m => m.id === selected);
      const isOcrMark = Boolean(targetMark?.sourceId?.startsWith("ocr-"));
      let nextMarks = state.marks.filter(m => m.id !== selected);
      if (isOcrMark && targetMark) {
        const coverId = `cover-${targetMark.sourceId}`;
        const box = getTextDimensions(targetMark);
        if (!nextMarks.some(m => m.id === coverId || m.sourceId === coverId)) {
          const coverMark: Mark = {
            id: coverId,
            page: targetMark.page,
            kind: "highlight",
            x: targetMark.x - 2,
            y: targetMark.y - 1,
            w: box.w + 4,
            h: box.h + 2,
            color: "#ffffff",
            size: 1,
            opacity: 1,
            sourceId: coverId
          };
          nextMarks = [coverMark, ...nextMarks];
        }
      }
      change({ ...state, marks: nextMarks });
      setSelected(null);
      setEditingId(null);
      toast.success("Öğe silindi.");
    }
  }

  function clearPageDrawings() {
    const nextMarks = state.marks.filter(m => !(m.page === active && m.kind === "draw"));
    if (nextMarks.length !== state.marks.length) {
      change({ ...state, marks: nextMarks });
      toast.success("Bu sayfadaki çizimler temizlendi.");
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isEditingInline = editingId !== null;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (isInput && !target.classList.contains("inline-text-editor")) {
        return;
      }

      if (e.key === "Escape") {
        if (isEditingInline) {
          e.preventDefault();
          cancelInlineEdit();
        } else if (selected || selectedOriginal) {
          setSelected(null);
          setSelectedOriginal(null);
        }
        return;
      }

      if (isEditingInline) {
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && (selected || selectedOriginal)) {
        e.preventDefault();
        deleteSelected();
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && (selected || selectedOriginal)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;

        if (selected) {
          const m = state.marks.find(item => item.id === selected);
          if (m) {
            const nextX = Math.max(0, Math.min(dimensions.baseWidth, m.x + dx));
            const nextY = Math.max(0, Math.min(dimensions.baseHeight, m.y + dy));
            change({
              ...state,
              marks: state.marks.map(item =>
                item.id === selected
                  ? {
                      ...item,
                      x: nextX,
                      y: nextY,
                      points: item.kind === "draw" ? item.points?.map(p => ({ x: p.x + dx, y: p.y + dy })) : item.points
                    }
                  : item
              )
            });
          }
        } else if (selectedOriginal) {
          const nextX = Math.max(0, Math.min(dimensions.baseWidth, selectedOriginal.x + dx));
          const nextY = Math.max(0, Math.min(dimensions.baseHeight, selectedOriginal.y + dy));
          convertOriginalToMark(selectedOriginal, { x: nextX, y: nextY }, false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, selectedOriginal, editingId, state, dimensions]);

  function addMark(mark: Mark) {
    change({ ...state, marks: [...state.marks, mark] });
    setSelected(mark.id);
  }

  const handleApplyStamp = (stampDataUrl: string, stampW: number, stampH: number) => {
    const stampMark: Mark = {
      id: crypto.randomUUID(),
      page: current?.index ?? active,
      kind: "signature",
      x: Math.max(50, Math.round((dimensions.baseWidth - stampW) / 2)),
      y: Math.max(50, Math.round((dimensions.baseHeight - stampH) / 2)),
      w: stampW,
      h: stampH,
      color: "#dc2626",
      size: 16,
      image: stampDataUrl,
      opacity: 0.95,
      angle: -3.5
    };
    addMark(stampMark);
    setTool("select");
  };

  function newMark(kind: Mark["kind"], x: number, y: number): Mark {
    return {
      id: crypto.randomUUID(),
      page: current.index,
      kind,
      x,
      y,
      w: kind === "signature" ? 180 : 150,
      h: kind === "signature" ? 67.5 : kind === "highlight" ? highlightHeight : 24,
      color: kind === "highlight" ? highlightColor : kind === "draw" ? drawColor : color,
      size: kind === "draw" ? drawSize : size,
      text,
      font,
      bold,
      italic,
      image: sig || undefined,
      opacity: kind === "highlight" ? highlightOpacity : kind === "draw" ? drawOpacity : 1,
      align: textAlign,
      points: []
    };
  }

  function basePoint(e: React.PointerEvent) {
    if (!surface.current) return { x: 0, y: 0 };
    const box = surface.current.getBoundingClientRect();
    if (!box.width || !box.height) return { x: 0, y: 0 };
    const clientX = Number.isFinite(e.clientX) ? e.clientX : box.left;
    const clientY = Number.isFinite(e.clientY) ? e.clientY : box.top;
    const x = ((clientX - box.left) / box.width) * (dimensions.width || box.width);
    const y = ((clientY - box.top) / box.height) * (dimensions.height || box.height);
    const r = current?.rotation || 0;
    const baseW = dimensions.baseWidth || dimensions.width || box.width;
    const baseH = dimensions.baseHeight || dimensions.height || box.height;
    const p =
      r === 90
        ? { x: y, y: baseH - x }
        : r === 180
        ? { x: baseW - x, y: baseH - y }
        : r === 270
        ? { x: baseW - y, y: x }
        : { x, y };
    const px = Number.isFinite(p.x) ? p.x : 0;
    const py = Number.isFinite(p.y) ? p.y : 0;
    return { x: Math.max(0, Math.min(baseW, px)), y: Math.max(0, Math.min(baseH, py)) };
  }

  function startDragOriginal(item: EditableText, e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const initial = sessionInitialRef.current || state;
    sessionInitialRef.current = initial;
    const mark = convertOriginalToMark(item, {}, true);
    gesture.current = {
      move: true,
      mark,
      start: basePoint(e),
      initialSnapshot: initial
    };
    applyDraft(mark);
  }

  function startResizeOriginal(item: EditableText, corner: "nw" | "ne" | "se" | "sw", e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const initial = sessionInitialRef.current || state;
    sessionInitialRef.current = initial;
    const mark = convertOriginalToMark(item, {}, true);
    gesture.current = {
      resize: corner,
      mark,
      startPoint: basePoint(e),
      startSize: mark.size,
      initialSnapshot: initial
    };
    applyDraft(mark);
  }

  function startResizeMark(m: Mark, corner: "nw" | "ne" | "se" | "sw", e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    gesture.current = {
      resize: corner,
      mark: m,
      startPoint: basePoint(e),
      startSize: m.size,
      initialSnapshot: sessionInitialRef.current || state
    };
    applyDraft(m);
  }

  function pointerDown(e: React.PointerEvent) {
    if (busy || rendering || !current) return;
    if (tool === "select") {
      if (editingId) finishInlineEdit();
      setSelected(null);
      setSelectedOriginal(null);
      return;
    }
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const p = basePoint(e);
    if (tool === "draw" && isEraser) {
      const hitRadius = Math.max(12, drawSize * 2);
      const remainingMarks = state.marks.filter(m => {
        if (m.page !== current.index || m.kind !== "draw" || !m.points) return true;
        return !m.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) <= hitRadius);
      });
      if (remainingMarks.length !== state.marks.length) {
        change({ ...state, marks: remainingMarks });
      }
      return;
    }
    if (tool === "text") {
      addMark(newMark("text", p.x, p.y));
      setTool("select");
    } else if (tool === "signature") {
      if (!sig) {
        setSignOpen(true);
        return;
      }
      addMark(newMark("signature", p.x, p.y));
      setTool("select");
    } else {
      const m = newMark(tool, p.x, p.y);
      m.points = [p];
      m.w = 0;
      m.h = 0;
      gesture.current = { mark: m, start: p };
      applyDraft(m);
    }
  }

  function pointerMove(e: React.PointerEvent) {
    if (tool === "draw" && isEraser && e.buttons === 1) {
      const p = basePoint(e);
      const hitRadius = Math.max(12, drawSize * 2);
      const remainingMarks = state.marks.filter(m => {
        if (m.page !== current.index || m.kind !== "draw" || !m.points) return true;
        return !m.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) <= hitRadius);
      });
      if (remainingMarks.length !== state.marks.length) {
        change({ ...state, marks: remainingMarks });
      }
      return;
    }
    const g = gesture.current;
    if (!g) return;
    const p = basePoint(e);

    if (g.resize) {
      const dist = Math.hypot(p.x - g.mark.x, p.y - g.mark.y);
      const origDist = Math.hypot(g.startPoint.x - g.mark.x, g.startPoint.y - g.mark.y);
      const scale = origDist > 5 ? dist / origDist : 1;
      const newSize = Math.max(6, Math.min(160, Math.round(g.startSize * scale * 10) / 10));
      applyDraft({ ...g.mark, size: newSize });
      return;
    }

    if (g.move) {
      const dx = p.x - g.start.x;
      const dy = p.y - g.start.y;
      applyDraft({
        ...g.mark,
        x: Math.max(0, g.mark.x + dx),
        y: Math.max(0, g.mark.y + dy),
        points: g.mark.points?.map((pt: { x: number; y: number }) => ({ x: pt.x + dx, y: pt.y + dy }))
      });
      return;
    }

    if (g.mark.kind === "draw") {
      g.mark = { ...g.mark, points: [...g.mark.points, p] };
    } else {
      g.mark = {
        ...g.mark,
        x: Math.min(p.x, g.start.x),
        y: Math.min(p.y, g.start.y),
        w: Math.abs(p.x - g.start.x),
        h: Math.abs(p.y - g.start.y)
      };
    }
    applyDraft(g.mark);
  }

  function pointerUp() {
    const g = gesture.current;
    if (!g) return;
    const m = draftRef.current || g.mark;
    if (m) {
      const cur = stateRef.current;
      if (g.resize) {
        if (m.size !== g.startSize) {
          commitSession(g.initialSnapshot, {
            ...cur,
            marks: cur.marks.map(item => (item.id === m.id ? m : item))
          });
        }
      } else if (g.move) {
        if (m.x !== g.mark.x || m.y !== g.mark.y) {
          commitSession(g.initialSnapshot, {
            ...cur,
            marks: cur.marks.map(item => (item.id === m.id ? m : item))
          });
        }
      } else if (m.kind === "draw" ? (m.points?.length || 0) > 1 : m.w > 2 && m.h > 2) {
        addMark(m);
      }
    }
    applyDraft(null);
    gesture.current = null;
  }

  useEffect(() => {
    function onWinMove(e: PointerEvent) {
      if (gesture.current) {
        pointerMove(e as any);
      }
    }
    function onWinUp() {
      if (gesture.current) {
        pointerUp();
      }
    }
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);
    window.addEventListener("blur", onWinUp);
    return () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
      window.removeEventListener("blur", onWinUp);
    };
  }, [dimensions, current]);

  function rotate() {
    change({
      ...state,
      pages: state.pages.map((p, i) => (i === active ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    });
  }

  function removePage() {
    if (state.pages.length === 1) {
      toast.error("Belgede en az bir sayfa kalmalı.");
      return;
    }
    change({ ...state, pages: state.pages.filter((_, i) => i !== active) });
    setActive(Math.max(0, active - 1));
    setSelected(null);
    setSelectedOriginal(null);
  }

  function movePage(direction: number) {
    const to = active + direction;
    if (to < 0 || to >= state.pages.length) return;
    const pages = [...state.pages];
    [pages[active], pages[to]] = [pages[to], pages[active]];
    change({ ...state, pages });
    setActive(to);
  }

  async function append(appendedFiles: File[]) {
    if (!bytes || !appendedFiles.length) return;
    if (appendedFiles.some(f => !/\.pdf$/i.test(f.name) || f.size > 50 * 1024 * 1024)) {
      toast.error("En fazla 50 MB olan PDF dosyaları seç.");
      return;
    }
    setBusy("PDF’ler birleştiriliyor…");
    try {
      const data = await mergePdf([new File([bytes as BlobPart], "mevcut.pdf"), ...appendedFiles]);
      const next = await loadPdf(data);
      const added = Array.from({ length: next.numPages - pdf.numPages }, (_, i) => ({
        index: pdf.numPages + i,
        rotation: 0
      }));
      renderTask.current?.cancel();
      setPdf(next);
      setBytes(data);
      change({ ...state, pages: [...state.pages, ...added] });
      void pdf.loadingTask.destroy().catch(() => {});
      toast.success("Sayfalar belgenin sonuna eklendi.");
    } catch {
      toast.error("PDF birleştirilemedi. Dosya şifreli veya bozuk olabilir.");
    } finally {
      setBusy("");
    }
  }

  function selectedPages() {
    if (!range.trim()) return state.pages;
    const indices: number[] = [];
    for (const part of range.split(",")) {
      const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw Error("Sayfaları 1, 3-5 biçiminde yaz.");
      const from = Number(match[1]);
      const to = Number(match[2] || match[1]);
      if (from < 1 || to > state.pages.length || from > to)
        throw Error(`1 ile ${state.pages.length} arasında sayfalar seç.`);
      for (let n = from; n <= to; n++) if (!indices.includes(n - 1)) indices.push(n - 1);
    }
    return indices.map(i => state.pages[i]);
  }

  async function save() {
    if (busy || savingRef.current) return;
    savingRef.current = true;
    setRangeError("");
    if (previewError) {
      toast.error(previewError);
      savingRef.current = false;
      return;
    }
    setBusy("Dosyan hazırlanıyor…");
    try {
      if (kind === "word") {
        const html = editor.current?.innerHTML || htmlRef.current;
        const result =
          format === "pdf"
            ? await wordPdf(html)
            : format === "docx"
            ? await wordDocx(html)
            : new Blob([editor.current?.innerText || ""], { type: "text/plain;charset=utf-8" });
        download(result, `${name || "belge"}.${format}`);
      } else if (bytes) {
        let pages: PageItem[];
        try {
          pages = selectedPages();
        } catch (e) {
          setRangeError((e as Error).message);
          return;
        }
        if (format === "pdf") {
          let finalPdf = await exportPdf(bytes, pages, state.marks, state.removals, pageImages);
          if (pdfAnnotations.length > 0) {
            finalPdf = await writeAnnotationsToPdf(finalPdf, pdfAnnotations);
          }
          if (formFields.length > 0) {
            finalPdf = await embedFormFieldsInPdf(finalPdf, formFields, flattenForms);
          }
          if (typeof window !== "undefined") {
            (window as any).__lastExportedPdf = finalPdf;
          }
          download(finalPdf, `${name || "belge"}.pdf`);
          void clearCurrentDraft();
        } else {
          const edited = await exportPdf(bytes, pages, state.marks, state.removals, pageImages);
          const extracted = await extractPdfText(edited);
          if (!extracted.trim()) throw Error("Bu PDF’de seçilebilir metin bulunamadı. Taranmış belgeler için OCR gerekir.");
          if (format === "txt") download(new Blob([extracted], { type: "text/plain;charset=utf-8" }), `${name || "belge"}.txt`);
          else {
            const div = document.createElement("div");
            div.textContent = extracted;
            download(await wordDocx(div.innerHTML.split("\n").map(s => `<p>${s}</p>`).join("")), `${name || "belge"}.docx`);
          }
        }
      }
      setExportOpen(false);
      if ((kind === "word" && format === "docx") || (kind === "pdf" && format === "pdf" && !range.trim())) setDirty(false);
      toast.success("Dosyan hazır, indirme başlatıldı.");
    } catch (e) {
      toast.error((e as Error).message || "Dosya oluşturulamadı.");
    } finally {
      savingRef.current = false;
      setBusy("");
    }
  }

  function rememberSelection() {
    const s = window.getSelection();
    if (s?.rangeCount && editor.current?.contains(s.anchorNode)) selection.current = s.getRangeAt(0).cloneRange();
  }

  function command(cmd: string, val?: string) {
    editor.current?.focus();
    if (selection.current) {
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(selection.current);
    }
    document.execCommand(cmd, false, val);
    if (editor.current) {
      htmlRef.current = editor.current.innerHTML;
      setCount(editor.current.innerText.trim().split(/\s+/).filter(Boolean).length);
    }
    setDirty(true);
    rememberSelection();
  }

  const transform =
    current?.rotation === 90
      ? `translate(${dimensions.baseHeight} 0) rotate(90)`
      : current?.rotation === 180
      ? `translate(${dimensions.baseWidth} ${dimensions.baseHeight}) rotate(180)`
      : current?.rotation === 270
      ? `translate(0 ${dimensions.baseWidth}) rotate(270)`
      : undefined;

  const visibleMarks = [...state.marks.filter(m => m.page === current?.index && m.id !== draft?.id), ...(draft ? [draft] : [])];

  function drawMark(m: Mark) {
    const isSelected = selected === m.id;
    const isEditing = editingId === m.id;
    const isText = m.kind === "text";
    const box = isText ? getTextDimensions(m) : { w: m.w, h: m.h };
    const isCover = Boolean(m.sourceId?.startsWith("cover-"));

    return (
      <g
        key={m.id}
        transform={isText && m.angle ? `rotate(${m.angle} ${m.x} ${m.y + m.size})` : undefined}
        className={tool === "select" && !isCover ? "selectable-mark" : ""}
        pointerEvents={isCover ? "none" : undefined}
        onPointerDown={e => {
          if (tool !== "select" || isEditing || isCover) return;
          e.stopPropagation();
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
          setSelected(m.id);
          setSelectedOriginal(null);
          gesture.current = {
            move: true,
            mark: m,
            start: basePoint(e),
            initialSnapshot: stateRef.current
          };
          applyDraft(m);
        }}
        onDoubleClick={e => {
          if (tool !== "select" || !isText || isCover) return;
          e.stopPropagation();
          startInlineEditMark(m);
        }}
      >
        {isText ? (
          isEditing ? (
            <foreignObject
              x={m.x - 4}
              y={m.y - 2}
              width={Math.max(box.w + 60, 140)}
              height={Math.max(box.h + 40, 80)}
              style={{ overflow: "visible" }}
            >
              <textarea
                ref={inlineTextareaRef}
                className="inline-text-editor"
                autoFocus
                style={{
                  width: `${Math.max(box.w + 30, 120)}px`,
                  minHeight: `${box.h + 4}px`,
                  fontSize: `${m.size}px`,
                  fontFamily: pdfFont(m.font).family,
                  fontWeight: m.bold ? 700 : 400,
                  fontStyle: m.italic ? "italic" : "normal",
                  color: m.color,
                  lineHeight: 1.25,
                  caretColor: "#6552df",
                  backgroundColor: m.bg || (m.sourceId?.startsWith("ocr-") ? "#ffffff" : undefined)
                }}
                value={m.text || ""}
                onChange={e => updateActiveText(e.target.value, true)}
                onBlur={finishInlineEdit}
                onPointerDown={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    finishInlineEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelInlineEdit();
                  }
                }}
              />
            </foreignObject>
          ) : (
            <>
              {m.bg && (
                <rect
                  x={m.x - 2}
                  y={m.y - 1}
                  width={box.w + 4}
                  height={box.h + 2}
                  fill={m.bg}
                />
              )}
              <text
                x={m.align === "center" ? m.x + box.w / 2 : m.align === "right" ? m.x + box.w : m.x}
                textAnchor={m.align === "center" ? "middle" : m.align === "right" ? "end" : "start"}
                y={m.y + m.size}
                fontSize={m.size}
                fontFamily={pdfFont(m.font).family}
                fontWeight={m.bold ? 700 : 400}
                fontStyle={m.italic ? "italic" : "normal"}
                fill={m.color}
              >
                {(m.text || "").split("\n").map((line, i) => (
                  <tspan
                    key={i}
                    x={m.align === "center" ? m.x + box.w / 2 : m.align === "right" ? m.x + box.w : m.x}
                    dy={i ? m.size * 1.25 : 0}
                  >
                    {line || " "}
                  </tspan>
                ))}
              </text>
            </>
          )
        ) : m.kind === "highlight" ? (
          <rect x={m.x} y={m.y} width={m.w} height={m.h} fill={m.color} opacity={m.opacity ?? 0.35} />
        ) : m.kind === "signature" ? (
          <image href={m.image} x={m.x} y={m.y} width={m.w} height={m.h} opacity={m.opacity ?? 1} />
        ) : (
          <polyline
            points={m.points?.map(p => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={m.color}
            strokeWidth={m.size}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={m.opacity ?? 1}
          />
        )}

        {isSelected && m.kind !== "draw" && !isCover && (
          <>
            <rect
              className={`selection-frame ${isEditing ? "is-editing" : ""}`}
              x={m.x - 4}
              y={m.y - 2}
              width={box.w + 8}
              height={box.h + 4}
              rx={2}
              pointerEvents={isEditing ? "none" : "all"}
              onPointerDown={e => {
                if (isEditing) return;
                e.stopPropagation();
                e.preventDefault();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                gesture.current = {
                  move: true,
                  mark: m,
                  start: basePoint(e),
                  initialSnapshot: stateRef.current
                };
                applyDraft(m);
              }}
              onDoubleClick={e => {
                if (isText) {
                  e.stopPropagation();
                  startInlineEditMark(m);
                }
              }}
            />
            {!isEditing &&
              renderResizeHandles(
                m.x - 4,
                m.y - 2,
                box.w + 8,
                box.h + 4,
                corner => e => startResizeMark(m, corner, e)
              )}
          </>
        )}
      </g>
    );
  }

  const selectedOriginalAsMark: Mark | null = selectedOriginal
    ? {
        id: selectedOriginal.id,
        page: selectedOriginal.page,
        kind: "text",
        x: selectedOriginal.x,
        y: selectedOriginal.y,
        w: selectedOriginal.w,
        h: selectedOriginal.h,
        size: Math.round(selectedOriginal.size * 10) / 10,
        color: selectedOriginal.color || "#222222",
        text: selectedOriginal.text,
        font: selectedOriginal.fontFamily === "serif" ? "serif" : selectedOriginal.fontFamily === "roboto" ? "roboto" : "sans",
        bold: Boolean(selectedOriginal.bold),
        italic: Boolean(selectedOriginal.italic),
        angle: selectedOriginal.angle
      }
    : null;

  const panelMark = activeMark || selectedOriginalAsMark;
  const activeSelectedImage = selectedImageId ? (imageEdits.find(i => i.id === selectedImageId && !i.deleted) || null) : null;

  if (error)
    return (
      <div className="editor-error">
        <FileText size={38} />
        <h2>Dosyayı açamadık</h2>
        <p>{error}</p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="secondary" onClick={onClose}>
            Araçlara dön
          </button>
          <button className="primary" onClick={() => onOpen?.(intent)}>
            Başka dosya seç
          </button>
        </div>
      </div>
    );

  return (
    <div className="editor-shell">
      <div className="editor-heading">
        <IconButton label="Araçlara dön" onClick={() => (dirty ? setExit(true) : onClose())}>
          <ArrowLeft size={19} />
        </IconButton>
        <span className={`tool-icon ${kind === "pdf" ? "violet" : "blue"}`}>
          <FileText size={22} />
        </span>
        <div className="editor-title">
          <input aria-label="Belge adı" value={name} onChange={e => setName(e.target.value)} />
          <span>
            {kind === "pdf" ? `${state.pages.length} sayfa · PDF` : `${count} kelime · Word`}
            <i /> {dirty ? "İndirilmemiş değişiklikler" : "Cihazında açık"}
          </span>
        </div>
        <AutosaveIndicator />
        {kind === "pdf" && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              className="secondary"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setShowFindReplace(true)}
              title="Belgede Ara ve Değiştir (Ctrl+F)"
            >
              <Search size={15} />
              <span>Bul</span>
            </button>
            <button
              type="button"
              className="secondary"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setShowOcr(true)}
              title="Taranmış PDF'i Tanı (Yerel OCR)"
            >
              <ScanText size={15} />
              <span>OCR</span>
            </button>
            <button
              type="button"
              className="secondary"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setShowCompress(true)}
              title="PDF Boyutunu Sıkıştır"
            >
              <Archive size={15} />
              <span>Sıkıştır</span>
            </button>
            <button
              type="button"
              className="secondary"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setShowPageOrganizer(true)}
              title="Gelişmiş Sayfa Düzenleyici"
            >
              <Layers size={15} />
              <span>Sayfalar</span>
            </button>
            <button
              type="button"
              className="secondary group hover:border-rose-300 hover:bg-rose-50/50"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={handleOneClickWatermarkRemoval}
              disabled={isCleaningWatermarks}
              title="Belgeden Filigran ve Damgaları Tek Tıkla Kusursuz Temizle"
            >
              {isCleaningWatermarks ? (
                <Loader2 size={15} className="animate-spin text-rose-600" />
              ) : (
                <Eraser size={15} className="text-rose-600 group-hover:scale-110 transition-transform" />
              )}
              <span>{isCleaningWatermarks ? "Temizleniyor..." : "Filigran Kaldır"}</span>
            </button>
            <button
              type="button"
              className={`secondary ${formMode !== "none" ? "bg-indigo-50 border-indigo-300 text-indigo-700" : ""}`}
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setFormMode(m => m === "design" ? "fill" : m === "fill" ? "none" : "design")}
              title="Doldurulabilir Form Alanları"
            >
              <FormInput size={15} />
              <span>{formMode === "design" ? "Form: Tasarım" : formMode === "fill" ? "Form: Doldur" : "Form"}</span>
            </button>
            <button
              type="button"
              className="secondary"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setShowFindReplace(prev => !prev)}
              title="Metin / Fiyat Değiştir (Bul ve Değiştir - Ctrl+F)"
            >
              <Search size={15} className="text-amber-400" />
              <span>Metin Değiştir</span>
            </button>
            <button
              type="button"
              className="secondary"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setShowStampModal(true)}
              title="Resmi Kaşe & Mühür Atölyesi"
            >
              <StampIcon size={15} className="text-red-400" />
              <span>Kaşe</span>
            </button>
            <button
              type="button"
              className="secondary"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setShowSecurity(true)}
              title="Gizlilik ve Güvenlik Araçları (KVKK / Şifreleme)"
            >
              <ShieldCheck size={15} />
              <span>Güvenlik</span>
            </button>
            <button
              type="button"
              className="secondary group hover:border-violet-300 hover:bg-violet-50/50"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setActiveProfessionalTool('enhancer')}
              title="Bulanık Yazıları ve Görselleri Kristal Netliğe Kavuştur"
            >
              <Sparkles size={15} className="text-violet-500 group-hover:scale-110 transition-transform" />
              <span>Netleştir</span>
            </button>
            <button
              type="button"
              className="secondary bg-blue-500/10 border-blue-400/40 text-blue-400 hover:bg-blue-500/20"
              style={{ minHeight: "36px", padding: "0 10px", fontSize: "12px", gap: "6px" }}
              onClick={() => setShowToolHub(true)}
              title="Tüm Atölye Araçları (Ctrl+K)"
            >
              <Sparkles size={15} />
              <span>Araçlar</span>
            </button>
          </div>
        )}
        <button className="primary" disabled={!!busy} onClick={() => setExportOpen(true)}>
          <Download size={17} />
          <span>Dışa aktar</span>
        </button>
      </div>

      {kind === "pdf" ? (
        <>
          <fieldset disabled={!!busy} className="editor-toolbar">
            <div className="tool-buttons shrink-0">
              {[
                { id: "select", label: "Metni düzenle", icon: MousePointer2 },
                { id: "text", label: "Metin ekle", icon: Type },
                { id: "highlight", label: "Vurgula", icon: Highlighter },
                { id: "draw", label: "Çiz", icon: PenLine },
                { id: "signature", label: "İmza", icon: PenLine },
                { id: "stamp", label: "Kaşe / Mühür", icon: StampIcon }
              ].map(t => (
                <button
                  key={t.id}
                  className={tool === t.id ? "active" : ""}
                  aria-pressed={tool === t.id}
                  onClick={() => {
                    if (t.id === "stamp") {
                      setShowStampModal(true);
                      return;
                    }
                    setTool(t.id as Tool);
                    finishInlineEdit();
                    setSelected(null);
                    setSelectedOriginal(null);
                    setSelectedImageId(null);
                    if (t.id === "signature" && !sig) {
                      setSignOpen(true);
                    }
                  }}
                >
                  <t.icon size={17} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="toolbar-divider shrink-0" />

            {/* Contextual tool controls */}
            <div className="toolbar-contextual flex-1 flex items-center min-w-0 overflow-x-auto">
              {activeSelectedImage ? (
                <ImageControls
                  image={activeSelectedImage}
                  onUpdate={(up) => {
                    setImageEdits(prev => prev.map(i => i.id === activeSelectedImage.id ? { ...i, ...up, isModified: true } : i));
                    setDirty(true);
                    setHistory(h => [...h.slice(-39), { ...state, images: imageEdits }]);
                    setFuture([]);
                  }}
                  onDelete={(id) => {
                    setImageEdits(prev => prev.map(i => i.id === id ? { ...i, deleted: true } : i));
                    setSelectedImageId(null);
                    setDirty(true);
                    setHistory(h => [...h.slice(-39), { ...state, images: imageEdits }]);
                    setFuture([]);
                  }}
                  onDeselect={() => setSelectedImageId(null)}
                />
              ) : tool === "select" ? (
                panelMark?.kind === "signature" ? (
                  <SignatureControls
                    hasSignature={!!sig}
                    selectedSignatureMark={panelMark}
                    onOpenSignDialog={() => setSignOpen(true)}
                    onUpdateFormat={updateActiveFormat}
                    onDeleteSignature={deleteSelected}
                    onDone={() => {
                      finishInlineEdit();
                      setSelected(null);
                      setSelectedOriginal(null);
                    }}
                  />
                ) : (
                  <TextEditControls
                    selectedMark={panelMark}
                    onUpdateFormat={updateActiveFormat}
                    onDelete={deleteSelected}
                    onDone={() => {
                      finishInlineEdit();
                      setSelected(null);
                      setSelectedOriginal(null);
                    }}
                    hasSelectableText={textItems.length > 0}
                    onStartOcr={() => setShowOcr(true)}
                  />
                )
              ) : tool === "text" ? (
                <TextAddControls
                  font={font}
                  onFontChange={setFont}
                  size={size}
                  onSizeChange={setSize}
                  bold={bold}
                  onBoldChange={setBold}
                  italic={italic}
                  onItalicChange={setItalic}
                  color={color}
                  onColorChange={setColor}
                  align={textAlign}
                  onAlignChange={setTextAlign}
                  onQuickAdd={() => {
                    addMark(newMark("text", 50, 80));
                    setTool("select");
                  }}
                />
              ) : tool === "highlight" ? (
                <HighlightControls
                  color={highlightColor}
                  onColorChange={setHighlightColor}
                  opacity={highlightOpacity}
                  onOpacityChange={setHighlightOpacity}
                  height={highlightHeight}
                  onHeightChange={setHighlightHeight}
                />
              ) : tool === "draw" ? (
                <DrawControls
                  color={drawColor}
                  onColorChange={setDrawColor}
                  size={drawSize}
                  onSizeChange={setDrawSize}
                  opacity={drawOpacity}
                  onOpacityChange={setDrawOpacity}
                  isEraser={isEraser}
                  onToggleEraser={() => setIsEraser(e => !e)}
                  onClearPageDrawings={clearPageDrawings}
                  hasDrawings={state.marks.some(m => m.page === active && m.kind === "draw")}
                />
              ) : tool === "signature" ? (
                <SignatureControls
                  hasSignature={!!sig}
                  selectedSignatureMark={panelMark?.kind === "signature" ? panelMark : null}
                  onOpenSignDialog={() => setSignOpen(true)}
                  onUpdateFormat={updateActiveFormat}
                  onDeleteSignature={deleteSelected}
                  onDone={() => {
                    finishInlineEdit();
                    setSelected(null);
                    setSelectedOriginal(null);
                  }}
                />
              ) : null}
            </div>

            <div className="toolbar-divider shrink-0" />

            {/* Page Actions dropdown */}
            <PageActionsMenu
              activePage={active}
              pageCount={state.pages.length}
              onRotate={rotate}
              onMovePage={movePage}
              onSeparatePage={() => {
                setRange(String(active + 1));
                setFormat("pdf");
                setExportOpen(true);
              }}
              onDeletePage={removePage}
              disabled={!current || !!busy}
            />

            <div className="toolbar-divider shrink-0" />

            {/* Undo / Redo */}
            <IconButton label="Geri al" onClick={undo} disabled={!history.length}>
              <Undo2 size={17} />
            </IconButton>
            <IconButton label="Yinele" onClick={redo} disabled={!future.length}>
              <Redo2 size={17} />
            </IconButton>

            <div className="toolbar-divider shrink-0" />

            {/* Zoom controls */}
            <IconButton label="Uzaklaştır" onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}>
              <ZoomOut size={17} />
            </IconButton>
            <span className="zoom-label">%{Math.round(zoom * 100)}</span>
            <IconButton label="Yakınlaştır" onClick={() => setZoom(z => Math.min(2, z + 0.15))}>
              <ZoomIn size={17} />
            </IconButton>
          </fieldset>

          <div className="pdf-workarea">
            <aside className="page-panel">
              <div className="panel-heading">
                <strong>Sayfalar</strong>
                <span>{state.pages.length}</span>
              </div>
              <div className="page-list">
                {state.pages.map((p, i) => (
                  <button
                    key={`${p.index}-${i}`}
                    className={`page-thumb ${active === i ? "active" : ""}`}
                    aria-label={`Sayfa ${i + 1}`}
                    aria-current={active === i ? "page" : undefined}
                    onClick={() => {
                      setActive(i);
                      finishInlineEdit();
                      setSelected(null);
                      setSelectedOriginal(null);
                    }}
                  >
                    <FileText size={30} />
                    <span>{i + 1}</span>
                    {p.rotation !== 0 && <small>{p.rotation}°</small>}
                  </button>
                ))}
              </div>
              <button className="add-pages" disabled={!!busy} onClick={() => mergeInput.current?.click()}>
                <Plus size={16} /> PDF ekle
              </button>
              <p>Eklenen sayfalar sona gelir.</p>
            </aside>

            <div className="page-viewer">
              <div className="page-hint">
                {tool === "text"
                  ? "Metin eklemek istediğin yere tıkla."
                  : tool === "highlight"
                  ? "Vurgulamak istediğin alanı sürükleyerek seç."
                  : tool === "draw"
                  ? "Sayfanın üzerinde çizim yap."
                  : tool === "signature"
                  ? "İmzayı yerleştirmek istediğin yere tıkla."
                  : "Metni seç, çift tıklayıp doğrudan düzenle veya sürükleyerek taşı."}
              </div>
              <FindReplaceBar
                open={showFindReplace}
                onClose={() => setShowFindReplace(false)}
                marks={state.marks}
                originalTexts={allOriginalTexts}
                currentPage={active}
                onNavigatePage={(pIdx) => setActive(pIdx)}
                onUpdateMarks={(newMarks) => change({ ...state, marks: newMarks })}
                onReplace={({ updatedMarks, newMarks, newRemovals }) => {
                  change({
                    ...state,
                    marks: [...updatedMarks, ...newMarks],
                    removals: [...state.removals, ...newRemovals]
                  });
                }}
              />
              <div className="page-scroll">
                <div
                  className={`pdf-surface tool-${tool}`}
                  ref={surface}
                  style={{ width: dimensions.width * zoom, height: dimensions.height * zoom }}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={() => {
                    gesture.current = null;
                    applyDraft(null);
                  }}
                >
                  <canvas ref={canvas} aria-label={`PDF sayfa ${active + 1}`} style={{ width: "100%", height: "100%" }} />
                  <svg className="annotation-layer" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
                    <g transform={transform}>

                      {tool === "select" &&
                        !rendering &&
                        !previewError &&
                        textItems
                          .filter(item => !state.removals.some(r => r.id === item.id))
                          .map(item => {
                            const isSel = selectedOriginal?.id === item.id;
                            const box = {
                              w: Math.max(item.w, (item.text?.length || 1) * item.size * 0.58),
                              h: Math.max(item.h, item.size * 1.25)
                            };
                            return (
                              <g key={item.id} transform={`rotate(${item.angle} ${item.x} ${item.y + item.size})`}>
                                <rect
                                  className={`original-text-hit ${isSel ? "is-selected" : ""} ${(item as any).isOcr ? "is-ocr" : ""}`}
                                  x={item.x - 1}
                                  y={item.y - 1}
                                  width={Math.max(8, item.w + 2)}
                                  height={item.size * 1.25}
                                  tabIndex={0}
                                  role="button"
                                  aria-label={`Metni düzenle: ${item.text}`}
                                  onPointerDown={e => {
                                    e.stopPropagation();
                                    finishInlineEdit();
                                    setSelected(null);
                                    setSelectedOriginal(item);
                                  }}
                                  onDoubleClick={e => {
                                    e.stopPropagation();
                                    startInlineEditOriginal(item);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      startInlineEditOriginal(item);
                                    }
                                  }}
                                >
                                  <title>{item.text}</title>
                                </rect>
                                {isSel && (
                                  <>
                                    <rect
                                      className="selection-frame"
                                      x={item.x - 4}
                                      y={item.y - 2}
                                      width={box.w + 8}
                                      height={box.h + 4}
                                      rx={2}
                                      onPointerDown={e => startDragOriginal(item, e)}
                                      onDoubleClick={e => {
                                        e.stopPropagation();
                                        startInlineEditOriginal(item);
                                      }}
                                    />
                                    {renderResizeHandles(
                                      item.x - 4,
                                      item.y - 2,
                                      box.w + 8,
                                      box.h + 4,
                                      corner => e => startResizeOriginal(item, corner, e)
                                    )}
                                  </>
                                )}
                              </g>
                            );
                          })}
                      {visibleMarks.map(drawMark)}
                    </g>
                  </svg>
                  {rendering && (
                    <div className="rendering-label">
                      <LoaderCircle className="spin" size={15} /> Sayfa yükleniyor
                    </div>
                  )}
                  <ImageOverlay
                    detectedImages={detectedImages.filter(img => img.page === active)}
                    editedImages={imageEdits.filter(img => img.page === active && !img.deleted)}
                    selectedId={selectedImageId}
                    tool={tool}
                    onSelect={(id) => {
                      if (!id) {
                        setSelectedImageId(null);
                        return;
                      }
                      const edit = imageEdits.find(e => e.id === id);
                      if (edit) {
                        setSelectedImageId(id);
                      } else {
                        const det = detectedImages.find(d => d.id === id && d.page === active);
                        if (det) void handleRequestEdit(det);
                      }
                    }}
                    onRequestEdit={(det) => void handleRequestEdit(det)}
                    onUpdate={(id, up) => {
                      setImageEdits(prev => prev.map(i => i.id === id ? { ...i, ...up, isModified: true } : i));
                      setDirty(true);
                    }}
                    onCommit={(id) => {
                      setDirty(true);
                      setHistory(h => [...h.slice(-39), { ...state, images: imageEdits }]);
                      setFuture([]);
                    }}
                    onDragStateChange={setIsDraggingImage}
                    pageWidth={dimensions.width}
                    pageHeight={dimensions.height}
                    zoom={zoom}
                  />
                  {formMode === "design" && (
                    <FormDesignerOverlay
                      fields={formFields}
                      pageIndex={active}
                      onAddField={(type: FormFieldItem["type"]) => {
                        const newField: FormFieldItem = {
                          id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                          page: active,
                          type,
                          name: `Alan_${formFields.length + 1}`,
                          label: type === "checkbox" ? "Onay Kutusu" : "Metin Alanı",
                          value: type === "checkbox" ? false : "",
                          options: type === "dropdown" ? ["Seçenek 1", "Seçenek 2"] : undefined,
                          x: 80,
                          y: 80 + (formFields.filter(f => f.page === active).length % 10) * 45,
                          w: type === "checkbox" ? 22 : type === "multiline" ? 260 : 180,
                          h: type === "checkbox" ? 22 : type === "multiline" ? 70 : 28
                        };
                        setFormFields(prev => [...prev, newField]);
                        setDirty(true);
                      }}
                      onUpdateField={(id, up) => {
                        setFormFields(prev => prev.map(f => f.id === id ? { ...f, ...up } : f));
                        setDirty(true);
                      }}
                      onDeleteField={(id) => {
                        setFormFields(prev => prev.filter(f => f.id !== id));
                        setDirty(true);
                      }}
                      pageWidth={dimensions.width}
                      pageHeight={dimensions.height}
                    />
                  )}
                  {formMode === "fill" && (
                    <FormFieldsLayer
                      fields={formFields}
                      pageIndex={active}
                      onFieldValueChange={(id, val) => {
                        setFormFields(prev => prev.map(f => f.id === id ? { ...f, value: val } : f));
                        setDirty(true);
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="page-bottom">
                <IconButton label="Önceki sayfa" disabled={active === 0} onClick={() => setActive(a => a - 1)}>
                  <ChevronLeft size={17} />
                </IconButton>
                <span>
                  {active + 1} / {state.pages.length}
                </span>
                <IconButton
                  label="Sonraki sayfa"
                  disabled={active >= state.pages.length - 1}
                  onClick={() => setActive(a => a + 1)}
                >
                  <ChevronRight size={17} />
                </IconButton>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="editor-toolbar word-toolbar">
            <Choice
              label="Paragraf biçimi"
              value="p"
              onChange={v => command("formatBlock", v)}
              items={[
                { value: "p", label: "Normal metin" },
                { value: "h1", label: "Başlık 1" },
                { value: "h2", label: "Başlık 2" }
              ]}
            />
            <div className="toolbar-divider" />
            {[
              { label: "Kalın", cmd: "bold", icon: Bold },
              { label: "İtalik", cmd: "italic", icon: Italic },
              { label: "Altı çizili", cmd: "underline", icon: Underline },
              { label: "Madde işaretleri", cmd: "insertUnorderedList", icon: List },
              { label: "Geri al", cmd: "undo", icon: Undo2 },
              { label: "Yinele", cmd: "redo", icon: Redo2 }
            ].map(b => (
              <IconButton
                key={b.cmd}
                label={b.label}
                onMouseDown={e => e.preventDefault()}
                onClick={() => command(b.cmd)}
              >
                <b.icon size={17} />
              </IconButton>
            ))}
          </div>
          <div className="word-workarea">
            <div className="word-info">
              Temel metin, başlık, liste ve tablolar düzenlenebilir. Karmaşık Word yerleşimleri sadeleşebilir.
            </div>
            <div
              ref={editor}
              className="word-paper"
              contentEditable={!busy}
              suppressContentEditableWarning
              role="textbox"
              aria-label="Belge metni"
              aria-multiline="true"
              spellCheck
              lang="tr"
              onMouseUp={rememberSelection}
              onKeyUp={rememberSelection}
              onInput={() => {
                htmlRef.current = editor.current?.innerHTML || "";
                setCount((editor.current?.innerText || "").trim().split(/\s+/).filter(Boolean).length);
                setDirty(true);
                rememberSelection();
              }}
              onPaste={e => {
                e.preventDefault();
                const html = e.clipboardData.getData("text/html");
                if (html) command("insertHTML", safeHtml(html));
                else command("insertText", e.clipboardData.getData("text/plain"));
              }}
            />
          </div>
        </>
      )}

      {busy && (
        <div className="busy-overlay" role="status">
          <LoaderCircle className="spin" size={30} />
          <strong>{busy}</strong>
        </div>
      )}

      <input
        type="file"
        className="sr-only"
        tabIndex={-1}
        ref={mergeInput}
        accept=".pdf"
        multiple
        aria-label="Birleştirilecek PDF dosyaları"
        onChange={e => {
          void append(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />

      <SignatureDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        onSave={data => {
          setSig(data);
          setSignOpen(false);
          setTool("signature");
          setSelected(null);
          toast("İmzayı yerleştirmek için sayfaya tıkla.");
        }}
      />

      <Dialog open={exportOpen && !busy} onOpenChange={setExportOpen}>
        <DialogContent className="forma-dialog export-dialog">
          <DialogTitle>Belgeni dışa aktar</DialogTitle>
          <DialogDescription>Düzenlediğin dosyanın bir kopyasını cihazına indir.</DialogDescription>
          <label>
            Dosya adı
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label>Dosya türü</label>
          <Choice
            label="Dosya türü"
            value={format}
            onChange={setFormat}
            items={[
              { value: "pdf", label: "PDF belgesi (.pdf)" },
              { value: "docx", label: "Word belgesi (.docx)" },
              { value: "txt", label: "Düz metin (.txt)" }
            ]}
          />
          {kind === "pdf" && (
            <label>
              Sayfalar
              <input
                placeholder="Tüm sayfalar · Örnek: 1, 3-5"
                value={range}
                onChange={e => {
                  setRange(e.target.value);
                  setRangeError("");
                }}
              />
              <small>Görünen sayfa sırasına göre. Boş bırakırsan tüm sayfalar alınır.</small>
              {rangeError && (
                <span role="alert" className="field-error">
                  {rangeError}
                </span>
              )}
            </label>
          )}
          {kind === "pdf" && format === "pdf" && formFields.length > 0 && (
            <div className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="flattenCheck"
                checked={flattenForms}
                onChange={e => setFlattenForms(e.target.checked)}
                className="rounded accent-indigo-600"
              />
              <label htmlFor="flattenCheck" className="text-xs text-slate-700 cursor-pointer">
                Form alanlarını düzleştir (AcroForm flatten - salt okunur/sabit yap)
              </label>
            </div>
          )}
          {kind === "pdf" && format !== "pdf" && (
            <p className="conversion-note">
              Bu dönüşüm PDF’deki seçilebilir metni alır. Sayfa tasarımı, resimler ve imzalar Word/TXT dosyasına taşınmaz.
              Taranmış sayfalarda OCR gerekir.
            </p>
          )}
          {kind === "word" && format !== "txt" && (
            <p className="conversion-note">Temel biçimlendirme korunur. Özgün Word sayfa düzeni farklı görünebilir.</p>
          )}
          <button className="primary" onClick={() => void save()}>
            <Download size={17} /> Dosyayı indir
          </button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={exit} onOpenChange={setExit}>
        <AlertDialogContent>
          <AlertDialogTitle>İndirmeden çıkılsın mı?</AlertDialogTitle>
          <AlertDialogDescription>
            Bu belgedeki değişiklikler henüz indirilmedi. Çıkarsan tarayıcıdaki değişiklikler kaybolur.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Düzenlemeye dön</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>İndirmeden çık</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OcrModal
        open={showOcr}
        onOpenChange={setShowOcr}
        totalPages={state.pages.length}
        currentPage={active + 1}
        pdfBytes={bytes || undefined}
        fileName={files[0]?.name}
        onInsertText={(txt) => {
          addMark({ ...newMark("text", 50, 80), text: txt });
        }}
        onApplyOcr={handleApplyOcr}
      />

      <CompressDialog
        open={showCompress}
        onOpenChange={setShowCompress}
        pdfBytes={bytes || undefined}
        fileName={files[0]?.name}
      />

      <PageOrganizerModal
        open={showPageOrganizer}
        onOpenChange={setShowPageOrganizer}
        pages={state.pages}
        pdfBytes={bytes || undefined}
        fileName={files[0]?.name}
        onApplyPages={(newPages, newPdfBytes) => {
          if (newPdfBytes) {
            setBytes(newPdfBytes);
          }
          change({ ...state, pages: newPages });
        }}
      />

      <SecurityDialog
        open={showSecurity}
        onOpenChange={setShowSecurity}
        pdfBytes={bytes || undefined}
        fileName={files[0]?.name}
        onApplySanitizedBytes={(newBytes) => setBytes(newBytes)}
      />

      <StampGeneratorModal
        open={showStampModal}
        onOpenChange={setShowStampModal}
        onApplyStampToDocument={handleApplyStamp}
      />

      <ToolHubModal
        isOpen={showToolHub}
        onClose={() => setShowToolHub(false)}
        onSelectTool={(toolId) => {
          if (toolId === 'watermark-removal') {
            setShowToolHub(false);
            void handleOneClickWatermarkRemoval();
          } else if (toolId === 'stamp') {
            setShowToolHub(false);
            setShowStampModal(true);
          } else if (toolId === 'kvkk') {
            setShowToolHub(false);
            setShowSecurity(true);
          } else {
            setActiveProfessionalTool(toolId);
          }
        }}
      />

      <DocumentScannerModal
        isOpen={activeProfessionalTool === 'scanner'}
        onClose={() => setActiveProfessionalTool(null)}
        onImportToWorkspace={(newPdfBytes) => {
          handleApplyProfessionalPdf(newPdfBytes);
          setActiveProfessionalTool(null);
        }}
      />

      <PageDecorationModal
        isOpen={activeProfessionalTool === 'decoration'}
        onClose={() => setActiveProfessionalTool(null)}
        pdfBytes={bytes}
        onApplyToWorkspace={(newPdfBytes: Uint8Array) => {
          handleApplyProfessionalPdf(newPdfBytes);
          setActiveProfessionalTool(null);
        }}
      />

      <AnnotationSidePanel
        isOpen={activeProfessionalTool === 'annotations'}
        onClose={() => setActiveProfessionalTool(null)}
        annotations={pdfAnnotations}
        onUpdateAnnotation={(annot) => {
          setPdfAnnotations((prev) => prev.map((a) => (a.id === annot.id ? annot : a)));
          setDirty(true);
        }}
        onDeleteAnnotation={(id) => {
          setPdfAnnotations((prev) => prev.filter((a) => a.id !== id));
          setDirty(true);
        }}
        pageCount={state.pages.length}
      />

      <PdfCompareModal
        isOpen={activeProfessionalTool === 'compare'}
        onClose={() => setActiveProfessionalTool(null)}
        currentPdfBytes={bytes}
        currentFileName={files[0]?.name}
      />

      <BatchProcessingModal
        isOpen={activeProfessionalTool === 'batch'}
        onClose={() => setActiveProfessionalTool(null)}
      />

      <NavigationModal
        isOpen={activeProfessionalTool === 'navigation'}
        onClose={() => setActiveProfessionalTool(null)}
        pdfBytes={bytes}
        pageCount={state.pages.length}
        onApplyToWorkspace={(newPdfBytes: Uint8Array) => {
          handleApplyProfessionalPdf(newPdfBytes);
          setActiveProfessionalTool(null);
        }}
      />

      <PageSizingModal
        isOpen={activeProfessionalTool === 'page-sizing'}
        onClose={() => setActiveProfessionalTool(null)}
        pdfBytes={bytes}
        onApply={(newPdfBytes: Uint8Array) => {
          handleApplyProfessionalPdf(newPdfBytes);
          setActiveProfessionalTool(null);
        }}
      />

      <AdvancedConversionModal
        isOpen={activeProfessionalTool === 'conversion'}
        onClose={() => setActiveProfessionalTool(null)}
        pdfBytes={bytes}
        fileName={files[0]?.name}
        onOpenConvertedPdf={(newPdfBytes) => {
          handleApplyProfessionalPdf(newPdfBytes);
          setActiveProfessionalTool(null);
        }}
      />

      <DigitalSignatureModal
        isOpen={activeProfessionalTool === 'signature'}
        onClose={() => setActiveProfessionalTool(null)}
        pdfBytes={bytes}
        onApply={(newPdfBytes: Uint8Array) => {
          handleApplyProfessionalPdf(newPdfBytes);
          setActiveProfessionalTool(null);
        }}
      />

      <ComplianceModal
        isOpen={activeProfessionalTool === 'compliance'}
        onClose={() => setActiveProfessionalTool(null)}
        pdfBytes={bytes}
        onApply={(newPdfBytes: Uint8Array) => {
          handleApplyProfessionalPdf(newPdfBytes);
          setActiveProfessionalTool(null);
        }}
      />

      <DocumentEnhancerModal
        isOpen={activeProfessionalTool === 'enhancer'}
        onClose={() => setActiveProfessionalTool(null)}
        pdfBytes={bytes}
        fileName={files[0]?.name}
        onImportToWorkspace={(newPdfBytes: Uint8Array) => {
          handleApplyProfessionalPdf(newPdfBytes);
          setActiveProfessionalTool(null);
        }}
      />
    </div>
  );
}

function SignatureDialog({
  open,
  onOpenChange,
  onSave
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: string) => void;
}) {
  const [mode, setMode] = useState("draw");
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setDrawn(false);
        setName("");
        setMode("draw");
      });
    }
  }, [open]);

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget;
    const ctx = c.getContext("2d")!;
    const box = c.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * c.width;
    const y = ((e.clientY - box.top) / box.height) * c.height;
    if (e.type === "pointerdown") {
      drawing.current = true;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {}
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (drawing.current) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#282c48";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
      setDrawn(true);
    }
  }

  function save() {
    if (mode === "draw") {
      if (drawn && canvas.current) onSave(canvas.current.toDataURL("image/png"));
    } else if (name.trim()) {
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 240;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#282c48";
      ctx.font = "italic 64px Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name.trim(), 320, 120, 600);
      onSave(c.toDataURL("image/png"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="forma-dialog signature-dialog">
        <DialogTitle>İmzanı oluştur</DialogTitle>
        <DialogDescription>İmzanı çiz veya adını yazarak oluştur. Sonra PDF’de yerine koy.</DialogDescription>
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList>
            <TabsTrigger value="draw">İmza çiz</TabsTrigger>
            <TabsTrigger value="type">Yazarak oluştur</TabsTrigger>
          </TabsList>
          <TabsContent value="draw" forceMount hidden={mode !== "draw"}>
            <canvas
              ref={canvas}
              width={640}
              height={240}
              className="signature-canvas"
              aria-label="İmzanı çiz"
              onPointerDown={draw}
              onPointerMove={draw}
              onPointerUp={() => (drawing.current = false)}
              onPointerCancel={() => (drawing.current = false)}
            />
            <button
              className="clear-signature"
              onClick={() => {
                canvas.current?.getContext("2d")?.clearRect(0, 0, 640, 240);
                setDrawn(false);
              }}
            >
              <Trash2 size={14} /> Temizle
            </button>
          </TabsContent>
          <TabsContent value="type">
            <label>
              Adın ve soyadın
              <input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Ad Soyad" />
            </label>
            <div className="typed-signature">{name || "İmzan burada"}</div>
          </TabsContent>
        </Tabs>
        <p className="conversion-note">Bu araç belgeye görsel imza ekler; sertifikalı elektronik imza oluşturmaz.</p>
        <button className="primary" disabled={mode === "draw" ? !drawn : !name.trim()} onClick={save}>
          <Check size={17} /> İmzayı kullan
        </button>
      </DialogContent>
    </Dialog>
  );
}
