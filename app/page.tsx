"use client";
import { useRef, useState, useEffect } from "react";
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  File,
  FileInput,
  FilePlus2,
  Files,
  FileText,
  FileType2,
  FolderOpen,
  LayoutGrid,
  LockKeyhole,
  Merge,
  PenLine,
  Plus,
  ScanText,
  Scissors,
  ShieldCheck,
  Sparkles,
  Upload,
  Eraser,
  FileSpreadsheet,
  EyeOff,
  Stamp,
  Camera,
  GitCompare,
  Image as ImageIcon,
  Film
} from "lucide-react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Toaster, toast } from "sonner";
import { RecoveryDialog } from "@/features/autosave/RecoveryDialog";
import type { FormaDraft } from "@/features/autosave/db";
import { ToolHubModal, type ProfessionalToolId } from "@/features/hub/ToolHubModal";
import { DocumentScannerModal } from "@/features/scanner/DocumentScannerModal";
import { PdfCompareModal } from "@/features/compare/PdfCompareModal";
import { BatchProcessingModal } from "@/features/batch/BatchProcessingModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FormaAiCopilot } from "@/features/ai-copilot/FormaAiCopilot";
import { ModeSelectionScreen } from "@/features/video-editor/components/ModeSelectionScreen";
import { VideoEditorWorkspace } from "@/features/video-editor/components/VideoEditorWorkspace";

export const essentialTools = [
  { id: "edit", title: "PDF düzenle", desc: "Metin, not, canlı fatura & fiyat düzeltici.", icon: FileText, color: "violet", type: "PDF", popular: true },
  { id: "enhancer", title: "Görsel Netleştir", desc: "Bulanık taranmış yazıları koyulaştır ve fotoğrafları keskinleştir.", icon: Sparkles, color: "rose", type: "PDF · JPG · PNG", isNew: true },
  { id: "merge", title: "PDF birleştir", desc: "Birden çok dosya, tek bir kusursuz belge.", icon: Merge, color: "teal", type: "PDF" },
  { id: "pages", title: "Sayfaları düzenle", desc: "Ayır, döndür, sırala veya sayfa sil.", icon: Scissors, color: "amber", type: "PDF" },
  { id: "compress", title: "PDF sıkıştır", desc: "Kaliteyi koruyarak dosya boyutunu küçült.", icon: Archive, color: "indigo", type: "PDF" },
  { id: "sign", title: "PDF imzala", desc: "El yazısı veya resmî imzanı belgede yerine koy.", icon: PenLine, color: "pink", type: "PDF" },
];

export const conversionTools = [
  { id: "pdf-to-word", title: "PDF → Word (.docx)", desc: "PDF'i düzenlenebilir Microsoft Word belgesine çevir.", icon: FileType2, color: "blue", type: "PDF", isNew: true },
  { id: "word-to-pdf", title: "Word → PDF", desc: "DOCX belgelerini sayfalanmış vektörel PDF'e dönüştür.", icon: FileInput, color: "indigo", type: "DOCX" },
  { id: "excel-to-pdf", title: "Excel → PDF", desc: "XLSX ve CSV tablolarını şık sayfalanmış PDF'e dönüştür.", icon: FileSpreadsheet, color: "teal", type: "XLSX · CSV" },
  { id: "pdf-to-excel", title: "PDF → Excel (.xlsx)", desc: "PDF içerisindeki tabloları tek tıkla Excel'e aktar.", icon: FileSpreadsheet, color: "teal", type: "PDF" },
  { id: "pdf-to-img", title: "PDF → Görsel (PNG / JPG)", desc: "Sayfaları yüksek çözünürlüklü görsellere dönüştür.", icon: ImageIcon, color: "purple", type: "PDF" },
  { id: "img-to-pdf", title: "Görsel → PDF", desc: "Fotoğraf ve taranmış belgeleri vektörel PDF yap.", icon: Upload, color: "rose", type: "JPG · PNG" },
  { id: "convert", title: "Gelişmiş Dönüştürücü", desc: "PowerPoint, TXT, HTML ve tüm formatlar.", icon: FileInput, color: "orange", type: "TÜM FORMATLAR" },
];

