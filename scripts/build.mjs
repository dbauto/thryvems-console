import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
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
console.log("Built static ThryveMS console preview in dist/ (" + files.length + " modules)");
