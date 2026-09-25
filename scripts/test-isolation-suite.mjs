import { PDFDocument, PDFName, PDFDict, PDFRef } from "pdf-lib";
import pako from "pako";
import assert from "node:assert";

function parseStreamPlacements(streamText) {
  const placements = [];
  const tokens = streamText.trim().split(/\s+/);
  let ctmStack = [[1, 0, 0, 1, 0, 0]];
  let currentCtm = [1, 0, 0, 1, 0, 0];

  const multiply = (m1, m2) => [
    m1[0]*m2[0] + m1[1]*m2[2],
    m1[0]*m2[1] + m1[1]*m2[3],
    m1[2]*m2[0] + m1[3]*m2[2],
    m1[2]*m2[1] + m1[3]*m2[3],
    m1[4]*m2[0] + m1[5]*m2[2] + m2[4],
    m1[4]*m2[1] + m1[5]*m2[3] + m2[5]
  ];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "q") {
      ctmStack.push([...currentCtm]);
    } else if (t === "Q") {
      if (ctmStack.length > 1) currentCtm = ctmStack.pop();
    } else if (t === "cm" && i >= 6) {
      const m = [
        parseFloat(tokens[i-6]),
        parseFloat(tokens[i-5]),
        parseFloat(tokens[i-4]),
        parseFloat(tokens[i-3]),
        parseFloat(tokens[i-2]),
        parseFloat(tokens[i-1])
      ];
      currentCtm = multiply(m, currentCtm);
    } else if (t === "Do" && i >= 1) {
      const name = tokens[i-1].replace(/^\//, "");
      const a = currentCtm[0], b = currentCtm[1], c = currentCtm[2], d = currentCtm[3], e = currentCtm[4], f = currentCtm[5];
      const corners = [
        { x: e, y: f },
        { x: e + a, y: f + b },
        { x: e + c, y: f + d },
        { x: e + a + c, y: f + b + d }
      ];
      const minX = Math.min(...corners.map(pt => pt.x));
      const maxX = Math.max(...corners.map(pt => pt.x));
      const minY = Math.min(...corners.map(pt => pt.y));
      const maxY = Math.max(...corners.map(pt => pt.y));
      placements.push({ name, ctm: [...currentCtm], bounds: { left: minX, bottom: minY, right: maxX, top: maxY } });
    }
  }
  return placements;
}

