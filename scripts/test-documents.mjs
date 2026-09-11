import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {PDFDocument} from 'pdf-lib';
let createCanvas,DOMMatrix,ImageData,Path2D;
try {
  ({createCanvas,DOMMatrix,ImageData,Path2D} = await import('@napi-rs/canvas'));
} catch {
  DOMMatrix = class DOMMatrix {
    constructor() { this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0; }
    invertSelf() { return this; }
    inverse() { return this; }
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
  };
  ImageData = class ImageData { constructor(w,h) { this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4); } };
  Path2D = class Path2D { constructor() { return new Proxy(this, { get: () => () => {} }); } };
  const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  createCanvas = (w, h) => {
    const canvas = { width: w, height: h };
    const ctx = new Proxy({ canvas }, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        if (prop === 'getTransform') return () => new DOMMatrix();
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'createImageData') return (iw, ih) => new ImageData(iw, ih);
        return () => {};
      },
      set: (target, prop, val) => { target[prop] = val; return true; }
    });
    canvas.getContext = () => ctx;
    canvas.toDataURL = () => 'data:image/png;base64,' + PNG_1X1.toString('base64');
    canvas.toBuffer = () => PNG_1X1;
    return canvas;
  };
}
const dom=new JSDOM('<!doctype html><html><body></body></html>',{pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,Node:dom.window.Node,HTMLElement:dom.window.HTMLElement,DOMMatrix,ImageData,Path2D});
const actualFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>typeof input==='string'&&input.startsWith('/fonts/')?new Response(fs.readFileSync('public'+input)):actualFetch(input,init);
class MockCanvasFactory {
  create(w, h) { const cv = createCanvas(w, h); return { canvas: cv, context: cv.getContext('2d') }; }
  reset(ctx, w, h) { ctx.canvas.width = w; ctx.canvas.height = h; }
  destroy() {}
}
globalThis.TestCanvasFactory = MockCanvasFactory;
fs.mkdirSync('outputs/qa',{recursive:true});
let docSrc=fs.readFileSync('lib/documents.ts','utf8');
docSrc=docSrc.replace('"mammoth"','"mammoth/mammoth.browser.js"');
docSrc=docSrc.replace('"pdfjs-dist"','"pdfjs-dist/legacy/build/pdf.mjs"');
const workerHref=pathToFileURL(process.cwd()+'/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs').href;
docSrc=docSrc.replace('"/pdf.worker.min.mjs"',()=>JSON.stringify(workerHref));
docSrc=docSrc.replace('wasmUrl:"/wasm/"',()=>'wasmUrl:"/wasm/",CanvasFactory:globalThis.TestCanvasFactory');
await build({stdin:{contents:docSrc,resolveDir:process.cwd()+'/lib',loader:'ts'},outfile:'outputs/qa/documents-test.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const engine=await import('../outputs/qa/documents-test.mjs');
const original=new Uint8Array(fs.readFileSync('outputs/qa/donus-4-sayfa.pdf'));
const text='İstanbul, ışık, öğüt, şüphe. ÇĞİÖŞÜ çğıöşü';
const canvas=createCanvas(160,60),ctx=canvas.getContext('2d');ctx.fillStyle='#102040';ctx.fillRect(10,10,140,40);
const marks=Array.from({length:4},(_,page)=>[{id:'t'+page,page,kind:'text',x:70,y:180,w:200,h:20,size:16,color:'#30294d',text},{id:'s'+page,page,kind:'signature',x:70,y:250,w:160,h:60,size:16,color:'#30294d',image:canvas.toDataURL('image/png')}]).flat();
const edited=await engine.exportPdf(original,[0,1,2,3].map(index=>({index,rotation:index===2?90:0})),marks);
fs.writeFileSync('outputs/qa/edited.pdf',edited);
const inspect=await PDFDocument.load(edited);assert.equal(inspect.getPageCount(),4);assert.equal(inspect.getPage(2).getRotation().angle,270);assert.deepEqual(inspect.getPage(3).getCropBox(),{x:30,y:40,width:500,height:740});
const extracted=await engine.extractPdfText(edited);assert.equal(extracted.split(text).length-1,4);assert.match(extracted,/Sayfa 4/);
const doc=await engine.loadPdf(edited);
const canvasFactory=new MockCanvasFactory();
for(let i=1;i<=4;i++){const page=await doc.getPage(i),viewport=page.getViewport({scale:1});const c=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:c.getContext('2d'),viewport,canvas:c,canvasFactory}).promise;fs.writeFileSync(`outputs/qa/edited-page-${i}.png`,c.toBuffer('image/png'))}
await doc.loadingTask.destroy();
const subset=await engine.exportPdf(original,[{index:3,rotation:0},{index:0,rotation:90}],marks);assert.equal((await PDFDocument.load(subset)).getPageCount(),2);
const file=new File([original],'sample.pdf');const merged=await engine.mergePdf([file,file]);assert.equal((await PDFDocument.load(merged)).getPageCount(),8);
const jpg=createCanvas(320,100).toBuffer('image/png');const imagePdf=await engine.imagePdf([new File([jpg],'image.png')]);assert.equal((await PDFDocument.load(imagePdf)).getPageCount(),1);
const unsafe='<p style="position:fixed;inset:0;color:red;background-image:u\\72l(https://example.com/x)">Güvenli</p><img src="https://example.com/a.png"><script>bad()</script>';
const clean=engine.safeHtml(unsafe);assert.ok(!/position|inset|example|script|background-image/.test(clean));assert.match(clean,/color:red/);
const imported=await engine.importWord(new File([fs.readFileSync('outputs/qa/ornek.docx')],'ornek.docx'));assert.match(imported,/Kalın metin/);assert.match(imported,/<strong>/);assert.match(imported,/<table>/);
const html='<h1>Forma</h1><p>'+text+'</p><p><strong>Kalın</strong> ve <em>italik</em></p><ul><li>Madde</li></ul><table><tr><td>Başlık</td><td>Değer</td></tr></table>';
const docx=await engine.wordDocx(html);fs.writeFileSync('outputs/qa/roundtrip.docx',Buffer.from(await docx.arrayBuffer()));
const mammoth=await import('mammoth');const roundtrip=await mammoth.convertToHtml({buffer:Buffer.from(await docx.arrayBuffer())});assert.match(roundtrip.value,/ÇĞİÖŞÜ çğıöşü/);assert.match(roundtrip.value,/<strong>Kalın<\/strong>/);assert.match(roundtrip.value,/<em>italik<\/em>/);assert.match(roundtrip.value,/<table>/);
const wordPdf=await engine.wordPdf(html);fs.writeFileSync('outputs/qa/word.pdf',Buffer.from(await wordPdf.arrayBuffer()));const convertedText=await engine.extractPdfText(new Uint8Array(await wordPdf.arrayBuffer()));assert.match(convertedText,/ÇĞİÖŞÜ çğıöşü/);assert.match(convertedText,/Başlık/);
await assert.rejects(()=>engine.loadPdf(new Uint8Array([1,2,3])));
console.log('PASS: Turkish PDF annotations, rotated/cropped pages, subset, merge, image PDF, HTML sanitization, DOCX rich-text roundtrip, Word→PDF, invalid PDF.');
