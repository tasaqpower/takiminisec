export interface DigitalCertificateInfo {
  commonName: string;
  organization?: string;
  country?: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  issuer: string;
}

export interface SignatureVisualOptions {
  showVisual: boolean;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  customText?: string;
}

export interface SignPdfOptions {
  p12Bytes?: Uint8Array;
  p12Password?: string;
  selfSigned?: {
    commonName: string;
    organization?: string;
    country?: string;
    password?: string;
  };
  reason?: string;
  location?: string;
  contactInfo?: string;
  visual?: SignatureVisualOptions;
}

export interface SignatureVerificationResult {
  isSigned: boolean;
  isValid: boolean;
  isTampered: boolean;
  signerName?: string;
  signingTime?: string;
  reason?: string;
  location?: string;
  certificate?: DigitalCertificateInfo;
  byteRange?: number[];
  error?: string;
}
