import { PDFDocument, rgb } from "pdf-lib";
import type { FormFieldItem, FormFieldType } from "./formTypes";

/**
 * Injects AcroForm fields into a PDFDocument and saves it
 * Supports interactive form fields or flattened fields
 */
export async function embedFormFieldsInPdf(
  pdfBytes: Uint8Array,
  fields: FormFieldItem[],
  flatten = false
): Promise<Uint8Array> {
  if (fields.length === 0) {
    return pdfBytes;
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();

  let customFont: any = null;
  try {
    const isNode = typeof process !== "undefined" && Boolean(process?.versions?.node);
    if (isNode) {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const fontPath = path.resolve("public/fonts/LiberationSans-Regular.ttf");
      if (fs.existsSync(fontPath)) {
        customFont = await pdfDoc.embedFont(fs.readFileSync(fontPath));
      }
    } else {
      const res = await fetch("/fonts/LiberationSans-Regular.ttf");
      if (res.ok) {
        customFont = await pdfDoc.embedFont(await res.arrayBuffer());
      }
    }
  } catch {}

  const toSafeStr = (s: string) => {
    if (!s || customFont) return s;
    return s
      .replace(/İ/g, "I").replace(/ı/g, "i")
      .replace(/Ş/g, "S").replace(/ş/g, "s")
      .replace(/Ğ/g, "G").replace(/ğ/g, "g")
      .replace(/Ç/g, "C").replace(/ç/g, "c")
      .replace(/Ö/g, "O").replace(/ö/g, "o")
      .replace(/Ü/g, "U").replace(/ü/g, "u");
  };

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const page = pages[field.page];
    if (!page) continue;

    const { height: pageHeight } = page.getSize();
    // Convert coordinate from top-left to PDF bottom-left
    const pdfX = field.x;
    const pdfY = pageHeight - field.y - field.h;
    const uniqueName = `${toSafeStr(field.name || "field")}_${i}_${field.id.slice(0, 5)}`;

    try {
      if (field.type === "text" || field.type === "multiline" || field.type === "date") {
        const tf = form.createTextField(uniqueName);
        if (typeof field.value === "string" && field.value) {
          tf.setText(toSafeStr(field.value));
        } else if (typeof field.defaultValue === "string" && field.defaultValue) {
          tf.setText(toSafeStr(field.defaultValue));
        }
        if (field.type === "multiline") {
          tf.enableMultiline();
        }
        if (field.required) tf.enableRequired();
        if (field.readOnly) tf.enableReadOnly();
        tf.addToPage(page, {
          x: pdfX,
          y: pdfY,
          width: field.w,
          height: field.h,
          borderWidth: 1,
          borderColor: rgb(0.7, 0.7, 0.7)
        });
        if (customFont) tf.updateAppearances(customFont);
      } else if (field.type === "checkbox") {
        const cb = form.createCheckBox(uniqueName);
        if (field.value === true) {
          cb.check();
        }
        if (field.required) cb.enableRequired();
        if (field.readOnly) cb.enableReadOnly();
        cb.addToPage(page, {
          x: pdfX,
          y: pdfY,
          width: Math.min(field.w, field.h),
          height: Math.min(field.w, field.h),
          borderWidth: 1,
          borderColor: rgb(0.6, 0.6, 0.6)
        });
      } else if (field.type === "dropdown") {
        const dd = form.createDropdown(uniqueName);
        const rawOpts = field.options && field.options.length > 0 ? field.options : ["Seçenek 1", "Seçenek 2"];
        const opts = rawOpts.map(toSafeStr);
        dd.addOptions(opts);
        if (typeof field.value === "string") {
          const safeVal = toSafeStr(field.value);
          if (opts.includes(safeVal)) dd.select(safeVal);
        }
        if (field.required) dd.enableRequired();
        if (field.readOnly) dd.enableReadOnly();
        dd.addToPage(page, {
          x: pdfX,
          y: pdfY,
          width: field.w,
          height: field.h,
          borderWidth: 1,
          borderColor: rgb(0.7, 0.7, 0.7)
        });
        if (customFont) dd.updateAppearances(customFont);
      } else if (field.type === "radio") {
        const rg = form.createRadioGroup(uniqueName);
        const rawOpts = field.options && field.options.length > 0 ? field.options : ["Seçenek A", "Seçenek B"];
        const opts = rawOpts.map(toSafeStr);
        for (let oIdx = 0; oIdx < opts.length; oIdx++) {
          rg.addOptionToPage(opts[oIdx], page, {
            x: pdfX,
            y: pdfY - oIdx * 22,
            width: 14,
            height: 14,
            borderWidth: 1,
            borderColor: rgb(0.6, 0.6, 0.6)
          });
        }
        if (typeof field.value === "string") {
          const safeVal = toSafeStr(field.value);
          if (opts.includes(safeVal)) rg.select(safeVal);
        }
        if (field.required) rg.enableRequired();
        if (field.readOnly) rg.enableReadOnly();
      } else if (field.type === "signature") {
        const btn = form.createButton(uniqueName);
        if (field.readOnly) btn.enableReadOnly();
        const btnLabel = customFont ? "İmza Alanı" : "Imza Alani";
        btn.addToPage(btnLabel, page, {
          x: pdfX,
          y: pdfY,
          width: field.w,
          height: field.h,
          borderWidth: 1,
          borderColor: rgb(0.4, 0.4, 0.9)
        });
        if (customFont) btn.updateAppearances(customFont);
      }
    } catch (err) {
      console.warn("Could not embed form field:", field.name, err);
    }
  }

  if (customFont) {
    try {
      form.updateFieldAppearances(customFont);
    } catch {}
  }

  if (flatten) {
    try {
      form.flatten();
    } catch (e) {
      console.warn("Failed to flatten form fields:", e);
    }
  }

  return await pdfDoc.save();
}

