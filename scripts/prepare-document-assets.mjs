import fs from 'node:fs';
import fonts from 'pdfmake/build/vfs_fonts.js';
fs.mkdirSync('public/fonts',{recursive:true});
for(const file of ['Roboto-Regular.ttf','Roboto-Medium.ttf','Roboto-Italic.ttf','Roboto-MediumItalic.ttf'])fs.writeFileSync('public/fonts/'+file,Buffer.from(fonts[file],'base64'));
for(const style of ['Regular','Bold','Italic','BoldItalic'])fs.copyFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-'+style+'.ttf','public/fonts/LiberationSans-'+style+'.ttf');
fs.copyFileSync('node_modules/pdfjs-dist/standard_fonts/LICENSE_LIBERATION','public/fonts/LIBERATION-LICENSE.txt');
fs.copyFileSync('node_modules/@embedpdf/pdfium/dist/pdfium.wasm','public/pdfium.wasm');
fs.copyFileSync('node_modules/@embedpdf/pdfium/LICENSE.pdfium','public/PDFIUM-LICENSE.txt');
fs.copyFileSync('node_modules/@embedpdf/pdfium/LICENSE','public/EMBEDPDF-LICENSE.txt');
fs.copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','public/pdf.worker.min.mjs');
fs.copyFileSync('node_modules/pdfmake/LICENSE','public/fonts/PDFMAKE-LICENSE.txt');
for(const folder of ['cmaps','standard_fonts','wasm'])fs.cpSync('node_modules/pdfjs-dist/'+folder,'public/'+folder,{recursive:true});
for(const part of ['latin','latin-ext'])for(const weight of [400,500,600,700]){const file=`plus-jakarta-sans-${part}-${weight}-normal.woff2`;fs.copyFileSync('node_modules/@fontsource/plus-jakarta-sans/files/'+file,'public/fonts/'+file)}
fs.copyFileSync('node_modules/@fontsource/plus-jakarta-sans/LICENSE','public/fonts/PLUS-JAKARTA-LICENSE.txt');
if(fs.existsSync('public/fonts/lora/Lora-Variable.ttf'))fs.copyFileSync('public/fonts/lora/Lora-Variable.ttf','public/fonts/Lora-Regular.ttf');

