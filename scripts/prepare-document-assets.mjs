import fs from 'node:fs';
import fonts from 'pdfmake/build/vfs_fonts.js';
fs.mkdirSync('public/fonts',{recursive:true});
fs.writeFileSync('public/fonts/Roboto-Regular.ttf',Buffer.from(fonts['Roboto-Regular.ttf'],'base64'));
fs.copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','public/pdf.worker.min.mjs');
fs.copyFileSync('node_modules/pdfmake/LICENSE','public/fonts/PDFMAKE-LICENSE.txt');
for(const folder of ['cmaps','standard_fonts','wasm'])fs.cpSync('node_modules/pdfjs-dist/'+folder,'public/'+folder,{recursive:true});
for(const part of ['latin','latin-ext'])for(const weight of [400,500,600,700]){const file=`plus-jakarta-sans-${part}-${weight}-normal.woff2`;fs.copyFileSync('node_modules/@fontsource/plus-jakarta-sans/files/'+file,'public/fonts/'+file)}
fs.copyFileSync('node_modules/@fontsource/plus-jakarta-sans/LICENSE','public/fonts/PLUS-JAKARTA-LICENSE.txt');
