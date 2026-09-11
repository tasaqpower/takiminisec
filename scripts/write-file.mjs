import fs from "node:fs";
import path from "node:path";
const [,,target,b64] = process.argv;
if(!target||!b64) process.exit(1);
const p = path.resolve(target);
fs.mkdirSync(path.dirname(p),{recursive:true});
fs.writeFileSync(p,Buffer.from(b64,"base64"));
console.log("Wrote " + target);