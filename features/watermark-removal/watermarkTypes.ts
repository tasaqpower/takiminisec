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

export interface WatermarkRemovalOptions {
  candidateIds: string[];
  customText?: string;
  customCaseSensitive?: boolean;
  pageScope: "all" | "current" | "custom";
  customPages?: number[];
  currentPage: number;
}