export const specializedTools = [
  { id: "stamp", title: "Resmi Kaşe & Mühür", desc: "Aslı gibidir, onaylandı veya şirket kaşesi bas.", icon: Stamp, color: "rose", type: "PDF" },
  { id: "kvkk", title: "KVKK & Sansür", desc: "TC, IBAN, telefon ve kart bilgilerini otomatik maskele.", icon: EyeOff, color: "amber", type: "PDF" },
  { id: "watermark", title: "Filigran kaldır", desc: "Damga, mühür ve taslak yazılarını sıfır hasarla sil.", icon: Eraser, color: "rose", type: "PDF" },
  { id: "ocr", title: "Tara ve OCR", desc: "Taranmış belgeleri aranabilir metne dönüştür.", icon: ScanText, color: "violet", type: "PDF" },
  { id: "scanner", title: "Belge Tarayıcı", desc: "Kamera veya görselden 4 noktalı köşe ve gölge düzelt.", icon: Camera, color: "blue", type: "Görsel" },
  { id: "compare", title: "PDF Karşılaştır", desc: "İki belge arasındaki metin ve piksel farklarını bul.", icon: GitCompare, color: "teal", type: "2x PDF" },
];

export const allTools = [...essentialTools, ...conversionTools, ...specializedTools];

export default function Home() {
  const [activeMode, setActiveMode] = useState<"selection" | "document" | "video">("selection");
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("essential"), [intent, setIntent] = useState("edit"), [dragging, setDragging] = useState(false), [help, setHelp] = useState(false), [loading, setLoading] = useState(false);
  const intentRef = useRef("edit");
  const [workspace, setWorkspace] = useState<{ files: File[]; intent: string; id: string; draft?: FormaDraft } | null>(null);
  const [Editor, setEditor] = useState<React.ComponentType<any> | null>(null);
  const [dirty, setDirty] = useState(false), [leave, setLeave] = useState(false);
  const nextAction = useRef<(() => void) | null>(null);

  const [showToolHub, setShowToolHub] = useState(false);
  const [activeStandaloneTool, setActiveStandaloneTool] = useState<ProfessionalToolId | null>(null);
  const [EnhancerModal, setEnhancerModal] = useState<React.ComponentType<any> | null>(null);
  const [ConversionModal, setConversionModal] = useState<React.ComponentType<any> | null>(null);

  async function showEnhancer() {
    if (!EnhancerModal) {
      const m = await import("@/features/enhancer/DocumentEnhancerModal");
      setEnhancerModal(() => m.DocumentEnhancerModal);
    }
    setActiveStandaloneTool("enhancer");
  }

  async function showConversion() {
    if (!ConversionModal) {
      const m = await import("@/features/conversion/AdvancedConversionModal");
      setConversionModal(() => m.AdvancedConversionModal);
    }
    setActiveStandaloneTool("conversion");
  }

  useEffect(() => {
    // Migration: ensure legacy external AI key is safely removed from browser storage
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("forma_gemini_api_key");
        const params = new URLSearchParams(window.location.search);
        const m = params.get("mode");
        if (m === "video") setActiveMode("video");
        else if (m === "document") setActiveMode("document");
      }
    } catch {}

    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowToolHub(v => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function guard(action: () => void) {
    if (dirty && workspace) {
      nextAction.current = action;
      setLeave(true);
    } else action();
  }

  async function open(files: File[], action = intentRef.current, draft?: FormaDraft) {
    if (!files.length) return;
    if (files.some(f => ! /\.(pdf|docx|txt|png|jpe?g|xlsx|xls|csv)$/i.test(f.name))) {
      toast.error("PDF, DOCX, TXT, PNG, JPG, Excel veya CSV dosyası seç.");
      return;
    }
    if (files.some(f => f.size > 50 * 1024 * 1024)) {
      toast.error("Her dosya en fazla 50 MB olabilir.");
      return;
    }
    setLoading(true);
    try {
      if (/\.pdf$/i.test(files[0].name) && action === "pdf-to-word") {
        const buf = await files[0].arrayBuffer();
        const baseName = files[0].name.replace(/\.[^/.]+$/, '');
        const { pdfToDocx } = await import("@/features/conversion/docxConverter");
        const docxBytes = await pdfToDocx(new Uint8Array(buf), { title: baseName });
        const { download } = await import("@/lib/documents");
        download(docxBytes, `${baseName}_duzenlenebilir.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        toast.success("PDF başarıyla düzenlenebilir Word (.docx) belgesine dönüştürüldü!");
        setLoading(false);
        return;
      }

      if (/\.docx$/i.test(files[0].name) && (action === "word-to-pdf" || action === "convert")) {
        const buf = await files[0].arrayBuffer();
        const baseName = files[0].name.replace(/\.[^/.]+$/, '');
        const { docxToPdf } = await import("@/features/conversion/docxConverter");
        const convertedBytes = await docxToPdf(new Uint8Array(buf), { title: baseName });
        const pdfFile = new (File as any)([convertedBytes], `${baseName}.pdf`, { type: "application/pdf" });
        files = [pdfFile];
        toast.success("Word belgesi sayfalanmış vektör PDF'e dönüştürüldü!");
      }
      if (/\.(xlsx|xls|csv)$/i.test(files[0].name)) {
        const buf = await files[0].arrayBuffer();
        const baseName = files[0].name.replace(/\.[^/.]+$/, '');
        const { excelToPdf } = await import("@/features/conversion/excelToPdf");
        const convertedBytes = await excelToPdf(new Uint8Array(buf), { title: baseName, orientation: "auto" });
        const pdfFile = new (File as any)([convertedBytes], `${baseName}.pdf`, { type: "application/pdf" });
        files = [pdfFile];
        toast.success("Excel tablosu sayfalanmış vektör PDF'e dönüştürüldü!");
      }
      if (/\.(png|jpe?g|webp)$/i.test(files[0].name)) {
        const { imagesToPdf } = await import("@/features/conversion/conversionEngine");
        const items = await Promise.all(
          files.map(async (f) => ({
            name: f.name,
            bytes: new Uint8Array(await f.arrayBuffer()),
            type: /\.png$/i.test(f.name) ? ("png" as const) : ("jpeg" as const),
          }))
        );
        const convertedBytes = await imagesToPdf(items, {
          pageSize: "A4",
          orientation: "auto",
          margin: 15,
        });
        const baseName = files[0].name.replace(/\.[^/.]+$/, "");
        const pdfFile = new (File as any)([convertedBytes as unknown as BlobPart], `${baseName}.pdf`, { type: "application/pdf" });
        files = [pdfFile];
        toast.success("Görsel sayfalanmış PDF belgesine dönüştürüldü!");
      }

      const m = await import("./workspace");
      setEditor(() => m.default);
      setWorkspace({ files, intent: action, id: crypto.randomUUID(), draft });
    } catch (err: any) {
      toast.error("Dosya açılamadı: " + (err?.message || "Lütfen yeniden dene."));
    } finally {
      setLoading(false);
    }
  }

  function pick(action: string) {
    if (action === "enhancer") {
      void showEnhancer();
      return;
    }
    if (action === "convert" || action === "conversion" || action === "pdf-to-img" || action === "img-to-pdf" || action === "pdf-to-excel") {
      void showConversion();
      return;
    }
    if (action === "scanner") {
      setActiveStandaloneTool("scanner");
      return;
    }
    if (action === "compare") {
      setActiveStandaloneTool("compare");
      return;
    }
    if (action === "batch") {
      setActiveStandaloneTool("batch");
      return;
    }

    guard(() => {
      intentRef.current = action;
      setIntent(action);
      if (input.current) {
        input.current.multiple = action === "merge";
        input.current.accept = action === "excel-to-pdf"
          ? ".xlsx,.xls,.csv"
          : action === "word" || action === "word-to-pdf"
          ? ".docx,.txt"
          : action === "pdf-to-word"
          ? ".pdf"
          : ["edit", "sign", "merge", "pages", "compress", "ocr", "watermark", "decoration", "navigation", "annotations", "compliance", "stamp", "kvkk"].includes(action)
          ? ".pdf"
          : ".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.xls,.csv";
        input.current.click();
      }
    });
  }

  const handleSelectToolFromHub = (toolId: ProfessionalToolId) => {
    setShowToolHub(false);
    if (toolId === "enhancer") {
      void showEnhancer();
    } else if (toolId === "conversion") {
      void showConversion();
    } else if (toolId === "scanner") {
      setActiveStandaloneTool("scanner");
    } else if (toolId === "compare") {
      setActiveStandaloneTool("compare");
    } else if (toolId === "batch") {
      setActiveStandaloneTool("batch");
    } else if (toolId === "watermark-removal") {
      pick("watermark");
    } else if (toolId === "page-sizing") {
      pick("pages");
    } else if (toolId === "signature") {
      pick("sign");
    } else if (toolId === "stamp") {
      pick("stamp");
    } else if (toolId === "kvkk") {
      pick("kvkk");
    } else {
      pick(toolId);
    }
  };

  async function newDoc() {
    await open([new globalThis.File([""], "Adsız belge.txt", { type: "text/plain" })], "word");
  }

  if (activeMode === "selection") {
    return (
      <ModeSelectionScreen
        onSelectDocument={() => setActiveMode("document")}
        onSelectVideo={() => setActiveMode("video")}
      />
    );
  }

  if (activeMode === "video") {
    return (
      <VideoEditorWorkspace
        onNavigateHome={() => setActiveMode("selection")}
      />
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "264px" } as React.CSSProperties}>
      <Sidebar className="forma-sidebar">
        <SidebarHeader className="brand">
          <a href="/" aria-label="Forma ana sayfa" onClick={(e) => { e.preventDefault(); guard(() => setActiveMode("selection")); }}>
            <span className="brand-symbol"><Files size={23} /></span>
            <span>forma<span className="brand-dot">.</span></span>
          </a>
        </SidebarHeader>
        <SidebarContent className="sidebar-body">
          <button className="primary sidebar-upload" onClick={() => pick("edit")}>
            <Plus size={19} /> Dosya aç
          </button>
          <span className="nav-caption">ÇALIŞMA ALANIN</span>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="nav-item" onClick={() => guard(() => setActiveMode("selection"))}>
                <LayoutGrid /><span>Mod Değiştir (Ana Ekran)</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="nav-item" onClick={() => guard(() => setActiveMode("video"))}>
                <Film className="text-violet-500" /><span>Video Düzenle</span>
                <span className="nav-new" style={{ background: "#ede9fe", color: "#6d28d9" }}>Yeni</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="nav-item" isActive={!workspace} onClick={() => guard(() => setWorkspace(null))}>
                <LayoutGrid /><span>Belge Genel bakış</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="nav-item" onClick={() => setShowToolHub(true)}>
                <Sparkles className="text-amber-500" /><span>Tüm Araçlar</span>
                <span className="nav-new" style={{ background: "#fef3c7", color: "#b45309" }}>Ctrl+K</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="nav-item" onClick={() => pick("edit")}>
                <FolderOpen /><span>Dosya aç</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <span className="nav-caption tools-caption">ÖNEMLİ ARAÇLAR</span>
          <SidebarMenu>
            {essentialTools.map(t => (
              <SidebarMenuItem key={t.id}>
                <SidebarMenuButton className="nav-item" onClick={() => pick(t.id)}>
                  <t.icon /><span>{t.title}</span>
                  {"isNew" in t && t.isNew && (
                    <b className="nav-new not-truncate" style={{ background: "#ede9fe", color: "#6d28d9" }}>Yeni</b>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <span className="nav-caption tools-caption" style={{ marginTop: "14px" }}>DÖNÜŞÜMLER</span>
          <SidebarMenu>
            {conversionTools.map(t => (
              <SidebarMenuItem key={t.id}>
                <SidebarMenuButton className="nav-item" onClick={() => pick(t.id)}>
                  <t.icon /><span>{t.title}</span>
                  {"isNew" in t && t.isNew && (
                    <b className="nav-new not-truncate" style={{ background: "#eff6ff", color: "#1d4ed8" }}>Yeni</b>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <span className="nav-caption tools-caption" style={{ marginTop: "14px" }}>ÖZEL ATÖLYE ARAÇLARI</span>
          <SidebarMenu>
            {specializedTools.map(t => (
              <SidebarMenuItem key={t.id}>
                <SidebarMenuButton className="nav-item" onClick={() => pick(t.id)}>
                  <t.icon /><span>{t.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="local-card">
            <span className="local-icon"><ShieldCheck size={21} /></span>
            <strong>Dosyaların, sende kalır.</strong>
            <p>Belgelerin cihazında işlenir.<br />Sunucuya yüklenmez.</p>
            <span><LockKeyhole size={12} /> Gizlilik, varsayılan ayar.</span>
          </div>
        </SidebarContent>
        <SidebarFooter className="sidebar-footer">
          <ThemeToggle showLabel className="w-full justify-start mb-2" />
          <button onClick={() => setHelp(true)}>
            <BookOpen size={17} /> Kısa kullanım rehberi <ArrowUpRight size={15} />
          </button>
          <div className="profile">
            <span className="avatar">S</span>
            <span><strong>Kişisel çalışma alanı</strong><small>Biraz daha düzenli, biraz daha kolay.</small></span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-trigger" />
            <button
              onClick={() => guard(() => setActiveMode("selection"))}
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
            >
              Ana Sayfa
            </button>
            <ChevronRight size={14} />
            <span>Belge Alanı</span>
            <ChevronRight size={14} />
            <strong>{workspace ? "Belge düzenleyici" : "Genel bakış"}</strong>
          </div>
          <span className="private-label"><ShieldCheck size={15} /> Tamamen cihazında</span>
          <ThemeToggle showLabel />
          <button className="top-help" aria-label="Kullanım rehberi" onClick={() => setHelp(true)}>
            <BookOpen size={18} />
          </button>
        </header>

        {workspace && Editor ? (
          <Editor
            key={workspace.id}
            files={workspace.files}
            intent={workspace.intent}
            initialDraft={workspace.draft}
            onClose={() => setWorkspace(null)}
            onOpen={pick}
            onDirty={setDirty}
          />
        ) : (
          <div className="dashboard">
            <div className="page-heading">
              <div>
                <div className="eyebrow"><span /> DAHA AZ UĞRAŞ, DAHA ÇOK İŞ</div>
                <h1>Belgelerine yer aç.</h1>
                <p>Düzenle, dönüştür, imzala. Hepsi aynı çalışma alanında.</p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button className="secondary create-doc" style={{ marginTop: 0 }} onClick={newDoc}>
                  <FilePlus2 size={17} /> Yeni belge
                </button>
              </div>
            </div>
            <section
              className={`upload-zone ${dragging ? "dragging" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setDragging(false);
                void open(Array.from(e.dataTransfer.files), "edit");
              }}
            >
              <div className="upload-visual">
                <span className="file-tile word-tile"><FileType2 /><small>DOCX</small></span>
                <span className="file-tile pdf-tile"><FileText /><small>PDF</small></span>
                <span className="file-tile image-tile"><File /><small>JPG</small></span>
              </div>
              <h2>Dosyanı bırak, gerisini kolaylaştıralım.</h2>
              <p>Buraya sürükleyip bırak veya cihazından bir dosya seç.</p>
              <button className="primary upload-button" disabled={loading} onClick={() => pick("edit")}>
                <Upload size={18} />{loading ? "Düzenleyici açılıyor…" : "Dosya seç"}<ArrowRight size={17} />
              </button>
              <div className="upload-formats">
                <span>PDF</span><span>DOCX</span><span>TXT</span><span>JPG / PNG</span>
                <i /> En fazla 50 MB / dosya
              </div>
            </section>
            <section className="tool-section">
              <div className="section-heading">
                <div>
                  <h2>
                    {category === "conversions" ? "Dönüşümler" : "Önemli Araçlar"}
                    <span>
                      {category === "conversions" ? conversionTools.length : essentialTools.length}
                    </span>
                  </h2>
                  <p>
                    {category === "conversions"
                      ? "Word, Excel, Görsel ve PDF arasında yüksek kaliteli çift yönlü dönüşümler."
                      : "Günlük işlerinde en çok ihtiyaç duyduğun kritik belge araçları."}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <Tabs value={category} onValueChange={setCategory}>
                    <TabsList className="category-tabs">
                      <TabsTrigger value="essential">Önemli Araçlar</TabsTrigger>
                      <TabsTrigger value="conversions">Dönüşümler</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              <div className="tool-grid">
                {(category === "conversions" ? conversionTools : essentialTools)
                  .map(t => (
                    <button className="tool-card" key={t.id} onClick={() => pick(t.id)}>
                      <div className="tool-card-top">
                        <span className={`tool-icon ${t.color}`}><t.icon size={23} /></span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {"isNew" in t && t.isNew && (
                            <span style={{ fontSize: "10px", fontWeight: 700, background: "#ede9fe", color: "#6d28d9", padding: "2px 6px", borderRadius: "6px" }}>
                              Yeni
                            </span>
                          )}
                          {"popular" in t && Boolean((t as any).popular) && (
                            <span style={{ fontSize: "10px", fontWeight: 700, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: "6px" }}>
                              Popüler
                            </span>
                          )}
                          <ArrowUpRight className="card-arrow" size={18} />
                        </div>
                      </div>
                      <h3>{t.title}</h3>
                      <p>{t.desc}</p>
                      <span className="file-type">{t.type}</span>
                    </button>
                  ))}
              </div>
            </section>
            <section className="start-strip">
              <span className="strip-icon"><Sparkles size={23} /></span>
              <div>
                <h3>Boş sayfa, yeni bir başlangıç.</h3>
                <p>Sıfırdan bir belge oluştur; Word veya PDF olarak indir.</p>
              </div>
              <button onClick={newDoc}>Belge oluştur <ArrowRight size={17} /></button>
            </section>
            <footer className="dashboard-footer">
              <span><LockKeyhole size={13} /> Dosyalar cihazından ayrılmaz.</span>
              <span>Senin belgelerin. Senin kontrolün.</span>
              <span>FORMA <i> / </i> BELGE ATÖLYESİ</span>
            </footer>
          </div>
        )}
      </main>
      <input
        ref={input}
        className="sr-only"
        type="file"
        tabIndex={-1}
        aria-label="Belge seç"
        onChange={e => {
          void open(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="forma-dialog">
          <DialogTitle>Forma ile başla</DialogTitle>
          <DialogDescription>Belgeni aç, araçlarını seç ve sonucu indir.</DialogDescription>
          <div className="help-list">
            <p><strong>PDF düzenle</strong>Metin, vurgu, çizim ve görsel imza ekle. Sayfaları döndür, sil, sırala veya ayır.</p>
            <p><strong>Word düzenle</strong>DOCX ve TXT belgelerini aç. Metni ve temel biçimlendirmeyi düzenle; DOCX veya PDF indir.</p>
            <p><strong>Dönüştür</strong>PDF metnini Word’e, Word’ü PDF’ye veya görselleri PDF’ye dönüştür. Karmaşık Word yerleşimleri sadeleşebilir; taranmış PDF’lerde metin tanıma bulunmaz.</p>
            <p><strong>Gizlilik</strong>Dosyalar tarayıcı belleğinde işlenir. Sayfayı kapatmadan önce değişikliklerini indir.</p>
          </div>
          <button className="primary" onClick={() => setHelp(false)}>
            <Check size={17} /> Anladım
          </button>
        </DialogContent>
      </Dialog>
      <AlertDialog open={leave} onOpenChange={setLeave}>
        <AlertDialogContent>
          <AlertDialogTitle>İndirilmemiş değişiklikler var</AlertDialogTitle>
          <AlertDialogDescription>Belgeyi değiştirirsen indirmediğin düzenlemeler kaybolur.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Düzenlemeye dön</AlertDialogCancel>
            <AlertDialogAction onClick={() => { nextAction.current?.(); nextAction.current = null; }}>Devam et</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RecoveryDialog
        onRestore={async (draft) => {
          const file = new globalThis.File([draft.fileData], draft.name, {
            type: draft.type === "word" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf"
          });
          await open([file], draft.intent || "edit", draft);
        }}
      />
      <ToolHubModal
        isOpen={showToolHub}
        onClose={() => setShowToolHub(false)}
        onSelectTool={handleSelectToolFromHub}
      />

      <DocumentScannerModal
        isOpen={activeStandaloneTool === 'scanner'}
        onClose={() => setActiveStandaloneTool(null)}
        onImportToWorkspace={async (newPdfBytes, newFileName) => {
          setActiveStandaloneTool(null);
          const scannedFile = new globalThis.File(
            [newPdfBytes as unknown as BlobPart],
            newFileName || "Taranmis_Belge.pdf",
            { type: "application/pdf" }
          );
          await open([scannedFile], "edit");
        }}
      />

      <PdfCompareModal
        isOpen={activeStandaloneTool === 'compare'}
        onClose={() => setActiveStandaloneTool(null)}
      />

      <BatchProcessingModal
        isOpen={activeStandaloneTool === 'batch'}
        onClose={() => setActiveStandaloneTool(null)}
      />

      {EnhancerModal && (
        <EnhancerModal
          isOpen={activeStandaloneTool === 'enhancer'}
          onClose={() => setActiveStandaloneTool(null)}
          onImportToWorkspace={async (newPdfBytes: Uint8Array, newFileName: string) => {
            setActiveStandaloneTool(null);
            const enhancedFile = new globalThis.File(
              [newPdfBytes as unknown as BlobPart],
              newFileName || "Netlestirilmis_Belge.pdf",
              { type: "application/pdf" }
            );
            await open([enhancedFile], "edit");
          }}
        />
      )}

      {ConversionModal && (
        <ConversionModal
          isOpen={activeStandaloneTool === 'conversion'}
          onClose={() => setActiveStandaloneTool(null)}
          pdfBytes={null}
          onOpenConvertedPdf={async (newPdfBytes: Uint8Array, newFileName: string) => {
            setActiveStandaloneTool(null);
            const convertedFile = new globalThis.File(
              [newPdfBytes as unknown as BlobPart],
              newFileName || "Donusturulmus_Belge.pdf",
              { type: "application/pdf" }
            );
            await open([convertedFile], "edit");
          }}
        />
      )}

      {!workspace && (
        <FormaAiCopilot
          onOpenDocument={(files) => open(files, "edit")}
        />
      )}

      <Toaster position="bottom-right" richColors closeButton duration={1000} />
    </SidebarProvider>
  );
}
