export type BatchOperation =
  | 'compress'
  | 'watermark'
  | 'page_number'
  | 'protect'
  | 'sanitize_metadata'
  | 'ocr'
  | 'pdf_to_images'
  | 'images_to_pdf'
  | 'merge';

export type BatchFileStatus = 'pending' | 'processing' | 'success' | 'error' | 'cancelled';

export interface BatchFileItem {
  id: string;
  name: string;
  size: number;
  status: BatchFileStatus;
  progress: number; // 0 - 100
  bytes: Uint8Array;
  resultBytes?: Uint8Array;
  resultName?: string;
  error?: string;
  executionTimeMs?: number;
}

export interface BatchConfig {
  operation: BatchOperation;
  maxConcurrent?: number; // 1 or 2
  compressPreset?: 'light' | 'balanced' | 'strong';
  watermarkText?: string;
  watermarkOpacity?: number;
  pageNumberFormat?: '1' | '01' | 'i' | 'I';
  password?: string;
  imageFormat?: 'png' | 'jpeg';
}

export interface BatchProgressCallback {
  (itemId: string, itemProgress: number, overallCompleted: number, total: number, message: string): void;
}
