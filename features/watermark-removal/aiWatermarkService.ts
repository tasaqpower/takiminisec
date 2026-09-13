import { loadPdf } from "@/lib/documents";
import { normalizeTurkish, WATERMARK_KEYWORDS, reconstructPageLines } from "./watermarkDetector";
import { editablePageText } from "@/lib/pdf-text";
import type { WatermarkCandidate } from "./watermarkTypes";

export interface AiDetectedWatermark {
  text: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  confidence: number;
  type: "text" | "stamp" | "logo";
  reason?: string;
}

/**
 * Render a specific page of a PDF to a JPEG base64 data URL
 */
export async function renderPdfPageToDataUrl(pdfBytes: Uint8Array, pageIndex: number): Promise<{ dataUrl: string; width: number; height: number }> {
  const doc = await loadPdf(pdfBytes);
  try {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context could not be created");

    await page.render({ canvasContext: ctx, viewport }).promise;
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      width: viewport.width,
      height: viewport.height
    };
  } finally {
    try { await doc.loadingTask.destroy(); } catch {}
  }
}

/**
 * Detect watermarks using Google Gemini Vision API
 */
export async function detectWatermarksWithGemini(
  pageJpegDataUrl: string,
  apiKey: string
): Promise<AiDetectedWatermark[]> {
  const base64Data = pageJpegDataUrl.includes(",") ? pageJpegDataUrl.split(",")[1] : pageJpegDataUrl;

  const prompt = `Sen uzman bir belge ve PDF analiz yapay zekasısın.
Bu belge sayfasında yer alan tüm FİLİGRANLARI, TASLAK DAMGALARINI, GEÇERSİZLİK İBARELERİNİ, ÖRNEK DAMGALARINI ve LOGOLARI tespit et.
Özellikle şu tür ibareleri ara:
- 'GEÇERSİZ', 'GECERSIZ', 'GEÇERSİZDİR'
- 'ÖRNEK', 'ORNEK', 'ÖRNEK BELGEDİR', 'ORNEK BELGEDIR', 'ÖRNEKTİR'
- 'TASLAK', 'DRAFT', 'GİZLİ', 'CONFIDENTIAL'
- 'KOPYA', 'NUMUNE', 'DENEME', 'VOID', 'SAMPLE'
- Çapraz veya saydam yazılmış tüm damgalar ve logolar.

Her tespit ettiğin filigran için:
1. text: Filigrandaki tam metin
2. box_2d: [ymin, xmin, ymax, xmax] koordinatları (0 ile 1000 arasında normalize edilmiş)
3. confidence: 0-100 arası güven skoru
4. type: 'text' veya 'stamp' veya 'logo'
5. reason: Tespit gerekçesi

Belgede filigran yoksa boş dizi döndür: { "watermarks": [] }`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Hatası (${response.status}): ${errorText.slice(0, 150)}`);
  }

  const result = await response.json();
  const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) return [];

  try {
    const parsed = JSON.parse(textResponse);
    const list = Array.isArray(parsed) ? parsed : parsed.watermarks || [];
    return list.filter((item: any) => Array.isArray(item.box_2d) && item.box_2d.length === 4);
  } catch (err) {
    console.error("Gemini response parse error:", err, textResponse);
    return [];
  }
}

/**
 * Convert AI detected box_2d (0-1000) to WatermarkCandidate
 */
export function convertAiDetectionToCandidate(
  aiItem: AiDetectedWatermark,
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
  index: number
): WatermarkCandidate {
  const [ymin, xmin, ymax, xmax] = aiItem.box_2d;

  // Convert normalized 0-1000 coordinates to PDF coordinates
  const left = (xmin / 1000) * pageWidth;
  const right = (xmax / 1000) * pageWidth;
  const top = (ymin / 1000) * pageHeight;
  const bottom = (ymax / 1000) * pageHeight;

  const w = Math.max(10, right - left);
  const h = Math.max(10, bottom - top);

  // PDF coordinate system (y=0 at bottom)
  const pdfY = pageHeight - bottom;

  const quad = [
    left, pageHeight - top,
    right, pageHeight - top,
    left, pageHeight - bottom,
    right, pageHeight - bottom
  ];

  return {
    id: `wm-ai-${pageIndex}-${index}`,
    type: aiItem.type === "logo" ? "image" : "text",
    text: aiItem.text || "Yapay Zeka Tespitli Filigran",
    count: 1,
    pages: [pageIndex],
    confidence: Math.max(85, Math.min(99, aiItem.confidence || 95)),
    reason: aiItem.reason || "Google Gemini Vision AI tarafından tespit edildi",
    fontSize: Math.round(h * 0.7),
    angle: 0,
    color: "#222222",
    textRemovals: [
      {
        id: `ai-rem-${pageIndex}-${index}`,
        page: pageIndex,
        quad
      }
    ],
    imageBounds: {
      x: left,
      y: pdfY,
      w,
      h
    }
  };
}
