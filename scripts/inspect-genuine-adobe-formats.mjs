import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const genuinePrfpset = 'C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\LocalizedPresets\\en_US\\Effect Presets\\Factory Presets.prfpset';
const genuineMogrt = 'C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\Essential Graphics\\Basic Title.mogrt';

console.log('--- GENUINE PRFPSET INSPECTION ---');
if (fs.existsSync(genuinePrfpset)) {
  const buf = fs.readFileSync(genuinePrfpset);
  console.log(`Size: ${buf.length} bytes`);
  console.log(`Magic bytes (hex): ${buf.subarray(0, 8).toString('hex')}`);
  
  // Check if gzipped (1f 8b)
  let text = '';
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    console.log('File is GZIP compressed!');
    const decompressed = zlib.gunzipSync(buf);
    text = decompressed.toString('utf8');
    console.log(`Decompressed size: ${decompressed.length} bytes`);
  } else {
    text = buf.toString('utf8');
  }
  console.log('First 500 chars of PRFPSET:');
  console.log(text.slice(0, 500));
}

console.log('\n--- GENUINE MOGRT INSPECTION ---');
if (fs.existsSync(genuineMogrt)) {
  const buf = fs.readFileSync(genuineMogrt);
  console.log(`Size: ${buf.length} bytes`);
  console.log(`Magic bytes (hex): ${buf.subarray(0, 4).toString('hex')} (ascii: ${buf.subarray(0, 4).toString()})`);
  
  // Let's inspect zip entries
  // Look for central directory or filenames inside the ZIP buffer
  const str = buf.toString('latin1');
  const files = [];
  let idx = 0;
  while ((idx = str.indexOf('PK\x01\x02', idx)) !== -1) {
    const fnLen = buf.readUInt16LE(idx + 28);
    const fn = buf.subarray(idx + 46, idx + 46 + fnLen).toString('utf8');
    files.push(fn);
    idx += 46 + fnLen;
  }
  console.log('Internal entries inside genuine MOGRT:', files);
}
