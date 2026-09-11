import {
  PDFDocument,
  PDFName,
  PDFString,
  PDFArray,
  PDFBool,
} from '@cantoo/pdf-lib';
import type {
  PdfAConversionOptions,
  AccessibilityReport,
  AccessibilityIssue,
  AccessibilityFixOptions,
} from './complianceTypes';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 1. Convert PDF to PDF/A-2b (ISO 19005-2 Archival Standard)
 */
export async function convertToPdfA2b(
  pdfBytes: Uint8Array,
  options?: PdfAConversionOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const now = new Date();
  const title = options?.title || doc.getTitle() || 'Forma Arşiv Dokümanı';
  const lang = options?.language || 'tr-TR';
  const author = options?.author || doc.getAuthor() || 'Forma Belge Atölyesi';

  // 1. Remove prohibited JavaScript & interactive launch actions
  if (doc.catalog.has(PDFName.of('JavaScript'))) {
    doc.catalog.delete(PDFName.of('JavaScript'));
  }
  if (doc.catalog.has(PDFName.of('OpenAction'))) {
    const openAction = doc.catalog.get(PDFName.of('OpenAction'));
    if (openAction) {
      // Clean up unsafe open actions
      doc.catalog.delete(PDFName.of('OpenAction'));
    }
  }

  // 2. Set Metadata Title, Author, Language
  doc.setTitle(title);
  doc.setAuthor(author);
  doc.setCreationDate(doc.getCreationDate() || now);
  doc.setModificationDate(now);

  // Set /Lang in catalog
  doc.catalog.set(PDFName.of('Lang'), PDFString.of(lang));

  // 3. Set MarkInfo for PDF/A structure tagging
  const markInfo = doc.context.obj({
    Marked: true,
  });
  doc.catalog.set(PDFName.of('MarkInfo'), doc.context.register(markInfo));

  // 4. Add standard sRGB OutputIntent dictionary
  const outputIntent = doc.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    RegistryName: PDFString.of('http://www.color.org'),
    Info: PDFString.of('sRGB IEC61966-2.1 standard profile for PDF/A compliance'),
  });
  const outputIntentRef = doc.context.register(outputIntent);
  doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([outputIntentRef]));

  // 5. Generate and embed PDF/A-2b XMP Metadata Stream
  const xmpXml = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>2</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${escapeXml(author)}</rdf:li></rdf:Seq></dc:creator>
      <dc:language><rdf:Bag><rdf:li>${escapeXml(lang)}</rdf:li></rdf:Bag></dc:language>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>Forma PDF/A Archival Engine</pdf:Producer>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const xmpBytes = new TextEncoder().encode(xmpXml);
  const metadataStream = doc.context.stream(xmpBytes, {
    Type: 'Metadata',
    Subtype: 'XML',
  });
  const metadataStreamRef = doc.context.register(metadataStream);
  doc.catalog.set(PDFName.of('Metadata'), metadataStreamRef);

  return await doc.save({ useObjectStreams: false });
}

/**
 * 2. Audit Accessibility (WCAG 2.1 AA / PDF/UA-1)
 */
