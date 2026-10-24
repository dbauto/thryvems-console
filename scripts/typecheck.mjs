import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
/** Syntax-checks every module and verifies that every import resolves to an exported name. */
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = [...walk("src"), ...walk("tests"), ...walk("scripts"), "playwright.config.mjs"].filter((f) => /\.m?js$/.test(f));
for (const f of files) execFileSync(process.execPath, ["--check", f], { stdio: "inherit" });
// Linking check: import every src module in Node with a minimal DOM stub so missing exports fail here.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
for (const f of walk("src").filter((x) => !x.endsWith("main.js"))) await import("../" + f.replace(/\\/g, "/"));
console.log("Typecheck passed: " + files.length + " files parsed, src modules linked.");
