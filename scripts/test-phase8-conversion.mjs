import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';
import JSZip from 'jszip';
import {
  imagesToPdf,
  pdfToImagesZip,
  pdfToExcel,
  pdfToPptx,
} from '../features/conversion/conversionEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function runPhase8Tests() {
  console.log('--- Phase 8: New Format Conversions Test Suite ---');
  const outputsDir = path.join(projectRoot, 'outputs');
  if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

  // Minimal valid 1x1 PNG bytes
  const samplePngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
    0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54,
    0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);

  // Test 1: Images to PDF
  console.log('Testing imagesToPdf (2 PNG images -> 2 pages)...');
  const imgItems = [
    { name: 'resim1.png', bytes: samplePngBytes, type: 'png' },
    { name: 'resim2.png', bytes: samplePngBytes, type: 'png' },
  ];
  const pdfFromImgs = await imagesToPdf(imgItems, {
    pageSize: 'A4',
    orientation: 'portrait',
    margin: 25,
  });

  if (!pdfFromImgs || pdfFromImgs.length === 0) {
    throw new Error('imagesToPdf returned empty bytes');
  }
  const loadedPdf = await PDFDocument.load(pdfFromImgs);
  if (loadedPdf.getPageCount() !== 2) {
    throw new Error(`Expected 2 pages in created PDF, got ${loadedPdf.getPageCount()}`);
  }
  console.log(`  PASS: Created valid PDF with ${loadedPdf.getPageCount()} pages (${pdfFromImgs.length} bytes)`);

  const imgsToPdfPath = path.join(outputsDir, 'test-phase8-images-to-pdf.pdf');
  fs.writeFileSync(imgsToPdfPath, Buffer.from(pdfFromImgs));

  // Test 2: PDF to Images ZIP
  console.log('Testing pdfToImagesZip...');
  const zipBytes = await pdfToImagesZip(pdfFromImgs, { format: 'png', dpi: 150 });
  const loadedZip = await JSZip.loadAsync(zipBytes);
  const zipFiles = Object.keys(loadedZip.files);
  console.log('  ZIP files contained:', zipFiles);

  if (!zipFiles.includes('sayfa_001.png') || !zipFiles.includes('sayfa_002.png')) {
    throw new Error('PDF to Images ZIP is missing expected page PNG files');
  }
  console.log('  PASS: ZIP contains valid page image entries');

  const pdfToImgsPath = path.join(outputsDir, 'test-phase8-pdf-to-images.zip');
  fs.writeFileSync(pdfToImgsPath, Buffer.from(zipBytes));

  // Create a structured test PDF with text for Excel and PPTX testing
  const dataDoc = await PDFDocument.create();
  const pageA = dataDoc.addPage([595.28, 841.89]);
  pageA.drawText('Ürün \t Fiyat \t Adet', { x: 50, y: 750, size: 14 });
  pageA.drawText('Laptop \t 35000 \t 4', { x: 50, y: 700, size: 12 });
  pageA.drawText('Monitör \t 7500 \t 8', { x: 50, y: 650, size: 12 });
  const structuredPdfBytes = await dataDoc.save();

  // Test 3: PDF to Excel (.xlsx)
  console.log('Testing pdfToExcel (.xlsx)...');
  const xlsxBytes = await pdfToExcel(structuredPdfBytes, { sheetName: 'Envanter' });
  const xlsxZip = await JSZip.loadAsync(xlsxBytes);
  const xlsxFiles = Object.keys(xlsxZip.files);
  console.log('  XLSX structure parts:', xlsxFiles);

  if (!xlsxZip.file('[Content_Types].xml') || !xlsxZip.file('xl/workbook.xml') || !xlsxZip.file('xl/worksheets/sheet1.xml')) {
    throw new Error('XLSX is missing essential OpenXML parts');
  }

  const sheetXml = await xlsxZip.file('xl/worksheets/sheet1.xml').async('text');
  const workbookXml = await xlsxZip.file('xl/workbook.xml').async('text');

  if (!workbookXml.includes('name="Envanter"')) {
    throw new Error('Workbook XML does not contain expected sheet name "Envanter"');
  }
  if (!sheetXml.includes('<row') || !sheetXml.includes('<c r=')) {
    throw new Error('Sheet XML does not contain expected rows/cells');
  }
  console.log('  PASS: Valid OpenXML Excel (.xlsx) generated successfully');

  const xlsxPath = path.join(outputsDir, 'test-phase8-output.xlsx');
  fs.writeFileSync(xlsxPath, Buffer.from(xlsxBytes));

  // Test 4: PDF to PowerPoint (.pptx)
  console.log('Testing pdfToPptx (.pptx)...');
  const pptxBytes = await pdfToPptx(structuredPdfBytes);
  const pptxZip = await JSZip.loadAsync(pptxBytes);
  const pptxFiles = Object.keys(pptxZip.files);
  console.log('  PPTX structure parts:', pptxFiles);

  if (!pptxZip.file('[Content_Types].xml') || !pptxZip.file('ppt/presentation.xml') || !pptxZip.file('ppt/slides/slide1.xml')) {
    throw new Error('PPTX is missing essential OpenXML presentation parts');
  }

  const presXml = await pptxZip.file('ppt/presentation.xml').async('text');
  const slideXml = await pptxZip.file('ppt/slides/slide1.xml').async('text');

  if (!presXml.includes('<p:sldSz') || !slideXml.includes('<p:sld')) {
    throw new Error('Presentation or slide XML is malformed');
  }
  console.log('  PASS: Valid OpenXML PowerPoint (.pptx) generated successfully');

  const pptxPath = path.join(outputsDir, 'test-phase8-output.pptx');
  fs.writeFileSync(pptxPath, Buffer.from(pptxBytes));

  console.log('--- ALL PHASE 8 TESTS PASSED SUCCESSFULLY ---');
  return {
    success: true,
    pdfFromImgsLength: pdfFromImgs.length,
    zipBytesLength: zipBytes.length,
    xlsxBytesLength: xlsxBytes.length,
    pptxBytesLength: pptxBytes.length,
  };
}

runPhase8Tests().catch((err) => {
  console.error('Phase 8 Test Failed:', err);
  process.exit(1);
});
