export type CompareMode = 'text' | 'visual' | 'combined';

export type DiffType = 'added' | 'deleted' | 'modified' | 'unchanged';

export interface TextDiffItem {
  type: DiffType;
  text: string;
  pageIndex: number;
  lineIndex?: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface PageDiffResult {
  pageIndex: number;
  hasDifferences: boolean;
  textDiffs: TextDiffItem[];
  diffPixelCount: number;
  diffPercent: number;
  diffImageDataUrl?: string;
  leftPageNumber: number;
  rightPageNumber: number;
}

export interface CompareOptions {
  mode: CompareMode;
  ignoreWhitespace: boolean;
  caseSensitive: boolean;
  pixelThreshold: number; // 0 to 255 (e.g. 35)
  dpi: number; // 72 to 150
}

export interface CompareSummary {
  mode: CompareMode;
  totalDifferences: number;
  addedCount: number;
  deletedCount: number;
  modifiedCount: number;
  pageDiffs: PageDiffResult[];
  leftPageCount: number;
  rightPageCount: number;
  executionTimeMs: number;
}
