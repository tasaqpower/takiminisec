import fs from 'node:fs';
import { init } from '@embedpdf/pdfium';

async function main() {
  const bytes = fs.readFileSync('C:/Users/sinan/Downloads/ogrenci_belgesi_A4_guncel.pdf');
  const wasmBinary = fs.readFileSync('public/pdfium.wasm');
  const m = await init({ wasmBinary });
  m.PDFiumExt_Init();
  const heap = m.pdfium;
  const { malloc, free } = heap.wasmExports;

  const input = malloc(bytes.length);
  heap.HEAPU8.set(bytes, input);
  const doc = m.FPDF_LoadMemDocument(input, bytes.length, '');
  const page = m.FPDF_LoadPage(doc, 0);

  const boundsPtr = malloc(16);
  const matrixPtr = malloc(24);
  const wPtr = malloc(4);
  const hPtr = malloc(4);

  const candidates = [];
  let imgCounter = 0;

  function multiplyMatrix(m1, m2) {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }

  function scanObject(obj, parentForm, parentMatrix) {
    const type = m.FPDFPageObj_GetType(obj);
    if (type === 3) {
      m.FPDFPageObj_GetBounds(obj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12);
      const left = heap.getValue(boundsPtr, 'float');
      const bottom = heap.getValue(boundsPtr + 4, 'float');
      const right = heap.getValue(boundsPtr + 8, 'float');
      const top = heap.getValue(boundsPtr + 12, 'float');

      let matrix = null;
      if (m.FPDFPageObj_GetMatrix && m.FPDFPageObj_GetMatrix(obj, matrixPtr)) {
        const rawMat = Array.from(new Float32Array(heap.HEAPU8.buffer, matrixPtr, 6));
        matrix = parentMatrix ? multiplyMatrix(parentMatrix, rawMat) : rawMat;
      }

      let pW = 0, pH = 0;
      if (m.FPDFImageObj_GetImagePixelSize && m.FPDFImageObj_GetImagePixelSize(obj, wPtr, hPtr)) {
        pW = heap.getValue(wPtr, 'i32');
        pH = heap.getValue(hPtr, 'i32');
      }

      candidates.push({
        obj,
        parentForm,
        bounds: { left, bottom, right, top },
        matrix,
        pixelWidth: pW,
        pixelHeight: pH,
        index: imgCounter++
      });
    } else if (type === 5) {
      let formMat = parentMatrix;
      if (m.FPDFPageObj_GetMatrix && m.FPDFPageObj_GetMatrix(obj, matrixPtr)) {
        const rawMat = Array.from(new Float32Array(heap.HEAPU8.buffer, matrixPtr, 6));
        formMat = parentMatrix ? multiplyMatrix(parentMatrix, rawMat) : rawMat;
      }
      if (m.FPDFFormObj_CountObjects) {
        const nestedCount = m.FPDFFormObj_CountObjects(obj);
        for (let j = 0; j < nestedCount; j++) {
          const nestedObj = m.FPDFFormObj_GetObject(obj, j);
          if (nestedObj) scanObject(nestedObj, obj, formMat);
        }
      }
    }
  }

  const count = m.FPDFPage_CountObjects(page);
  for (let i = 0; i < count; i++) {
    const obj = m.FPDFPage_GetObject(page, i);
    scanObject(obj, null, null);
  }

  console.log('Candidates found:', candidates.length);
  for (const c of candidates) {
    console.log(`- index: ${c.index}, dims: ${c.pixelWidth}x${c.pixelHeight}, parentForm: ${Boolean(c.parentForm)}, bounds: [${c.bounds.left.toFixed(1)}, ${c.bounds.bottom.toFixed(1)}, ${c.bounds.right.toFixed(1)}, ${c.bounds.top.toFixed(1)}]`);
  }

  // Target candidate 0
  const match = candidates[0];
  m.FPDFFormObj_RemoveObject(match.parentForm, match.obj);
  m.FPDFPageObj_Destroy(match.obj);
  m.FPDFPage_GenerateContent(page);

  const writer = m.PDFiumExt_OpenFileWriter();
  m.PDFiumExt_SaveAsCopy(doc, writer);
  const len = m.PDFiumExt_GetFileWriterSize(writer);
  const outPtr = malloc(len);
  m.PDFiumExt_GetFileWriterData(writer, outPtr, len);
  const resBytes = heap.HEAPU8.slice(outPtr, outPtr + len);
  free(outPtr);
  m.PDFiumExt_CloseFileWriter(writer);

  m.FPDF_ClosePage(page);
  m.FPDF_CloseDocument(doc);
  free(input); free(boundsPtr); free(matrixPtr); free(wPtr); free(hPtr);

  console.log('Saved PDF without candidate 0:', resBytes.length, 'bytes');

  // Verify with PDF.js
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const newDoc = await pdfjsLib.getDocument({ data: resBytes }).promise;
  const newPage = await newDoc.getPage(1);
  const opList = await newPage.getOperatorList();
  const OPS = pdfjsLib.OPS;
  const remainingImages = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] === OPS.paintImageXObject) {
      remainingImages.push(opList.argsArray[i]);
    }
  }
  console.log('Remaining images in clean PDF:', JSON.stringify(remainingImages));
}

main().catch(console.error);
