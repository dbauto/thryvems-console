import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const source = readFileSync("index.html", "utf8");
for (const path of ["./styles.css", "./app.js"]) if (!source.includes(path)) throw Error("Missing application reference: " + path);
const modules = ["app.js", "ui.js", "data.js", "finance.js"];
mkdirSync("dist/assets", { recursive: true });
for (const file of ["index.html", "styles.css", ...modules]) copyFileSync(resolve(file), resolve("dist", file));
for (const file of readdirSync("assets")) copyFileSync(resolve("assets", file), resolve("dist/assets", file));
console.log("Built static ThryveMS console preview in dist/");
