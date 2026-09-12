import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const targetPdf = 'C:/Users/sinan/Downloads/ogrenci_belgesi_A4_guncel.pdf';
  if (!fs.existsSync(targetPdf)) {
    console.error('Target PDF not found at:', targetPdf);
    return;
  }
  const bytes = fs.readFileSync(targetPdf);
  console.log('File size:', bytes.length, 'bytes');

  // 1. Inspect with PDF.js
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  console.log('numPages:', doc.numPages);
  const page = await doc.getPage(1);
  console.log('page view (MediaBox/CropBox):', page.view);
  console.log('page rotate:', page.rotate);
  console.log('page userUnit:', page.userUnit);

  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS;
  const opNames = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k]));

  console.log('Operator count:', opList.fnArray.length);
  const imageOps = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const name = opNames[fn] || `op_${fn}`;
    if (name.includes('Image') || name.includes('XObject') || name.includes('paint') || name.includes('Form')) {
      imageOps.push({
        idx: i,
        fn,
        name,
        args: opList.argsArray[i]
      });
    }
  }
  console.log('Image / XObject / Form operators found in PDF.js:');
  console.log(JSON.stringify(imageOps, null, 2));

  // 2. Inspect with PDFium
  const { init } = await import("@embedpdf/pdfium");
  const wasmBinary = fs.readFileSync("public/pdfium.wasm");
  const mod = await init({ wasmBinary });
  mod.PDFiumExt_Init();
  const heap = mod.pdfium;
  const { malloc, free } = heap.wasmExports;
  const instance = mod;
  console.log('\nPDFium initialized successfully.');

  const inputPtr = malloc(bytes.length);
  heap.HEAPU8.set(bytes, inputPtr);
  const pDoc = instance.FPDF_LoadMemDocument(inputPtr, bytes.length, "");
  if (!pDoc) {
    console.error('Failed to load doc with PDFium, error:', instance.FPDF_GetLastError());
    return;
  }
  const pPage = instance.FPDF_LoadPage(pDoc, 0);
  const objCount = instance.FPDFPage_CountObjects(pPage);
  console.log('PDFium Page Object Count on Page 0:', objCount);

  const boundsPtr = malloc(16);
  const matrixPtr = malloc(24);

  function inspectObject(obj, indent = '  ') {
    const type = instance.FPDFPageObj_GetType(obj);
    let typeName = 'UNKNOWN';
    if (type === 1) typeName = 'TEXT';
    else if (type === 2) typeName = 'PATH';
    else if (type === 3) typeName = 'IMAGE';
    else if (type === 4) typeName = 'SHADING';
    else if (type === 5) typeName = 'FORM';
    else if (type === 6) typeName = 'TYPE_6';

    instance.FPDFPageObj_GetBounds(obj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12);
    const left = heap.getValue(boundsPtr, "float");
    const bottom = heap.getValue(boundsPtr + 4, "float");
    const right = heap.getValue(boundsPtr + 8, "float");
    const top = heap.getValue(boundsPtr + 12, "float");

    const hasMatrix = instance.FPDFPageObj_GetMatrix ? instance.FPDFPageObj_GetMatrix(obj, matrixPtr) : false;
    let matrix = null;
    if (hasMatrix) {
      matrix = Array.from(new Float32Array(heap.HEAPU8.buffer, matrixPtr, 6));
    }

    console.log(`${indent}Obj: ${obj} | type: ${type} (${typeName}) | bounds: [L:${left.toFixed(1)}, B:${bottom.toFixed(1)}, R:${right.toFixed(1)}, T:${top.toFixed(1)}] | matrix: ${JSON.stringify(matrix)}`);

    if (typeName === 'FORM' || type === 5 || type === 6) {
      if (instance.FPDFFormObj_CountObjects) {
        const nestedCount = instance.FPDFFormObj_CountObjects(obj);
        console.log(`${indent}  -> Form contains ${nestedCount} nested objects:`);
        for (let j = 0; j < nestedCount; j++) {
          const nestedObj = instance.FPDFFormObj_GetObject(obj, j);
          inspectObject(nestedObj, indent + '    ');
        }
      }
    }
  }

  // Test removing nested image 0 (the logo at L:52.5, B:716.7)
  const formObj = instance.FPDFPage_GetObject(pPage, 44);
  const logoObj = instance.FPDFFormObj_GetObject(formObj, 0);
  console.log('Attempting FPDFFormObj_RemoveObject(formObj, logoObj)...');
  const removed = instance.FPDFFormObj_RemoveObject(formObj, logoObj);
  console.log('FPDFFormObj_RemoveObject result:', removed);
  if (removed) {
    instance.FPDFPageObj_Destroy(logoObj);
  }
  const genResult = instance.FPDFPage_GenerateContent(pPage);
  console.log('FPDFPage_GenerateContent result:', genResult);

  const writer = instance.PDFiumExt_OpenFileWriter();
  let output = 0;
  try {
    const saved = instance.PDFiumExt_SaveAsCopy(pDoc, writer);
    console.log('PDFiumExt_SaveAsCopy result:', saved);
    const length = instance.PDFiumExt_GetFileWriterSize(writer);
    output = malloc(length);
    instance.PDFiumExt_GetFileWriterData(writer, output, length);
    const modifiedBytes = heap.HEAPU8.slice(output, output + length);
    fs.writeFileSync('outputs/qa/test-removed-logo.pdf', modifiedBytes);
    console.log(`Saved outputs/qa/test-removed-logo.pdf (${modifiedBytes.length} bytes)`);
  } finally {
    if (output) free(output);
    instance.PDFiumExt_CloseFileWriter(writer);
  }

  instance.FPDF_ClosePage(pPage);
  instance.FPDF_CloseDocument(pDoc);
  free(inputPtr);
  free(boundsPtr);
  free(matrixPtr);
}

main().catch(console.error);