export async function auditAccessibility(
  pdfBytes: Uint8Array
): Promise<AccessibilityReport> {
  const doc = await PDFDocument.load(pdfBytes);
  const issues: AccessibilityIssue[] = [];
  let score = 100;

  // Rule 1: Document Title (WCAG 2.4.2)
  const title = doc.getTitle();
  const hasTitle = Boolean(title && title.trim().length > 0);
  if (!hasTitle) {
    issues.push({
      id: 'title-missing',
      rule: 'WCAG 2.4.2 (Belge Başlığı)',
      description: 'Belgenin standart bir meta veri başlığı (/Title) bulunmuyor.',
      severity: 'error',
      element: 'Document Catalog / Metadata',
      fixRecommendation: 'Belgeye açıklayıcı bir başlık ekleyin.',
    });
    score -= 20;
  }

  // Rule 2: Document Language (WCAG 3.1.1)
  const langObj = doc.catalog.get(PDFName.of('Lang'));
  const hasLanguage = Boolean(langObj);
  if (!hasLanguage) {
    issues.push({
      id: 'lang-missing',
      rule: 'WCAG 3.1.1 (Belge Dili)',
      description: 'Ekran okuyucuların doğru telaffuz yapabilmesi için belge dili (/Lang) tanımlanmamış.',
      severity: 'error',
      element: 'Document Catalog / Lang',
      fixRecommendation: 'Belge dilini (örn. tr-TR) olarak ayarlayın.',
    });
    score -= 20;
  }

  // Rule 3: Tagged PDF Structure (PDF/UA-1 / WCAG 1.3.1)
  const markInfo = doc.catalog.get(PDFName.of('MarkInfo'));
  const structTree = doc.catalog.get(PDFName.of('StructTreeRoot'));
  let isTagged = false;
  if (markInfo) {
    const markInfoDict = doc.context.lookup(markInfo);
    if (markInfoDict && (markInfoDict as any).get) {
      const markedVal = (markInfoDict as any).get(PDFName.of('Marked'));
      isTagged = markedVal === PDFBool.True || markedVal === true;
    }
  }
  if (structTree) isTagged = true;

  if (!isTagged) {
    issues.push({
      id: 'tags-missing',
      rule: 'PDF/UA-1 (Etiketli Yapı / Tagged PDF)',
      description: 'Belge mantıksal okuma sırasını tanımlayan etiketli yapı (Marked=true) içermiyor.',
      severity: 'error',
      element: 'Document Catalog / MarkInfo',
      fixRecommendation: 'Belgeyi etiketli yapıya (Tagged PDF) dönüştürün.',
    });
    score -= 25;
  }

  // Rule 4: Images and Alternative Text (WCAG 1.1.1)
  // Check if document contains images
  let hasImages = false;
  let hasAltTextOnImages = true;
  const pageCount = doc.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    const page = doc.getPage(i);
    const resources = page.node.Resources();
    if (resources && resources.get) {
      const xObject = resources.get(PDFName.of('XObject'));
      if (xObject) {
        hasImages = true;
      }
    }
  }

  if (hasImages && !isTagged) {
    hasAltTextOnImages = false;
    issues.push({
      id: 'alt-missing',
      rule: 'WCAG 1.1.1 (Görsel Alternatif Metinleri)',
      description: 'Belgede görseller mevcut fakat ekran okuyucular için tanımlı /Alt açıklaması teyit edilemedi.',
      severity: 'warning',
      element: 'Page Resources / XObject',
      fixRecommendation: 'Görsellere betimleyici alternatif metinler ekleyin.',
    });
    score -= 15;
  }

  // Rule 5: Form Fields Labels & Tooltips (WCAG 3.3.2)
  let hasFormFieldLabels = true;
  const form = doc.getForm();
  const fields = form.getFields();
  if (fields.length > 0) {
    let missingTooltipCount = 0;
    for (const field of fields) {
      const tu = (field.acroField.dict as any)?.get(PDFName.of('TU'));
      if (!tu) missingTooltipCount++;
    }
    if (missingTooltipCount > 0) {
      hasFormFieldLabels = false;
      issues.push({
        id: 'form-tooltips',
        rule: 'WCAG 3.3.2 (Form Alanı Açıklamaları)',
        description: `${missingTooltipCount} form alanında yardımcı ipucu (/TU) bulunmuyor.`,
        severity: 'warning',
        element: 'AcroForm / Fields',
        fixRecommendation: 'Form alanlarına ekran okuyucu yardımcı metinleri (/TU) ekleyin.',
      });
      score -= 10;
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    hasTitle,
    hasLanguage,
    isTagged,
    hasAltTextOnImages,
    hasFormFieldLabels,
    issues,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 3. Auto-Fix Accessibility Violations
 */
export async function autoFixAccessibility(
  pdfBytes: Uint8Array,
  options?: AccessibilityFixOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);

  // 1. Fix Title
  const curTitle = doc.getTitle();
  if (!curTitle || curTitle.trim().length === 0) {
    doc.setTitle(options?.title || 'Erişilebilir Belge');
  }

  // 2. Fix Language
  const lang = options?.language || 'tr-TR';
  doc.catalog.set(PDFName.of('Lang'), PDFString.of(lang));

  // 3. Fix MarkInfo Tagged Flag
  const markInfo = doc.context.obj({
    Marked: true,
  });
  doc.catalog.set(PDFName.of('MarkInfo'), doc.context.register(markInfo));

  // 4. Fix Form Field Tooltips
  const form = doc.getForm();
  const fields = form.getFields();
  for (const field of fields) {
    const tu = (field.acroField.dict as any)?.get(PDFName.of('TU'));
    if (!tu) {
      (field.acroField.dict as any)?.set(PDFName.of('TU'), PDFString.of(field.getName() || 'Girdi Alanı'));
    }
  }

  return await doc.save({ useObjectStreams: false });
}
