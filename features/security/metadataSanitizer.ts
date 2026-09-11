import { PDFDocument, PDFName, PDFDict } from "@cantoo/pdf-lib";

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  producer?: string;
  creator?: string;
  creationDate?: Date;
  modificationDate?: Date;
  hasXmp?: boolean;
  hasJavaScript?: boolean;
  hasEmbeddedFiles?: boolean;
}

/**
 * Reads existing metadata and embedded features from a PDFDocument
 */
export async function getPdfMetadata(pdfBytes: Uint8Array): Promise<PdfMetadata> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
  const catalog = pdfDoc.catalog;

  const hasXmp = catalog.has(PDFName.of("Metadata"));
  const namesDict = catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  const hasJavaScript = catalog.has(PDFName.of("OpenAction")) ||
    catalog.has(PDFName.of("AA")) ||
    (namesDict ? namesDict.has(PDFName.of("JavaScript")) : false);
  const hasEmbeddedFiles = (namesDict ? namesDict.has(PDFName.of("EmbeddedFiles")) : false) ||
    catalog.has(PDFName.of("EmbeddedFiles"));

  return {
    title: pdfDoc.getTitle() || undefined,
    author: pdfDoc.getAuthor() || undefined,
    subject: pdfDoc.getSubject() || undefined,
    keywords: pdfDoc.getKeywords() ? pdfDoc.getKeywords()?.split(",").map(k => k.trim()) : [],
    producer: pdfDoc.getProducer() || undefined,
    creator: pdfDoc.getCreator() || undefined,
    creationDate: pdfDoc.getCreationDate(),
    modificationDate: pdfDoc.getModificationDate(),
    hasXmp,
    hasJavaScript,
    hasEmbeddedFiles
  };
}

export interface SanitizeOptions {
  clearAll?: boolean;
  title?: boolean;
  author?: boolean;
  subject?: boolean;
  keywords?: boolean;
  producer?: boolean;
  creator?: boolean;
  dates?: boolean;
  xmp?: boolean;
  javascript?: boolean;
  embeddedFiles?: boolean;
  formValues?: boolean;
}

/**
 * Strips all metadata or selected fields from the PDF
 */
export async function sanitizePdfMetadata(
  pdfBytes: Uint8Array,
  options: SanitizeOptions = { clearAll: true }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
  const clearAll = options.clearAll ?? false;

  if (clearAll || options.title) pdfDoc.setTitle("");
  if (clearAll || options.author) pdfDoc.setAuthor("");
  if (clearAll || options.subject) pdfDoc.setSubject("");
  if (clearAll || options.keywords) pdfDoc.setKeywords([]);
  if (clearAll || options.producer) pdfDoc.setProducer("");
  if (clearAll || options.creator) pdfDoc.setCreator("");

  // Clean Info dictionary entries explicitly
  try {
    const info = pdfDoc.context.lookup(PDFName.of("Info"), PDFDict);
    if (info) {
      if (clearAll || options.producer) info.delete(PDFName.of("Producer"));
      if (clearAll || options.creator) info.delete(PDFName.of("Creator"));
      if (clearAll || options.title) info.delete(PDFName.of("Title"));
      if (clearAll || options.author) info.delete(PDFName.of("Author"));
      if (clearAll || options.subject) info.delete(PDFName.of("Subject"));
      if (clearAll || options.keywords) info.delete(PDFName.of("Keywords"));
      if (clearAll || options.dates) {
        info.delete(PDFName.of("CreationDate"));
        info.delete(PDFName.of("ModDate"));
      }
    }
  } catch {}

  // Clear XMP metadata
  if (clearAll || options.xmp) {
    try {
      pdfDoc.catalog.delete(PDFName.of("Metadata"));
    } catch {}
  }

  // Clear JavaScript and interactive actions
  if (clearAll || options.javascript) {
    try {
      pdfDoc.catalog.delete(PDFName.of("OpenAction"));
      pdfDoc.catalog.delete(PDFName.of("AA"));
      const names = pdfDoc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
      if (names) {
        names.delete(PDFName.of("JavaScript"));
      }
    } catch {}
  }

  // Clear Embedded Files
  if (clearAll || options.embeddedFiles) {
    try {
      pdfDoc.catalog.delete(PDFName.of("EmbeddedFiles"));
      const names = pdfDoc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
      if (names) {
        names.delete(PDFName.of("EmbeddedFiles"));
      }
    } catch {}
  }

  // Clear Form Field Values
  if (clearAll || options.formValues) {
    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      for (const field of fields) {
        if (field.constructor.name === "PDFTextField") {
          (field as any).setText("");
        }
      }
    } catch {}
  }

  const bytes = await pdfDoc.save();
  (bytes as any).sanitizedBytes = bytes;
  return bytes;
}

export const inspectPdfMetadata = getPdfMetadata;

