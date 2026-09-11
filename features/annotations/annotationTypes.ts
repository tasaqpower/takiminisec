export type AnnotationType =
  | 'text' // Sticky note
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'ink' // Freehand
  | 'arrow'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'freetext' // Text box / callout
  | 'stamp';

export type StampPreset =
  | 'onaylandi'
  | 'reddedildi'
  | 'taslak'
  | 'gizli'
  | 'incelendi'
  | 'imzalanacak'
  | 'custom';

export interface Point2D {
  x: number;
  y: number;
}

export interface PdfAnnotation {
  id: string;
  pageIndex: number; // 0-based
  type: AnnotationType;
  rect: [number, number, number, number]; // [minX, minY, maxX, maxY] in PDF points
  author: string;
  date: string; // ISO format
  color: string; // hex (e.g. '#f59e0b')
  opacity: number; // 0 to 1
  contents: string; // Comment / note body
  resolved: boolean;
  stampPreset?: StampPreset;
  stampCustomImage?: string; // dataUrl
  inkPaths?: Point2D[][]; // for freehand strokes
  linePoints?: { x1: number; y1: number; x2: number; y2: number };
  quadPoints?: number[];
  fontSize?: number;
}

export interface AnnotationFilter {
  pageIndex?: number | 'all';
  author?: string | 'all';
  resolved?: boolean | 'all';
  type?: AnnotationType | 'all';
}
