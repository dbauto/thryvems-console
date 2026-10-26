/** Writes icons.svg at the repo root (GitHub Pages serves the repo root, not dist/). Usage: node scripts/sprite.mjs [lucide icons dir] */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ICON_NAMES } from "../src/icons.js";
const dir = process.argv[2] || resolve("node_modules", "lucide-static", "icons");
const symbols = ICON_NAMES.map((name) => {
  const file = resolve(dir, name + ".svg");
  if (!existsSync(file)) throw Error("Missing Lucide icon: " + name);
  const m = readFileSync(file, "utf8").match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/);
  return '<symbol id="' + name + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + m[1].trim() + "</symbol>";
});
writeFileSync("icons.svg", '<svg xmlns="http://www.w3.org/2000/svg">' + symbols.join("") + "</svg>\n");
console.log("icons.svg: " + ICON_NAMES.length + " icons");
