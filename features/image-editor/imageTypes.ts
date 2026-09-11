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
}
