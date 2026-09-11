export type PdfAConformanceLevel = '2b' | '1b' | '3b';

export interface PdfAConversionOptions {
  conformance?: PdfAConformanceLevel;
  title?: string;
  language?: string;
  author?: string;
}

export type AccessibilityIssueSeverity = 'error' | 'warning' | 'info';

export interface AccessibilityIssue {
  id: string;
  rule: string;
  description: string;
  severity: AccessibilityIssueSeverity;
  element?: string;
  fixRecommendation: string;
}

export interface AccessibilityReport {
  score: number; // 0 to 100
  hasTitle: boolean;
  hasLanguage: boolean;
  isTagged: boolean;
  hasAltTextOnImages: boolean;
  hasFormFieldLabels: boolean;
  issues: AccessibilityIssue[];
  timestamp: string;
}

export interface AccessibilityFixOptions {
  title?: string;
  language?: string; // e.g. 'tr-TR'
  markTagged?: boolean;
  defaultAltText?: string;
}
