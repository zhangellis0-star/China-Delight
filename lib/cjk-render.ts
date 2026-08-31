import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { CJK_MENU_FONT_BASE64 } from "@/lib/cjk-font-data";
import { printWidthDots, rasterImageCommand } from "@/lib/escpos";

// The Epson TM-m30 sold for the US market has no built-in Chinese font, so ESC/POS Kanji-mode
// text commands would print boxes/garbage. Rasterizing the Chinese line as a bitmap image
// guarantees correct rendering on any ESC/POS-compliant printer regardless of its built-in font
// support (see lib/escpos.ts rasterImageCommand).
const FONT_FAMILY = "ChinaDelightMenuCJK";
const FONT_SIZE_PX = 34;
const CANVAS_HEIGHT_PX = 44;
const TOP_PADDING_PX = 4;

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  GlobalFonts.register(Buffer.from(CJK_MENU_FONT_BASE64, "base64"), FONT_FAMILY);
  fontRegistered = true;
}

// Renders `chineseText` to a monochrome ESC/POS raster-image command sized to fit the text
// (capped at the printer's paper width). Returns null for blank input or a font/canvas failure —
// callers should treat that as "no Chinese name available" and print the English name alone.
export function rasterizeChineseLine(chineseText: string | undefined | null): Buffer | null {
  const trimmed = (chineseText ?? "").trim();
  if (!trimmed) return null;

  try {
    ensureFontRegistered();
    const measureCanvas = createCanvas(printWidthDots, CANVAS_HEIGHT_PX);
    const measureCtx = measureCanvas.getContext("2d");
    measureCtx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    const measuredWidth = Math.ceil(measureCtx.measureText(trimmed).width);
    const widthPx = Math.min(printWidthDots, Math.max(1, measuredWidth + 4));

    const canvas = createCanvas(widthPx, CANVAS_HEIGHT_PX);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, widthPx, CANVAS_HEIGHT_PX);
    ctx.fillStyle = "black";
    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    ctx.textBaseline = "top";
    ctx.fillText(trimmed, 0, TOP_PADDING_PX);

    const imageData = ctx.getImageData(0, 0, widthPx, CANVAS_HEIGHT_PX);
    const bitmap = new Uint8Array(widthPx * CANVAS_HEIGHT_PX);
    let hasInk = false;
    for (let i = 0; i < bitmap.length; i++) {
      const isDark = imageData.data[i * 4] < 128;
      bitmap[i] = isDark ? 1 : 0;
      if (isDark) hasInk = true;
    }
    // A font/glyph failure renders nothing (all-white canvas) rather than throwing — treat that
    // the same as a missing translation instead of sending a blank strip to the printer.
    if (!hasInk) return null;

    return rasterImageCommand(bitmap, widthPx, CANVAS_HEIGHT_PX);
  } catch {
    return null;
  }
}
