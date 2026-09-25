import { PDFDocument } from "pdf-lib";
import { isolateSharedPdfImage } from "../lib/pdf-text.ts";

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 500]);
  
  // Im1: small decorative dot placed twice
  const dot = await doc.embedPng(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  page.drawImage(dot, { x: 10, y: 10, width: 5, height: 5 });
  page.drawImage(dot, { x: 10, y: 30, width: 5, height: 5 });

  // Im2: Watermark image placed once
  const wm = await doc.embedPng(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  page.drawImage(wm, { x: 100, y: 100, width: 200, height: 200 });

  const bytes = await doc.save();

  // Now try to isolate Im2 (bounds: 100, 100, 300, 300)
  const res = await isolateSharedPdfImage(bytes, 0, { left: 100, bottom: 100, right: 300, top: 300 });
  console.log("Isolating Im2 when unrelated Im1 is duplicated:", res.wasShared, res.success);
}

main().catch(console.error);