/**
 * Detects and extracts existing AcroForm fields from a PDF
 */
export async function extractFormFieldsFromPdf(pdfBytes: Uint8Array): Promise<FormFieldItem[]> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    if (!fields.length) return [];

    const pages = pdfDoc.getPages();
    const extracted: FormFieldItem[] = [];

    for (const f of fields) {
      const widgets = f.acroField.getWidgets();
      if (!widgets.length) continue;

      for (let wIdx = 0; wIdx < widgets.length; wIdx++) {
        const widget = widgets[wIdx];
        const pRef = widget.P();
        let pageIdx = pages.findIndex((p) => p.ref === pRef);
        if (pageIdx === -1) pageIdx = 0;

        const page = pages[pageIdx];
        const pageHeight = page ? page.getSize().height : 800;
        const rect = widget.getRectangle();
        const x = Math.round(rect.x);
        const y = Math.round(pageHeight - rect.y - rect.height);
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);

        const typeName = f.constructor.name;
        let type: FormFieldType = "text";
        let value: string | boolean = "";
        let options: string[] | undefined = undefined;

        if (typeName === "PDFTextField") {
          const tf = f as any;
          type = tf.isMultiline?.() ? "multiline" : "text";
          value = tf.getText() || "";
        } else if (typeName === "PDFCheckBox") {
          const cb = f as any;
          type = "checkbox";
          value = cb.isChecked() || false;
        } else if (typeName === "PDFDropdown") {
          const dd = f as any;
          type = "dropdown";
          options = dd.getOptions?.() || [];
          value = dd.getSelected?.()?.[0] || "";
        } else if (typeName === "PDFRadioGroup") {
          const rg = f as any;
          type = "radio";
          options = rg.getOptions?.() || [];
          value = rg.getSelected?.() || "";
        } else if (typeName === "PDFButton") {
          type = "signature";
        }

        extracted.push({
          id: `acro_${f.getName()}_${wIdx}`,
          page: pageIdx,
          type,
          name: f.getName(),
          value,
          options,
          required: f.isRequired(),
          readOnly: f.isReadOnly(),
          x,
          y,
          w,
          h
        });
      }
    }
    return extracted;
  } catch (err) {
    console.warn("Could not extract form fields:", err);
    return [];
  }
}
