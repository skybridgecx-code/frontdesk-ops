import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distRoot = path.resolve(__dirname, "../dist");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function hasExtension(specifier) {
  const last = specifier.split("/").pop() ?? "";
  return /\.[A-Za-z0-9]+$/.test(last);
}

function withJsExtension(fromFile, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return specifier;
  if (hasExtension(specifier)) return specifier;

  const absoluteTarget = path.resolve(path.dirname(fromFile), specifier);
  if (fs.existsSync(`${absoluteTarget}.js`)) return `${specifier}.js`;
  if (fs.existsSync(path.join(absoluteTarget, "index.js"))) return `${specifier}/index.js`;

  return specifier;
}

let changed = 0;

for (const file of walk(distRoot).filter((item) => item.endsWith(".js"))) {
  const before = fs.readFileSync(file, "utf8");

  let after = before.replace(/(\bfrom\s*["\x27])(\.{1,2}\/[^"\x27]+)(["\x27])/g, (_match, prefix, specifier, suffix) => {
    return `${prefix}${withJsExtension(file, specifier)}${suffix}`;
  });

  after = after.replace(/(\bimport\s*\(\s*["\x27])(\.{1,2}\/[^"\x27]+)(["\x27]\s*\))/g, (_match, prefix, specifier, suffix) => {
    return `${prefix}${withJsExtension(file, specifier)}${suffix}`;
  });

  if (after !== before) {
    fs.writeFileSync(file, after);
    changed += 1;
  }
}

console.log(`fixed esm imports in ${changed} compiled domain files`);
