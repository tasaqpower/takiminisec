import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,openSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const major=parseInt(process.versions.node.split('.')[0],10);
if(major<22){
  console.error(`\n[HATA] Forma Belge Atölyesi Node.js >= 22.13.0 gerektirir.`);
  console.error(`Mevcut Node sürümü: v${process.versions.node}`);
  console.error(`Lütfen Node.js v22 veya üzerini yükleyin: https://nodejs.org/\n`);
  process.exit(1);
}
const root=fileURLToPath(new URL('../',import.meta.url));
const url='http://localhost:5173/';
const ready=async()=>{try{const response=await fetch(url,{signal:AbortSignal.timeout(2000)});return response.ok&&(await response.text()).includes('Belge Atölyesi')}catch{return false}};
const show=()=>{const browser=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,windowsHide:true,stdio:'ignore'});browser.unref()};
if(await ready()){show();process.exit(0)}
if(!existsSync(new URL('../node_modules/vinext',import.meta.url))){console.error('Paketler eksik. Bu klasörde npm ci komutunu çalıştırın.');process.exit(1)}
mkdirSync(new URL('../.sites-runtime/',import.meta.url),{recursive:true});
const output=openSync(new URL('../.sites-runtime/forma-out.log',import.meta.url),'a');
const errors=openSync(new URL('../.sites-runtime/forma-error.log',import.meta.url),'a');
const server=spawn(process.execPath,['scripts/run-framework.mjs','dev'],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',output,errors]});server.unref();
for(let i=0;i<30;i++){if(await ready()){show();process.exit(0)}await new Promise(resolve=>setTimeout(resolve,1000))}
console.error('Uygulama henüz hazır değil. Ayrıntılar: .sites-runtime/forma-error.log');process.exitCode=1;
