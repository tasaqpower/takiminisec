export const PDF_FONTS = [
  { value: "sans", label: "Liberation Sans (Helvetica/Arial)", family: "Forma Sans", file: "LiberationSans-Regular.ttf" },
  { value: "roboto", label: "Roboto", family: "Forma Roboto", file: "Roboto-Regular.ttf" },
  { value: "serif", label: "Lora", family: "Forma Lora", file: "Lora-Regular.ttf" },
] as const;
export type PdfFont = typeof PDF_FONTS[number]["value"];
export function pdfFont(id?: string) { return PDF_FONTS.find(font => font.value === id) || PDF_FONTS[0]; }
export function fontFile(id?: string, bold = false, italic = false) {
  const font = pdfFont(id);
  if (font.value === "serif") return font.file;
  const suffix = font.value === "roboto"
    ? (bold ? "Medium" : "") + (italic ? "Italic" : "")
    : (bold ? "Bold" : "") + (italic ? "Italic" : "");
  return font.file.replace("Regular", suffix || "Regular");
}
