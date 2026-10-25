import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { ICON_NAMES } from "../src/icons.js";
import { join, resolve } from "node:path";
/** Copies the static preview (no bundler, no dependencies) to dist/ after checking references. */
const source = readFileSync("index.html", "utf8");
for (const path of ["./styles.css", "./src/main.js"]) if (!source.includes(path)) throw Error("Missing application reference: " + path);
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk("src");
// Guard: no secrets or live endpoints in the preview bundle.
for (const f of files) {
  const text = readFileSync(f, "utf8");
  if (/(api[_-]?key|secret[_-]?key|BEGIN [A-Z ]*PRIVATE KEY|sk_live_|pk_live_)/i.test(text)) throw Error("Possible secret in " + f);
  if (/fetch\(|XMLHttpRequest|WebSocket\(/.test(text)) throw Error("Network call found in " + f + ": the preview must not call any service");
}
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
for (const file of ["index.html", "styles.css"]) cpSync(resolve(file), resolve("dist", file));
cpSync(resolve("src"), resolve("dist", "src"), { recursive: true });
cpSync(resolve("assets"), resolve("dist", "assets"), { recursive: true });
// Use the exact Public Sans font family from the canonical ThryveMS frontend.
mkdirSync(resolve("dist", "fonts"), { recursive: true });
for (const weight of [400, 500, 600, 700]) {
  const name = "public-sans-latin-" + weight + "-normal.woff2";
  const input = resolve("node_modules", "@fontsource", "public-sans", "files", name);
  if (!existsSync(input)) throw Error("Public Sans font asset missing: " + name);
  cpSync(input, resolve("dist", "fonts", name));
}
// Generate only the Lucide glyphs used by this product (no icon font / full sprite).
const symbols = ICON_NAMES.map((name) => {
  const source = resolve("node_modules", "lucide-static", "icons", name + ".svg");
  if (!existsSync(source)) throw Error("Missing pinned Lucide icon: " + name);
  const match = readFileSync(source, "utf8").match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/);
  if (!match) throw Error("Invalid Lucide SVG: " + name);
  return '<symbol id="' + name + '" viewBox="0 0 24 24">' + match[1] + '</symbol>';
});
writeFileSync(resolve("dist", "icons.svg"), '<svg xmlns="http://www.w3.org/2000/svg">' + symbols.join("") + '</svg>');

console.log("Built static ThryveMS console preview in dist/ (" + files.length + " modules, " + ICON_NAMES.length + " Lucide icons)");
