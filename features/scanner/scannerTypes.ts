export type FilterMode = 'color' | 'grayscale' | 'bw';

export interface Point {
  x: number;
  y: number;
}

export interface QuadCorners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface ImageAdjustments {
  brightness: number; // -100 to 100 (0 default)
  contrast: number; // -100 to 100 (0 default)
  sharpness: number; // 0 to 100 (0 default)
  shadowReduction: number; // 0 to 100 (0 default)
  filterMode: FilterMode;
  deskewAngle: number; // degrees
}

export interface ScannedPage {
  id: string;
  originalDataUrl: string;
  processedDataUrl: string;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  corners?: QuadCorners;
  adjustments: ImageAdjustments;
  exifOrientation?: number;
}

export interface ScannerExportOptions {
  fitToA4: boolean;
  margin: 'none' | 'small' | 'normal';
  applyOcr: boolean;
  ocrLanguage: string;
}