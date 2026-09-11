import { PDFDocument, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import DOMPurify from "dompurify";
import { removePdfText, removePdfImages, type TextRemoval } from "./pdf-text";
import { fontFile, type PdfFont } from "./pdf-fonts";

export type Mark = {id:string; page:number; kind:"text"|"draw"|"highlight"|"signature"; x:number; y:number; w:number; h:number; color:string; size:number; text?:string; image?:string; points?:{x:number;y:number}[];font?:PdfFont;bold?:boolean;italic?:boolean;angle?:number;sourceId?:string};
export type PageItem = {index:number; rotation:number};
export async function pdfRenderer(){ const pdfjs=await import("pdfjs-dist"); pdfjs.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs";return pdfjs; }
export async function loadPdf(bytes:Uint8Array){const p=await pdfRenderer();const task=p.getDocument({data:bytes.slice(),cMapUrl:"/cmaps/",cMapPacked:true,standardFontDataUrl:"/standard_fonts/",wasmUrl:"/wasm/"});try{return await task.promise}catch(error){await task.destroy();throw error}}
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
 bytes=await removePdfText(bytes,removals.filter(r=>pages.some(p=>p.index===r.page)));
 const imageRemovals = images
   .filter(img => (img.deleted || img.isModified) && img.isOriginal && img.originalBounds)
   .map(img => ({ page: img.page, bounds: img.originalBounds }));
 if (imageRemovals.length > 0) {
   bytes = await removePdfImages(bytes, imageRemovals);
 }
 const src=await PDFDocument.load(bytes),out=await PDFDocument.create();out.registerFontkit(fontkit);
 const fonts=new Map<string,Awaited<ReturnType<typeof out.embedFont>>>();
 for(const m of marks.filter(m=>m.kind==="text")){const file=fontFile(m.font,m.bold,m.italic);if(!fonts.has(file)){const response=await fetch('/fonts/'+file);if(!response.ok)throw Error('Yazı tipi yüklenemedi.');fonts.set(file,await out.embedFont(await response.arrayBuffer(),{subset:true}))}}
 const renderer=marks.length||images.length?await loadPdf(bytes):null;
 try{for(const item of pages){const [page]=await out.copyPages(src,[item.index]);out.addPage(page);const originalRotation=page.getRotation().angle;
  const annotations=marks.filter(m=>m.page===item.index);
  const pageImgs=images.filter(img=>img.page===item.index&&!img.deleted&&(!img.isOriginal||img.isModified));
  if((annotations.length||pageImgs.length)&&renderer){const original=await renderer.getPage(item.index+1);const unit=original.userUnit||1;const viewport=original.getViewport({scale:1});const point=(x:number,y:number)=>viewport.convertToPdfPoint(x,y);
   for(const m of annotations){
    if(m.kind==="text"){const [x,y]=point(m.x,m.y+m.size);page.drawText(m.text||"",{x,y,size:m.size/unit,font:fonts.get(fontFile(m.font,m.bold,m.italic))!,color:col(m.color),rotate:degrees(originalRotation-(m.angle||0)),lineHeight:m.size*1.25/unit})}
    if(m.kind==="highlight"){const a=point(m.x,m.y),b=point(m.x+m.w,m.y+m.h);page.drawRectangle({x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(a[0]-b[0]),height:Math.abs(a[1]-b[1]),color:col(m.color),opacity:.3})}
    if(m.kind==="draw"){const pts=m.points||[];for(let i=1;i<pts.length;i++){const a=point(pts[i-1].x,pts[i-1].y),b=point(pts[i].x,pts[i].y);page.drawLine({start:{x:a[0],y:a[1]},end:{x:b[0],y:b[1]},thickness:m.size/unit,color:col(m.color)})}}
    if(m.kind==="signature"&&m.image){const image=await out.embedPng(m.image);const [x,y]=point(m.x,m.y+m.h);page.drawImage(image,{x,y,width:m.w/unit,height:m.h/unit,rotate:degrees(originalRotation)})}
   }
   for(const img of pageImgs){
    if(img.dataUrl&&!img.dataUrl.startsWith("data:image/svg")){
     try{
      const b64=img.dataUrl.split(",")[1];
      if(b64){
       const buf=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
       const embedded=img.format==="jpeg"||/^data:image\/jpe?g/i.test(img.dataUrl)?await out.embedJpg(buf):await out.embedPng(buf);
       const [x,y]=point(img.x,img.y+img.h);
       page.drawImage(embedded,{x,y,width:img.w/unit,height:img.h/unit,opacity:img.opacity??1,rotate:degrees(originalRotation+(img.rotation||0))});
      }
     }catch(e){console.warn("Could not embed image:",e)}
    }
   }
  }
  page.setRotation(degrees((originalRotation+item.rotation)%360));
 }return await out.save()}finally{await renderer?.loadingTask.destroy()}
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
