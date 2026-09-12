export interface PdfDetectedImage {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity?: number;
  dataUrl?: string;
  previewUrl?: string;
  format?: "png" | "jpeg";
  name?: string;
  originalBounds: { left: number; bottom: number; right: number; top: number };
  originalViewport: { x: number; y: number; w: number; h: number };
  objectRef?: string | number;
  imageIndex: number;
  pixelWidth: number;
  pixelHeight: number;
  matrix: number[];
  isMovable: boolean;
  parentFormRef?: string | number;
}

export interface PdfImageItem {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  dataUrl: string;
  format: "png" | "jpeg";
  isOriginal?: boolean;
  name?: string;
  isModified?: boolean;
  deleted?: boolean;
  zIndex?: number;
  originalBounds?: { left: number; bottom: number; right: number; top: number };
  originalViewport?: { x: number; y: number; w: number; h: number };
  previewUrl?: string;
  objectRef?: string | number;
  imageIndex?: number;
  pixelWidth?: number;
  pixelHeight?: number;
  matrix?: number[];
  isMovable?: boolean;
  parentFormRef?: string | number;
}

export type PdfImageEdit = PdfImageItem;

