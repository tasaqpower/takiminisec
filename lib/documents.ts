import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import DOMPurify from "dompurify";
import { removePdfText, removePdfImages, type TextRemoval } from "./pdf-text.ts";
import { fontFile, type PdfFont } from "./pdf-fonts.ts";

export type Mark = {
  id: string;
  page: number;
  kind: "text" | "draw" | "highlight" | "signature" | "stamp";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  size: number;
  text?: string;
  image?: string;
  points?: { x: number; y: number }[];
  font?: PdfFont;
  bold?: boolean;
  italic?: boolean;
  angle?: number;
  sourceId?: string;
  opacity?: number;
  align?: "left" | "center" | "right";
  bg?: string;
  ocrSourceCropDataUrl?: string;
  ocrOriginalBounds?: { x: number; y: number; w: number; h: number };
  ocrTextDirty?: boolean;
  ocrBackgroundColor?: string;
  originalFontName?: string;
  fontName?: string;
  fontMatchQuality?: string;
};

export function canEncodeWinAnsi(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code <= 126) continue;
    if (code >= 160 && code <= 255) continue;
    if ([0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017D, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x017E, 0x0178].includes(code)) continue;
    return false;
  }
  return true;
}

export function isFontCharacterSupported(
  text: string,
  fontNameOrFamily?: string,
  isOcr?: boolean
): { supported: boolean; unsupportedChars: string[] } {
  if (isOcr) {
    return { supported: true, unsupportedChars: [] };
  }
  const isStandardWinAnsiFont = (
    !fontNameOrFamily ||
    fontNameOrFamily.toLowerCase().includes("helvetica") ||
    fontNameOrFamily.toLowerCase().includes("times") ||
    fontNameOrFamily.toLowerCase().includes("courier") ||
    fontNameOrFamily === "sans" ||
    fontNameOrFamily === "serif" ||
    fontNameOrFamily === "courier"
  );
  if (!isStandardWinAnsiFont) {
    return { supported: true, unsupportedChars: [] };
  }
  const unsupportedChars: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!canEncodeWinAnsi(ch) && !unsupportedChars.includes(ch)) {
      unsupportedChars.push(ch);
    }
  }
  return {
    supported: unsupportedChars.length === 0,
    unsupportedChars
  };
}
export type PageItem = {index:number; rotation:number};
export async function pdfRenderer() {
  const isNode = typeof window === "undefined" || (typeof process !== "undefined" && Boolean(process?.versions?.node));
  if (isNode) {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { pathToFileURL } = await import("node:url");
    const path = await import("node:path");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
    ).href;
    return pdfjsLib;
  }
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}
export async function loadPdf(bytes:Uint8Array){if (typeof window !== "undefined" && import.meta.env?.DEV && process.env.NEXT_PUBLIC_ENABLE_TEST_API === "true") { if ((window as any).__dragTestCounters) (window as any).__dragTestCounters.loadPdfCount++; }const p=await pdfRenderer();const task=p.getDocument({data:bytes.slice(),cMapUrl:"/cmaps/",cMapPacked:true,standardFontDataUrl:"/standard_fonts/",wasmUrl:"/wasm/"});try{return await task.promise}catch(error){await task.destroy();throw error}}
export function safeHtml(html:string){
 DOMPurify.addHook("uponSanitizeAttribute",(_node,data)=>{if(data.attrName==="src"&&!/^data:image\/(png|jpeg|jpg|gif);base64,/i.test(data.attrValue))data.keepAttr=false;if(data.attrName==="style"){const allowed=["font-weight","font-style","text-decoration","text-align","color","background-color"];data.attrValue=data.attrValue.split(";").filter(rule=>{const [key,value]=rule.split(":");return allowed.includes(key?.trim().toLowerCase())&&!!value&&/^[a-z0-9#(),.%\s-]+$/i.test(value)&&! /url|expression|var/i.test(value)}).join(";")}});
 try{return DOMPurify.sanitize(html,{USE_PROFILES:{html:true},FORBID_TAGS:["style","iframe","form","input","button","video","audio","link"],FORBID_ATTR:["srcset","background"]})}finally{DOMPurify.removeHook("uponSanitizeAttribute")}
}
export function download(data:Blob|Uint8Array,name:string,type="application/pdf"){const blob=data instanceof Blob?data:new Blob([data as BlobPart],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
export function stem(name:string){return name.replace(/\.[^.]+$/,"")||"belge"}
export async function imagePdf(files:File[]){const out=await PDFDocument.create();for(const file of files){const bytes=await file.arrayBuffer();const image=/\.png$/i.test(file.name)?await out.embedPng(bytes):await out.embedJpg(bytes);const page=out.addPage([595.28,841.89]);const scale=Math.min(515/image.width,762/image.height);const w=image.width*scale,h=image.height*scale;page.drawImage(image,{x:(595.28-w)/2,y:(841.89-h)/2,width:w,height:h})}return out.save()}
export async function mergePdf(files:File[]){const out=await PDFDocument.create();for(const file of files){const doc=await PDFDocument.load(await file.arrayBuffer());for(const page of await out.copyPages(doc,doc.getPageIndices()))out.addPage(page)}return out.save()}
function col(hex:string){const n=parseInt(hex.replace("#",""),16);return rgb(((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255)}
export async function exportPdf(bytes:Uint8Array,pages:PageItem[],marks:Mark[],removals:TextRemoval[]=[],images:any[]=[]){
 bytes=await removePdfText(bytes,removals.filter(r=>!r.id.startsWith("ocr-")&&pages.some(p=>p.index===r.page)));
 const imageRemovals = images
   .filter(img => (img.deleted || img.isModified) && img.isOriginal && img.originalBounds)
     .map(img => ({
       page: img.page,
       bounds: img.originalBounds,
       imageId: img.id,
       objectRef: img.objectRef,
       imageIndex: img.imageIndex,
       pixelWidth: img.pixelWidth,
       pixelHeight: img.pixelHeight,
       matrix: img.matrix
     }));
 if (imageRemovals.length > 0) {
   bytes = await removePdfImages(bytes, imageRemovals);
 }
  const src=await PDFDocument.load(bytes),out=await PDFDocument.create();out.registerFontkit(fontkit);
  const fonts=new Map<string,Awaited<ReturnType<typeof out.embedFont>>>();
   for(const m of marks.filter(m=>m.kind==="text")){
     if (m.ocrSourceCropDataUrl && !m.ocrTextDirty) {
       continue; // Rendered via PNG crop image
     }
     const isBold = Boolean(m.bold || m.originalFontName?.toLowerCase().includes("bold") || m.fontName?.toLowerCase().includes("bold"));
     const isItalic = Boolean(m.italic || m.originalFontName?.toLowerCase().includes("italic") || m.originalFontName?.toLowerCase().includes("oblique"));

     const isCourier = Boolean(m.font === "courier" || m.originalFontName?.toLowerCase().includes("courier") || m.fontName?.toLowerCase().includes("courier"));
     if (isCourier && canEncodeWinAnsi(m.text || "")) {
       const stdName = isBold
         ? (isItalic ? StandardFonts.CourierBoldOblique : StandardFonts.CourierBold)
         : (isItalic ? StandardFonts.CourierOblique : StandardFonts.Courier);
       if (!fonts.has("Courier_" + stdName)) {
         const embedded = await out.embedStandardFont(stdName);
         fonts.set("Courier_" + stdName, embedded);
       }
       continue;
     }

     const isTimes = Boolean(m.originalFontName?.toLowerCase().includes("times") || m.fontName?.toLowerCase().includes("times"));
     if (isTimes && canEncodeWinAnsi(m.text || "")) {
       const stdName = isBold
         ? (isItalic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold)
         : (isItalic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman);
       if (!fonts.has("Times_" + stdName)) {
         const embedded = await out.embedStandardFont(stdName);
         fonts.set("Times_" + stdName, embedded);
       }
       continue;
     }
     const isHelvetica = Boolean(
       m.originalFontName?.toLowerCase().includes("helvetica") ||
       m.fontName?.toLowerCase().includes("helvetica") ||
       (!isTimes && !isCourier && (m.font === "sans" || !m.font))
     );
     if (isHelvetica && canEncodeWinAnsi(m.text || "")) {
       const stdName = isBold
         ? (isItalic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold)
         : (isItalic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica);
       if (!fonts.has("Helvetica_" + stdName)) {
         const embedded = await out.embedStandardFont(stdName);
         fonts.set("Helvetica_" + stdName, embedded);
       }
       continue;
     }
     const file = fontFile(m.font, isBold, isItalic);
     if(!fonts.has(file)){
       let fontBuffer: ArrayBuffer | Uint8Array;
       if (typeof window === "undefined" || (typeof process !== "undefined" && Boolean(process?.versions?.node))) {
         const fs = await import("node:fs");
         const path = await import("node:path");
         fontBuffer = fs.readFileSync(path.resolve("public/fonts", file));
       } else {
         const response=await fetch('/fonts/'+file);
         if(!response.ok)throw Error('Yazı tipi yüklenemedi: ' + file);
         fontBuffer = await response.arrayBuffer();
       }
       const embedded = await out.embedFont(fontBuffer, { subset: false });
       fonts.set(file, embedded);
     }
   }
   const renderer=marks.length||images.length?await loadPdf(bytes):null;
   try{for(const item of pages){const [page]=await out.copyPages(src,[item.index]);out.addPage(page);const originalRotation=page.getRotation().angle;
    const annotations=marks.filter(m=>m.page===item.index);
    const pageImgs=images.filter(img=>img.page===item.index&&!img.deleted&&(!img.isOriginal||img.isModified));
    if((annotations.length||pageImgs.length)&&renderer){const original=await renderer.getPage(item.index+1);const unit=original.userUnit||1;const viewport=original.getViewport({scale:1});const point=(x:number,y:number)=>viewport.convertToPdfPoint(x,y);
     for(const m of annotations){
      if(m.kind==="text"){
       if(m.ocrSourceCropDataUrl && !m.ocrTextDirty){
         try {
           const b64 = m.ocrSourceCropDataUrl.split(",")[1];
           if (b64) {
             const cropBuf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
             const embeddedCrop = await out.embedPng(cropBuf);
             const [x, y] = point(m.x, m.y + m.h);
             page.drawImage(embeddedCrop, {
               x,
               y,
               width: m.w / unit,
               height: m.h / unit,
               rotate: degrees(originalRotation - (m.angle || 0))
             });
             continue;
           }
         } catch (cropErr) {
           console.warn("Could not embed OCR crop, falling back to text:", cropErr);
         }
       }
       if(m.bg){
         const a=point(m.x - 2, m.y - 1), b=point(m.x + m.w + 2, m.y + m.h + 1);
         page.drawRectangle({x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(a[0]-b[0]),height:Math.abs(a[1]-b[1]),color:col(m.bg),opacity:1});
       }
       const isBold = Boolean(m.bold || m.originalFontName?.toLowerCase().includes("bold") || m.fontName?.toLowerCase().includes("bold"));
       const isItalic = Boolean(m.italic || m.originalFontName?.toLowerCase().includes("italic") || m.originalFontName?.toLowerCase().includes("oblique"));

       const stdHelvName = isBold
         ? (isItalic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold)
         : (isItalic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica);
       const stdTimesName = isBold
         ? (isItalic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold)
         : (isItalic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman);
       const stdCourierName = isBold
         ? (isItalic ? StandardFonts.CourierBoldOblique : StandardFonts.CourierBold)
         : (isItalic ? StandardFonts.CourierOblique : StandardFonts.Courier);

       const isTimes = Boolean(m.originalFontName?.toLowerCase().includes("times") || m.fontName?.toLowerCase().includes("times"));
       const isCourier = Boolean(m.font === "courier" || m.originalFontName?.toLowerCase().includes("courier") || m.fontName?.toLowerCase().includes("courier"));
       const isHelv = Boolean(
         m.originalFontName?.toLowerCase().includes("helvetica") ||
         m.fontName?.toLowerCase().includes("helvetica") ||
         (!isTimes && !isCourier && (m.font === "sans" || !m.font))
       );

       const isTimesAllowed = isTimes && canEncodeWinAnsi(m.text || "");
       const isCourierAllowed = isCourier && canEncodeWinAnsi(m.text || "");
       const isHelvAllowed = isHelv && canEncodeWinAnsi(m.text || "");

       const fontObj = isCourierAllowed && fonts.has("Courier_" + stdCourierName)
         ? fonts.get("Courier_" + stdCourierName)!
         : (isTimesAllowed && fonts.has("Times_" + stdTimesName)
           ? fonts.get("Times_" + stdTimesName)!
           : (isHelvAllowed && fonts.has("Helvetica_" + stdHelvName)
             ? fonts.get("Helvetica_" + stdHelvName)!
             : fonts.get(fontFile(m.font, isBold, isItalic))!));
       const [x,y]=point(m.x,m.y+m.size);page.drawText(m.text||"",{x,y,size:m.size/unit,font:fontObj,color:col(m.color),rotate:degrees(originalRotation-(m.angle||0)),lineHeight:m.size*1.25/unit})}
      if(m.kind==="highlight"){
        const a=point(m.x,m.y),b=point(m.x+m.w,m.y+m.h);
        page.drawRectangle({
          x:Math.min(a[0],b[0]),
          y:Math.min(a[1],b[1]),
          width:Math.abs(a[0]-b[0]),
          height:Math.abs(a[1]-b[1]),
          color:col(m.color),
          opacity:m.opacity??1
        });
        if(m.image){
          try {
            const b64 = m.image.split(",")[1];
            if (b64) {
              const patchBuf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
              const embeddedPatch = await out.embedPng(patchBuf);
              const [x, y] = point(m.x, m.y + m.h);
              page.drawImage(embeddedPatch, {
                x,
                y,
                width: m.w / unit,
                height: m.h / unit,
                opacity: m.opacity ?? 1,
                rotate: degrees(originalRotation - (m.angle || 0))
              });
            }
          } catch (patchErr) {
            console.warn("Could not embed textured cover patch:", patchErr);
          }
        }
      }
      if(m.kind==="draw"){const pts=m.points||[];for(let i=1;i<pts.length;i++){const a=point(pts[i-1].x,pts[i-1].y),b=point(pts[i].x,pts[i].y);page.drawLine({start:{x:a[0],y:a[1]},end:{x:b[0],y:b[1]},thickness:m.size/unit,color:col(m.color),opacity:m.opacity??1})}}
      if((m.kind==="signature"||m.kind==="stamp")&&m.image){const image=await out.embedPng(m.image);const [x,y]=point(m.x,m.y+m.h);page.drawImage(image,{x,y,width:m.w/unit,height:m.h/unit,opacity:m.opacity??1,rotate:degrees(originalRotation)})}
     }
    for(const img of pageImgs){
     const url = img.dataUrl || img.previewUrl || "";
     if(url&&!url.startsWith("data:image/svg")){
      try{
       let buf: Uint8Array | null = null;
       if (url.startsWith("data:")) {
         const b64=url.split(",")[1];
         if(b64) buf=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
       }
       if(buf){
        const isJpg = img.format==="jpeg"||/^data:image\/jpe?g/i.test(url);
        const embedded=isJpg?await out.embedJpg(buf):await out.embedPng(buf);
        const [x,y]=point(img.x,img.y+img.h);
        page.drawImage(embedded,{x,y,width:img.w/unit,height:img.h/unit,opacity:img.opacity??1,rotate:degrees(originalRotation+(img.rotation||0))});
       }
      }catch(e){console.warn("Could not embed image:",e)}
     }
    }
   }
   page.setRotation(degrees((originalRotation+item.rotation)%360));
  }
  return await out.save();
 }finally{await renderer?.loadingTask.destroy()}
}
export async function extractPdfText(bytes:Uint8Array,pages?:PageItem[]){const doc=await loadPdf(bytes);try{const texts=[];for(const item of pages||Array.from({length:doc.numPages},(_,index)=>({index,rotation:0}))){const page=await doc.getPage(item.index+1);const text=await page.getTextContent();let value="",lastY:number|undefined;for(const t of text.items){if("str" in t){const y=t.transform[5];if(lastY!==undefined&&Math.abs(lastY-y)>4)value+="\n";value+=t.str+(t.hasEOL?"\n":" ");lastY=y}}texts.push(value.trim())}return texts.join("\n\n")}finally{await doc.loadingTask.destroy()}}
export async function importWord(file:File){if(/\.txt$/i.test(file.name)){const node=document.createElement("div");node.textContent=await file.text();return node.innerHTML.split(/\r?\n/).map(s=>`<p>${s||"<br>"}</p>`).join("")||"<p><br></p>"}const mammoth=await import("mammoth");const result=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{styleMap:["u => u"],ignoreEmptyParagraphs:false});return safeHtml(result.value)||"<p><br></p>"}
async function normalizedImages(root:HTMLElement){await Promise.all(Array.from(root.querySelectorAll("img")).map(async node=>{const image=new Image();image.src=node.src;try{await image.decode();const scale=Math.min(1,500/image.naturalWidth);node.width=Math.round(image.naturalWidth*scale);node.height=Math.round(image.naturalHeight*scale);if(/^data:image\/gif/i.test(node.src)){const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext("2d")!.drawImage(image,0,0);node.src=c.toDataURL("image/png")}}catch{node.remove()}}))}
export async function wordPdf(html:string){const [{default:pdfmake},{default:fonts},{default:convert}]=await Promise.all([import("pdfmake/build/pdfmake.js"),import("pdfmake/build/vfs_fonts.js"),import("html-to-pdfmake")]);pdfmake.addVirtualFileSystem(fonts);const root=document.createElement("div");root.innerHTML=safeHtml(html);await normalizedImages(root);const content=convert(root.innerHTML,{window,ignoreStyles:["font-family"],defaultStyles:{p:{margin:[0,0,0,8]}}});return await pdfmake.createPdf({content:content.length?content:[{text:" "}],pageSize:"A4",pageMargins:[48,48,48,48],defaultStyle:{font:"Roboto",fontSize:11,lineHeight:1.35}}).getBlob()}
export async function wordDocx(html:string){
 const d=await import("docx");const root=document.createElement("div");root.innerHTML=safeHtml(html);await normalizedImages(root);
 function runs(node:Node,style:any={}):any[]{if(node.nodeType===Node.TEXT_NODE)return[new d.TextRun({text:node.textContent||"",...style})];if(!(node instanceof HTMLElement))return[];const tag=node.tagName;const next={...style,bold:style.bold||["B","STRONG"].includes(tag)||node.style.fontWeight==="bold"||Number(node.style.fontWeight)>=600,italics:style.italics||["I","EM"].includes(tag)||node.style.fontStyle==="italic",underline:style.underline||(["U"].includes(tag)||node.style.textDecoration.includes("underline")?{}:undefined)};if(tag==="BR")return[new d.TextRun({text:"",break:1})];if(tag==="IMG"){try{const src=node.getAttribute("src")||"";const match=src.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/);if(!match)return[];const data=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));const w=Math.min(Number(node.getAttribute("width"))||420,500),h=Number(node.getAttribute("height"))||w*.65;return[new d.ImageRun({data,type:match[1]==="jpg"?"jpg":match[1] as any,transformation:{width:w,height:h}})]}catch{return[]}}return Array.from(node.childNodes).flatMap(n=>runs(n,next))}
 function blocks(container:HTMLElement):any[]{return Array.from(container.childNodes).flatMap((node):any[]=>{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent?.trim()?[new d.Paragraph({children:runs(node)})]:[];
  if(!(node instanceof HTMLElement))return[];const tag=node.tagName;
  if(tag==="TABLE"){return[new d.Table({width:{size:100,type:d.WidthType.PERCENTAGE},rows:Array.from(node.querySelectorAll("tr")).map(row=>new d.TableRow({children:Array.from(row.children).map(cell=>new d.TableCell({children:[new d.Paragraph({children:runs(cell)})]}))}))})]}
  if(["UL","OL"].includes(tag))return Array.from(node.children).map((li,i)=>new d.Paragraph({children:[...(tag==="OL"?[new d.TextRun(`${i+1}. `)]:[]),...runs(li)],...(tag==="UL"?{bullet:{level:0}}:{}),spacing:{after:120}}));
  if(tag==="DIV"&&Array.from(node.children).some(c=>["P","DIV","TABLE"].includes(c.tagName)))return blocks(node);
  const heading=tag==="H1"?d.HeadingLevel.HEADING_1:tag==="H2"?d.HeadingLevel.HEADING_2:tag==="H3"?d.HeadingLevel.HEADING_3:undefined;
  const align=node.style.textAlign;return[new d.Paragraph({children:runs(node),heading,alignment:align==="center"?d.AlignmentType.CENTER:align==="right"?d.AlignmentType.RIGHT:align==="justify"?d.AlignmentType.JUSTIFIED:undefined,spacing:{after:160}})]
 })}
 const children=blocks(root);return d.Packer.toBlob(new d.Document({creator:"Forma",styles:{default:{document:{run:{font:"Calibri",size:22}}}},sections:[{children:children.length?children:[new d.Paragraph("")]}]}))
}
