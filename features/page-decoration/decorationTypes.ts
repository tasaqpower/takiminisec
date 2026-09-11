export type WatermarkType = 'text' | 'image';
export type WatermarkLayer = 'foreground' | 'background';
export type PageScope = 'all' | 'even' | 'odd' | 'custom';
export type PageNumberFormat = '1' | '01' | 'i' | 'I' | 'a' | 'A';
export type NinePosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface WatermarkConfig {
  enabled: boolean;
  type: WatermarkType;
  text: string;
  imageDataUrl?: string;
  fontSize: number;
  color: string; // hex
  opacity: number; // 0 to 1
  rotation: number; // -180 to 180
  layer: WatermarkLayer;
  tile: boolean;
  position: { xPercent: number; yPercent: number };
  scope: PageScope;
  customPages?: number[];
}

export interface PageNumberConfig {
  enabled: boolean;
  format: PageNumberFormat;
  template: string; // e.g. '{n}', 'Sayfa {n} / {total}', '{n} / {total}'
  startNumber: number;
  startFromPage: number; // 1-based page index to start numbering
  excludeCover: boolean;
  position: NinePosition;
  fontSize: number;
  color: string; // hex
  margin: number; // points
}

export interface HeaderFooterConfig {
  enabled: boolean;
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  fontSize: number;
  color: string; // hex
  margin: number; // points
  excludeCover: boolean;
}

export interface PageDecorationConfig {
  watermark: WatermarkConfig;
  pageNumber: PageNumberConfig;
  headerFooter: HeaderFooterConfig;
  fileName?: string;
}
