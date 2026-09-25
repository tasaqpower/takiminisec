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
  isLogoOrHeader?: boolean;
  strategy?: "pixel_clean" | "object_remove" | "manual_cover";
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

export type CandidateRemovalStatus = "removed" | "unchanged" | "failed" | "blocked" | "skipped" | "not-found";
export type CandidateRemovalStrategy = "pixel_inpainting" | "object_removal" | "text_object_stream" | "manual_cover" | "none";

export interface CandidateRemovalResult {
  candidateId: string;
  status: CandidateRemovalStatus;
  strategy: CandidateRemovalStrategy;
  modifiedPixels?: number;
  reason?: string;
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
  imageStrategy?: "pixel_clean" | "object_remove";
  allowLogoRemoval?: boolean; // Explicit secondary confirmation for logo/image candidates
}

