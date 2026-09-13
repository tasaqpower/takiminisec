import type { ImageRemoval } from "@/lib/pdf-text";

export interface WatermarkCandidate {
  id: string;
  type: "text" | "image" | "annotation";
  text?: string;
  count: number;
  pages: number[];
  fontSize?: number;
  angle?: number;
  color?: string;
  reason: string;
  confidence: number; // 0 - 100
  textRemovals?: { id: string; page: number; quad: number[] }[];
  imageRemovals?: ImageRemoval[];
  imagePreviewUrl?: string;
  imageBounds?: { x: number; y: number; w: number; h: number };
}

export interface WatermarkBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  page?: number;
}

export interface WatermarkRemovalOptions {
  candidateIds: string[];
  customText?: string;
  customCaseSensitive?: boolean;
  pageScope: "all" | "current" | "custom";
  customPages?: number[];
  currentPage: number;
  fillColor?: { r: number; g: number; b: number }; // Sampled paper color (0-1)
  manualBoxes?: WatermarkBox[]; // Multi-box manual areas
  brushMaskDataUrl?: string; // Freehand brush mask (PNG data URL)
}
