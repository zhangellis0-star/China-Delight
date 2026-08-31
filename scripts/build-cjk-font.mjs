// Dev-only maintenance script — NOT run during `npm run build` or CI.
//
// Regenerates lib/cjk-font-data.ts: a base64-embedded, subsetted Simplified Chinese font
// containing only the glyphs actually used by data/menu.ts `chineseName` fields (kitchen tickets
// rasterize these with lib/cjk-render.ts). Run this manually after adding menu items whose
// chineseName introduces a character not already covered.
//
// Usage: node scripts/build-cjk-font.mjs
//
// Requires network access (downloads the Noto Sans SC variable font from Google Fonts on GitHub)
// and the `subset-font` package (devDependency).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const menuPath = path.join(rootDir, "data/menu.ts");
const outPath = path.join(rootDir, "lib/cjk-font-data.ts");
const fontUrl = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf";

function extractChineseCharacters(menuSource) {
  const matches = menuSource.match(/chineseName:\s*"([^"]*)"/g) ?? [];
  const chars = new Set();
  for (const match of matches) {
    const zh = match.match(/chineseName:\s*"([^"]*)"/)[1];
    for (const ch of zh) chars.add(ch);
  }
  return Array.from(chars).sort().join("");
}

async function main() {
  const menuSource = fs.readFileSync(menuPath, "utf8");
  const chineseChars = extractChineseCharacters(menuSource);
  if (!chineseChars) throw new Error("No chineseName values found in data/menu.ts — nothing to subset.");
  console.log(`Found ${chineseChars.length} unique Chinese characters in data/menu.ts.`);

  console.log(`Downloading Noto Sans SC from ${fontUrl} ...`);
  const response = await fetch(fontUrl);
  if (!response.ok) throw new Error(`Font download failed: HTTP ${response.status}`);
  const fullFont = Buffer.from(await response.arrayBuffer());
  console.log(`Downloaded ${fullFont.length} bytes.`);

  // Digits/basic punctuation are included defensively even though item names print via ESC/POS
  // text, not this font — cheap to keep and avoids surprises if a translation ever includes them.
  const text = chineseChars + "0123456789().,%-&/ ";
  const subset = await subsetFont(fullFont, text, {
    targetFormat: "sfnt",
    variationAxes: { wght: 700 }
  });
  console.log(`Subset to ${subset.length} bytes.`);

  const b64 = subset.toString("base64");
  const header = [
    "// Subsetted Noto Sans SC (Bold), OFL-1.1 licensed, containing only the CJK characters used by",
    "// data/menu.ts chineseName fields (+ digits/basic punctuation). Regenerate with",
    "// scripts/build-cjk-font.mjs if menu translations change. Kept as a base64 string (not a static",
    "// asset file) so it is guaranteed to be bundled into the serverless function — no reliance on",
    "// Next.js/Vercel file tracing for a binary asset outside the standard build graph.",
    "export const CJK_MENU_FONT_BASE64 ="
  ].join("\n");
  const chunkSize = 200;
  const chunks = [];
  for (let i = 0; i < b64.length; i += chunkSize) chunks.push(`  "${b64.slice(i, i + chunkSize)}"`);
  const body = `${chunks.join(" +\n")};\n`;
  fs.writeFileSync(outPath, `${header}\n${body}`);
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
