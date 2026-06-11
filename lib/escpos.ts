import net from "node:net";
import { formatPrice } from "@/lib/pricing";

// Shared low-level ESC/POS helpers + raw TCP transport for the local Epson TM-m30 / M335A
// receipt printer. Extracted from the kitchen print route so the kitchen ticket and the
// daily report print through the exact same, already-proven socket path.
//
// ESC/POS over a raw TCP socket (port 9100). Override with PRINTER_IP / PRINTER_PORT.
export const printerHost = process.env.PRINTER_IP?.trim() || "192.168.1.172";
export const printerPort = Number(process.env.PRINTER_PORT) || 9100;
// 80mm thermal paper fits 48 Font-A columns; use the full width so the ticket fills the paper.
export const lineWidth = 48;

export const printerLabel = `Epson TCP ${printerHost}:${printerPort}`;

// Strip non-ASCII, collapse whitespace.
export function text(value: unknown) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function wrapLine(value: string, width = lineWidth) {
  const words = text(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function moneyLine(label: string, value: number) {
  const left = text(label);
  const right = formatPrice(value);
  return `${left}${" ".repeat(Math.max(1, lineWidth - left.length - right.length))}${right}`;
}

// ESC/POS control sequences. Character size is GS ! n where the high nibble is the
// width multiplier and the low nibble the height multiplier (0 = 1x, 1 = 2x).
const ESC = 0x1b;
const GS = 0x1d;
export const cmd = {
  init: Buffer.from([ESC, 0x40]),
  alignLeft: Buffer.from([ESC, 0x61, 0x00]),
  alignCenter: Buffer.from([ESC, 0x61, 0x01]),
  boldOn: Buffer.from([ESC, 0x45, 0x01]),
  boldOff: Buffer.from([ESC, 0x45, 0x00]),
  sizeNormal: Buffer.from([GS, 0x21, 0x00]),
  sizeTall: Buffer.from([GS, 0x21, 0x01]), // Double height (same width, so 48 cols still fit).
  sizeLarge: Buffer.from([GS, 0x21, 0x11]), // Double height + double width.
  cut: Buffer.from([GS, 0x56, 0x42, 0x00]) // Partial cut.
};

export function feed(lines: number) {
  return Buffer.from([ESC, 0x64, Math.max(0, lines)]); // ESC d n: print and feed n lines.
}

export function sendToPrinter(payload: Buffer) {
  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: printerHost, port: printerPort });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Printer connection timed out."));
    }, 6000);

    socket.once("connect", () => {
      socket.write(payload, (error) => {
        if (error) {
          clearTimeout(timeout);
          socket.destroy();
          reject(error);
          return;
        }
        socket.end();
      });
    });
    socket.once("close", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