export async function isolateSharedPdfImage(bytes, pageIndex, targetBounds) {
  try {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    if (pageIndex < 0 || pageIndex >= pages.length) {
      return { bytes, wasShared: false, success: false };
    }

    const refUsage = new Map();
    for (let p = 0; p < pages.length; p++) {
      const page = pages[p];
      const resources = page.node.Resources();
      const xobjs = resources?.lookup(PDFName.of("XObject"), PDFDict);
      if (xobjs) {
        for (const [name, ref] of xobjs.entries()) {
          if (ref instanceof PDFRef) {
            const key = ref.toString();
            if (!refUsage.has(key)) refUsage.set(key, []);
            refUsage.get(key).push({ pageIdx: p, name, dict: xobjs });
          }
        }
      }
    }

    const targetPage = pages[pageIndex];
    const targetResources = targetPage.node.Resources();
    const targetXobjs = targetResources?.lookup(PDFName.of("XObject"), PDFDict);
    if (!targetXobjs) {
      return { bytes, wasShared: false, success: true };
    }

    let targetContentStreamsText = "";
    let placements = [];
    try {
      const contents = targetPage.node.Contents();
      const streams = [];
      if (contents) {
        if (typeof contents.size === "function") {
          for (let i = 0; i < contents.size(); i++) {
            const item = pdfDoc.context.lookup(contents.get(i));
            if (item) streams.push(item);
          }
        } else {
          const item = pdfDoc.context.lookup(contents);
          if (item) streams.push(item);
        }
      }
      for (const s of streams) {
        if (typeof s.getUnencodedContents === "function") {
          targetContentStreamsText += Buffer.from(s.getUnencodedContents()).toString("binary") + "\n";
        } else if (typeof s.getContents === "function") {
          const raw = s.getContents();
          try {
            const inflated = pako.inflate(raw);
            targetContentStreamsText += Buffer.from(inflated).toString("binary") + "\n";
          } catch {
            targetContentStreamsText += Buffer.from(raw).toString("binary") + "\n";
          }
        }
      }
      if (targetContentStreamsText) {
        placements = parseStreamPlacements(targetContentStreamsText);
      }
    } catch {
      // Content streams decode optional
    }

    // Match target XObject ref if targetBounds is provided
    let targetRefKey = null;
    let targetName = null;
    if (targetBounds && placements.length > 0) {
      let bestDist = Infinity;
      const tb = targetBounds;
      const tbCx = (tb.left + tb.right) / 2;
      const tbCy = (tb.bottom + tb.top) / 2;

      for (const pl of placements) {
        const pb = pl.bounds;
        const pbCx = (pb.left + pb.right) / 2;
        const pbCy = (pb.bottom + pb.top) / 2;
        const dist = Math.hypot(pbCx - tbCx, pbCy - tbCy);
        const wDiff = Math.abs((pb.right - pb.left) - (tb.right - tb.left));
        const hDiff = Math.abs((pb.top - pb.bottom) - (tb.top - tb.bottom));
        if (dist + wDiff * 0.5 + hDiff * 0.5 < bestDist) {
          bestDist = dist + wDiff * 0.5 + hDiff * 0.5;
          targetName = pl.name;
        }
      }

      if (targetName) {
        for (const [xName, xRef] of targetXobjs.entries()) {
          const raw = typeof xName.value === "function" ? xName.value().replace(/^\//, "") : xName.asString().replace(/^\//, "");
          if (raw === targetName && xRef instanceof PDFRef) {
            targetRefKey = xRef.toString();
            break;
          }
        }
      }
      console.log("Placements count:", placements.length, "targetName:", targetName, "targetRefKey:", targetRefKey);
    }

    let modified = false;
    let anyShared = false;

    for (const [name, ref] of targetXobjs.entries()) {
      if (ref instanceof PDFRef) {
        const key = ref.toString();
        const rawName = typeof name.value === "function" ? name.value() : name.asString().replace(/^\//, "");

        // If targetRefKey is known, skip unrelated XObjects!
        if (targetRefKey && key !== targetRefKey) {
          continue;
        }

        const usages = refUsage.get(key) || [];

        // 1. Same-page multiple placement check
        if (targetContentStreamsText) {
          const escapedName = rawName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
          const doPattern = new RegExp(`/${escapedName}\\s+Do\\b`, "g");
          const matches = targetContentStreamsText.match(doPattern);
          if (matches && matches.length > 1) {
            return { bytes, wasShared: true, success: false };
          }
        }

        // Same-page multiple names pointing to same ref
        const samePageCount = usages.filter(u => u.pageIdx === pageIndex).length;
        if (samePageCount > 1) {
          return { bytes, wasShared: true, success: false };
        }

        // 2. Cross-page sharing check
        const isCrossPage = usages.some(u => u.pageIdx !== pageIndex);
        if (isCrossPage) {
          anyShared = true;
          const streamObj = pdfDoc.context.lookup(ref);
          if (streamObj && typeof streamObj.clone === "function") {
            try {
              const cloned = streamObj.clone(pdfDoc.context);
              const newRef = pdfDoc.context.register(cloned);
              targetXobjs.set(name, newRef);
              modified = true;
            } catch (cloneErr) {
              return { bytes, wasShared: true, success: false };
            }
          } else {
            return { bytes, wasShared: true, success: false };
          }
        }
      }
    }

    if (modified) {
      const newBytes = await pdfDoc.save();
      return { bytes: newBytes, wasShared: true, success: true };
    }
    return { bytes, wasShared: anyShared, success: true };
  } catch (err) {
    return { bytes, wasShared: true, success: false };
  }
}

async function main() {
  // Test 1: Test A5 (same image duplicated on same page) -> must fail closed
  {
    const doc = await PDFDocument.create();
    const img = await doc.embedPng(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const p1 = doc.addPage([400, 400]);
    p1.drawImage(img, { x: 20, y: 20, width: 100, height: 100 });
    p1.drawImage(img, { x: 200, y: 200, width: 100, height: 100 });
    const bytes = await doc.save();

    const resNoBounds = await isolateSharedPdfImage(bytes, 0);
    assert.strictEqual(resNoBounds.wasShared, true);
    assert.strictEqual(resNoBounds.success, false);
    console.log("✓ Test A5 without bounds passes (fail-closed):", resNoBounds.wasShared, resNoBounds.success);

    const resWithBounds = await isolateSharedPdfImage(bytes, 0, { left: 20, bottom: 20, right: 120, top: 120 });
    assert.strictEqual(resWithBounds.wasShared, true);
    assert.strictEqual(resWithBounds.success, false);
    console.log("✓ Test A5 with bounds passes (fail-closed):", resWithBounds.wasShared, resWithBounds.success);
  }

  // Test 2: Unrelated image duplicated + target watermark placed once -> MUST SUCCEED!
  {
    const doc = await PDFDocument.create();
    const dot = await doc.embedPng(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const wm = await doc.embedPng(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const p1 = doc.addPage([500, 500]);
    p1.drawImage(dot, { x: 10, y: 10, width: 5, height: 5 });
    p1.drawImage(dot, { x: 10, y: 30, width: 5, height: 5 });
    p1.drawImage(wm, { x: 100, y: 100, width: 200, height: 200 });
    const bytes = await doc.save();

    const res = await isolateSharedPdfImage(bytes, 0, { left: 100, bottom: 100, right: 300, top: 300 });
    assert.strictEqual(res.wasShared, false);
    assert.strictEqual(res.success, true);
    console.log("✓ Unrelated image duplicated + single target WM passes (SUCCESS):", res.wasShared, res.success);
  }

  // Test 3: Cross-page shared image -> MUST CLONE AND SUCCEED!
  {
    const doc = await PDFDocument.create();
    const img = await doc.embedPng(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const p1 = doc.addPage([400, 400]);
    p1.drawImage(img, { x: 50, y: 50, width: 100, height: 100 });
    const p2 = doc.addPage([400, 400]);
    p2.drawImage(img, { x: 50, y: 50, width: 100, height: 100 });
    const bytes = await doc.save();

    const res = await isolateSharedPdfImage(bytes, 0, { left: 50, bottom: 50, right: 150, top: 150 });
    assert.strictEqual(res.wasShared, true);
    assert.strictEqual(res.success, true);
    console.log("✓ Cross-page shared image passes (CLONED & SUCCESS):", res.wasShared, res.success);
  }

  // Test 4: Corrupt PDF -> must fail closed
  {
    const corruptBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xff, 0xff]);
    const res = await isolateSharedPdfImage(corruptBytes, 0);
    assert.strictEqual(res.wasShared, true);
    assert.strictEqual(res.success, false);
    console.log("✓ Corrupt PDF passes (FAIL-CLOSED):", res.wasShared, res.success);
  }

  console.log("\n🎉 ALL 4 ISOLATION TEST CASES PASSED 100%!");
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
