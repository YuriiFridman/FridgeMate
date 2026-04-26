import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const JS_BUDGET_BYTES = 550 * 1024;
const CSS_BUDGET_BYTES = 120 * 1024;

async function collectFilesRecursive(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return collectFilesRecursive(fullPath);
      return [fullPath];
    }),
  );
  return files.flat();
}

async function sumByExt(dir, extension) {
  const files = await collectFilesRecursive(dir);
  const matching = files.filter((file) => file.endsWith(extension));
  let total = 0;
  for (const file of matching) {
    const fileStat = await stat(file);
    total += fileStat.size;
  }
  return total;
}

const staticDir = join(process.cwd(), "dist");
const jsBytes = await sumByExt(staticDir, ".js");
const cssBytes = await sumByExt(staticDir, ".css");

if (jsBytes > JS_BUDGET_BYTES) {
  throw new Error(
    `Web budget failed: JS bundle is ${jsBytes} bytes (limit ${JS_BUDGET_BYTES}).`,
  );
}
if (cssBytes > CSS_BUDGET_BYTES) {
  throw new Error(
    `Web budget failed: CSS bundle is ${cssBytes} bytes (limit ${CSS_BUDGET_BYTES}).`,
  );
}

console.log(
  `Web budget passed. JS=${jsBytes} bytes, CSS=${cssBytes} bytes.`,
);
