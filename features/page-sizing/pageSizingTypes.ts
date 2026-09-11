export type PageSizingScope = 'single' | 'selected' | 'all' | 'even' | 'odd';

export type PageStandardSize = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Custom';

export type ResizeScalingMode = 'fit-proportional' | 'center' | 'add-margins' | 'extend-page';

export interface PageCropMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PageCropOptions {
  margins: PageCropMargins;
  scope: PageSizingScope;
  selectedPages?: number[];
  autoDetectWhiteMargins?: boolean;
}

export interface PageResizeOptions {
  standardSize: PageStandardSize;
  customWidth?: number; // points
  customHeight?: number; // points
  orientation: 'portrait' | 'landscape';
  scalingMode: ResizeScalingMode;
  margin: number; // points
  scope: PageSizingScope;
  selectedPages?: number[];
}
