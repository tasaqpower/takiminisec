export interface PdfBookmarkItem {
  id: string;
  title: string;
  pageIndex: number; // 0-based
  children?: PdfBookmarkItem[];
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

export type LinkType = 'external' | 'internal' | 'email';

export interface PdfLinkItem {
  id: string;
  pageIndex: number;
  rect: [number, number, number, number]; // [minX, minY, maxX, maxY]
  type: LinkType;
  target: string; // url, email, or page number string
  isDangerous?: boolean;
  displayText?: string;
}

export interface TocHeadingCandidate {
  id: string;
  title: string;
  pageIndex: number;
  level: 1 | 2 | 3;
  fontSize: number;
  selected: boolean;
}
