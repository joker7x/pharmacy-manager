import type { LabelPrintData, LabelPosition, PrinterSettings, ReceiptPrintData } from "./printer-types";

const encoder = new TextEncoder();
const bytes = (value: string) => Array.from(encoder.encode(value));
const concat = (...parts: number[][]) => parts.flat();
const line = (value = "") => concat(bytes(value), [0x0a]);
const money = (value: number) => `${value.toFixed(2)} ج.م`;

export function buildEscPosReceipt(data: ReceiptPrintData) {
  const output: number[] = [0x1b, 0x40, 0x1b, 0x61, 0x01];
  output.push(...line("صيدليتي"), ...line(`فاتورة ${data.receiptNumber}`), ...line(new Date(data.createdAt).toLocaleString("ar-EG")), ...line("------------------------------"));
  data.items.forEach((item) => output.push(...line(`${item.name} x${item.quantity}  ${money(item.unitPrice * item.quantity)}`)));
  output.push(...line("------------------------------"), ...line(`الإجمالي: ${money(data.total)}`), ...line(`الدفع: ${data.paymentMethod}`));
  if (data.cashReceived !== undefined) output.push(...line(`المدفوع: ${money(data.cashReceived)}`), ...line(`الباقي: ${money(data.change ?? 0)}`));
  output.push(...line("شكرًا لزيارتكم"), 0x1b, 0x64, 0x04, 0x1d, 0x56, 0x00);
  return Uint8Array.from(output);
}

function spaces(percent: number) { return " ".repeat(Math.max(0, Math.min(24, Math.round(percent / 4)))); }
function rows(percent: number) { return Math.max(0, Math.min(12, Math.round(percent / 8))); }
function barcode(value: string) {
  const data = bytes(value);
  return [0x1d, 0x48, 0x02, 0x1d, 0x77, 0x02, 0x1d, 0x68, 0x40, 0x1d, 0x6b, 0x49, data.length, ...data, 0x0a];
}

/**
 * Emits real ESC/POS text and GS k barcode commands. ESC/POS printers do not
 * have a universal x/y canvas, so the saved drag positions are quantized to
 * columns and rows while preserving their visual order on the label.
 */
export function buildEscPosLabel(settings: PrinterSettings, data: LabelPrintData) {
  const ordered = settings.labelElements.map((element) => ({ element, position: settings.labelPositions[element] })).sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const output: number[] = [0x1b, 0x40, 0x1b, 0x33, 0x18, 0x1b, 0x61, 0x00];
  let currentRow = 0;
  ordered.forEach(({ element, position }) => {
    const targetRow = rows(position.y);
    output.push(...Array.from({ length: Math.max(0, targetRow - currentRow) }, () => 0x0a));
    currentRow = targetRow;
    output.push(...bytes(spaces(position.x)));
    if (element === "barcode") output.push(...barcode(data.barcode));
    else if (element === "name") output.push(...line(data.name));
    else if (element === "price") output.push(...line(money(data.price)));
    else output.push(...line(`صالح حتى ${data.expiryMonthYear}`));
    currentRow += 1;
  });
  output.push(0x1b, 0x32, 0x1b, 0x64, 0x03, 0x1d, 0x56, 0x00);
  return Uint8Array.from(output);
}
