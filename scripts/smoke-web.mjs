import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function exists(path) {
  try {
    await readFile(path, "utf8");
    return true;
  } catch {
    return false;
  }
}

const distDir = join(process.cwd(), "dist");
const indexPath = join(distDir, "index.html");

if (!(await exists(indexPath))) {
  throw new Error("Smoke failed: dist/index.html not found. Run `npm run web:build` first.");
}

const indexContent = await readFile(indexPath, "utf8");
if (!indexContent.includes("<div id=\"root\">")) {
  throw new Error("Smoke failed: root app container is missing in index.html.");
}

console.log("Smoke web check passed.");
