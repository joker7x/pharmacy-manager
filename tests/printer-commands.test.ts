import { describe, expect, it } from "vitest";
import { buildEscPosLabel, buildEscPosReceipt } from "../lib/printer-commands";
import { DEFAULT_PRINTER_SETTINGS } from "../lib/printer-types";

describe("أوامر طابعة USB ESC/POS", () => {
  it("ينشئ إيصالًا خامًا يبدأ بالتهيئة ويحتوي الإجمالي", () => {
    const command = buildEscPosReceipt({ receiptNumber: "42", createdAt: "2026-08-30T09:00:00.000Z", items: [{ name: "Panadol", quantity: 2, unitPrice: 20 }], total: 40, paymentMethod: "نقدي", cashReceived: 50, change: 10 });
    expect(command[0]).toBe(0x1b);
    expect(command[1]).toBe(0x40);
    expect(new TextDecoder().decode(command)).toContain("الإجمالي");
  });

  it("يصدر أمر GS-k للباركود ويحترم قالب المواضع", () => {
    const command = buildEscPosLabel({ ...DEFAULT_PRINTER_SETTINGS, labelElements: ["name", "barcode", "price"], labelPositions: { ...DEFAULT_PRINTER_SETTINGS.labelPositions, name: { x: 10, y: 5 }, barcode: { x: 20, y: 40 }, price: { x: 10, y: 80 } } }, { name: "Panadol", barcode: "6221234567890", price: 30, expiryMonthYear: "8/2029" });
    expect(Array.from(command)).toContain(0x1d);
    expect(Array.from(command)).toContain(0x6b);
    expect(new TextDecoder().decode(command)).toContain("Panadol");
  });
});
