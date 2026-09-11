import fs from 'node:fs';
import {PDFDocument,degrees,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {Document,Paragraph,TextRun,Packer,Table,TableRow,TableCell} from 'docx';
fs.mkdirSync('outputs/qa',{recursive:true});
const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fs.readFileSync('public/fonts/Roboto-Regular.ttf'),{subset:true});
for(let n=0;n<4;n++){const page=pdf.addPage([595,842]);page.drawText(`Sayfa ${n+1} — İstanbul, ışık, öğüt, şüphe.`,{x:60,y:730,font,size:18});page.drawRectangle({x:60,y:500,width:400,height:150,borderColor:rgb(.4,.3,.8),borderWidth:2});page.setRotation(degrees(n*90));if(n===3)page.setCropBox(30,40,500,740)}
fs.writeFileSync('outputs/qa/donus-4-sayfa.pdf',await pdf.save());
const doc=new Document({sections:[{children:[new Paragraph({text:'Türkçe dönüşüm testi',heading:'Heading1'}),new Paragraph({children:[new TextRun('İstanbul, ışık, öğüt, şüphe. '),new TextRun({text:'Kalın metin',bold:true}),new TextRun({text:' ve italik metin',italics:true})]}),new Paragraph({text:'Birinci madde',bullet:{level:0}}),new Table({rows:[new TableRow({children:[new TableCell({children:[new Paragraph('Başlık')]}),new TableCell({children:[new Paragraph('Değer')]} )]})]})]}]});fs.writeFileSync('outputs/qa/ornek.docx',await Packer.toBuffer(doc));fs.writeFileSync('outputs/qa/bozuk.pdf','not a pdf');
