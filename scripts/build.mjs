import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const source=readFileSync("index.html","utf8");
for(const path of ["./styles.css","./app.js"]){if(!source.includes(path))throw Error("Missing application reference: "+path);}
mkdirSync("dist",{recursive:true});
for(const file of ["index.html","styles.css","app.js"]) copyFileSync(resolve(file),resolve("dist",file));
console.log("Built static ThryveMS console preview in dist/");
