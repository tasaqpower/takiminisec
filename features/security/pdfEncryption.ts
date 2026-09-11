import { PDFDocument } from "@cantoo/pdf-lib";

export interface EncryptionOptions {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
  allowModifying?: boolean;
  allowAnnotating?: boolean;
  allowFillingForms?: boolean;
}

/**
 * Standard PDF ISO 32000 AES-256 Encryption
 * Compatible with Adobe Acrobat, Google Chrome, PDF.js and qpdf.
 */
export async function encryptPdfWithPassword(
  pdfBytes: Uint8Array,
  password: string,
  options?: Partial<EncryptionOptions>
): Promise<Uint8Array> {
  if (!password) {
    throw new Error("Parola boş olamaz.");
  }

  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const ownerPassword = options?.ownerPassword || password;

  doc.encrypt({
    userPassword: password,
    ownerPassword: ownerPassword,
    permissions: {
      printing: options?.allowPrinting !== false ? "highResolution" : false,
      modifying: options?.allowModifying ?? false,
      copying: options?.allowCopying ?? false,
      annotating: options?.allowAnnotating ?? false,
      fillingForms: options?.allowFillingForms !== false,
      contentAccessibility: false,
      documentAssembly: false
    }
  });

  return await doc.save();
}

/**
 * Checks if a PDF byte array is an encrypted PDF document
 */
export function isEncryptedPdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 32) return false;
  const head = new TextDecoder().decode(bytes.slice(0, 1024));
  if (!head.startsWith("%PDF")) return false;

  // Search for /Encrypt in cross-reference or trailer
  const text = new TextDecoder("latin1").decode(bytes);
  return /\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\s*<</.test(text);
}

/**
 * Unlocks / decrypts a password-protected PDF using the user's password
 * and returns a standard, unencrypted, clean PDF document.
 */
export async function decryptPdfWithPassword(
  bytes: Uint8Array,
  password: string
): Promise<Uint8Array> {
  if (!password) {
    throw new Error("Lütfen belgenin parolasını girin.");
  }

  try {
    const loadedDoc = await PDFDocument.load(bytes, { password });
    // Copy all pages into a fresh unencrypted PDFDocument
    const cleanDoc = await PDFDocument.create();
    const indices = loadedDoc.getPageIndices();
    const copiedPages = await cleanDoc.copyPages(loadedDoc, indices);
    copiedPages.forEach(p => cleanDoc.addPage(p));

    return await cleanDoc.save();
  } catch (err: any) {
    if (/password|incorrect|decrypt/i.test(String(err?.message || err))) {
      throw new Error("Hatalı parola! Lütfen doğru parolayı girin.");
    }
    throw new Error("Belge kilidi açılamadı: " + (err.message || "Bilinmeyen hata"));
  }
}

export interface EncryptPdfResult {
  encryptedBytes: Uint8Array;
  algorithm: string;
}

export const encryptPdf = async (
  bytes: Uint8Array,
  opts: { userPassword: string; ownerPassword?: string } & Partial<EncryptionOptions>
): Promise<EncryptPdfResult> => {
  const encryptedBytes = await encryptPdfWithPassword(bytes, opts.userPassword, opts);
  return {
    encryptedBytes,
    algorithm: "AES-256 (ISO 32000-1 / Rev 6)"
  };
};

export const decryptPdf = decryptPdfWithPassword;

