export type ImageFormat = 'png' | 'jpeg';

export interface PdfToImageOptions {
  format: ImageFormat;
  dpi: number; // e.g. 72, 150, 300
  quality?: number; // 0.1 to 1.0 for jpeg
  pageRange?: number[]; // 1-indexed
}

export interface ImageToPdfItem {
  name: string;
  bytes: Uint8Array;
  type: ImageFormat;
  width?: number;
  height?: number;
}

export interface ImageToPdfOptions {
  pageSize: 'A4' | 'fit-image' | 'Letter';
  orientation: 'auto' | 'portrait' | 'landscape';
  margin: number; // in points
}

export interface PdfToExcelOptions {
  sheetName?: string;
  autoDetectTables?: boolean;
}

export interface PdfToPptxOptions {
  mode?: 'slide-image' | 'vector-shapes';
  slideWidth?: number; // points (default 720 = 10 inches widescreen 16:9 is 960x540)
  slideHeight?: number; // points (default 540)
}

export type ConversionProgressCallback = (current: number, total: number, message: string) => void;
