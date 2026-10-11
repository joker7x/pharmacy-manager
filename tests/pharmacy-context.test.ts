import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock("expo-file-system", () => ({ File: class { delete() {} } }));
vi.mock("expo-sqlite", () => ({ openDatabaseAsync: vi.fn() }));

import { buildAlerts, buildReorderNeeds, calculateCashChange, calculateExpectedShiftCash, calculateOrderTotal, type Medication, type ReorderRecord } from "../lib/pharmacy-context";

const medication = (overrides: Partial<Medication> = {}): Medication => ({
  id: "med-1",
  name: "دواء تجريبي",
  category: "اختبار",
  sku: "TEST-1",
  price: 50,
  quantity: 20,
  reorderLevel: 5,
  expiryDate: "2030-01-01",
  ...overrides,
});

describe("حسابات الصيدلية", () => {
  it("يجمع إجمالي الفاتورة وفق الكمية وسعر الوحدة", () => {
    expect(calculateOrderTotal([
      { medicationId: "a", name: "أ", unitPrice: 50, quantity: 2 },
      { medicationId: "b", name: "ب", unitPrice: 15, quantity: 3 },
    ])).toBe(145);
  });

  it("يحسب باقي الدفع النقدي ولا يسمح بقيمة سالبة", () => {
    expect(calculateCashChange(145, 200)).toBe(55);
    expect(calculateCashChange(145, 100)).toBe(0);
  });

  it("يخصم مصروفات الشيفت من الرصيد المتوقع في الدرج", () => {
    expect(calculateExpectedShiftCash(2000, 0, 1000)).toBe(1000);
    expect(calculateExpectedShiftCash(2000, 500, 1000)).toBe(1500);
  });

  it("ينشئ تنبيهًا عالي الأولوية عندما يهبط المخزون إلى مستوى حرج", () => {
    const alerts = buildAlerts([medication({ quantity: 2, reorderLevel: 8 })]);
    expect(alerts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "stock", severity: "high" })]));
  });

  it("ينشئ تنبيهًا للصلاحية القريبة", () => {
    const nearExpiry = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const alerts = buildAlerts([medication({ expiryDate: nearExpiry })]);
    expect(alerts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "expiry", severity: "high" })]));
  });

  it("يعرض الصنف الناقص لإعادة الطلب عند هبوطه بعد المبيعات", () => {
    const needs = buildReorderNeeds([medication({ quantity: 4, reorderLevel: 8 })], []);
    expect(needs).toEqual([expect.objectContaining({ status: "needed", resumed: false })]);
  });

  it("يبقي الصنف في انتظار التوريد ثم يعيده للنواقص عند هبوط الكمية مجددًا", () => {
    const record: ReorderRecord = { medicationId: "med-1", quantityAtMark: 5, markedAt: "2026-08-24T12:00:00.000Z" };
    expect(buildReorderNeeds([medication({ quantity: 5, reorderLevel: 8 })], [record])[0]).toEqual(expect.objectContaining({ status: "ordered", resumed: false }));
    expect(buildReorderNeeds([medication({ quantity: 4, reorderLevel: 8 })], [record])[0]).toEqual(expect.objectContaining({ status: "needed", resumed: true }));
  });

  it("يحتفظ ببيانات طلب العميل والمورد والكمية المطلوبة في النواقص", () => {
    const record: ReorderRecord = {
      medicationId: "med-1",
      quantityAtMark: 0,
      markedAt: "2026-08-24T12:00:00.000Z",
      manual: true,
      status: "needed",
      desiredQuantity: 10,
      customerName: "محمد أحمد",
      customerPhone: "01012345678",
      supplierName: "ابن سينا",
      demandCount: 3,
    };
    const needs = buildReorderNeeds([medication({ id: "med-1", quantity: 0, reorderLevel: 5 })], [record]);
    expect(needs[0]).toEqual(expect.objectContaining({
      desiredQuantity: 10,
      customerName: "محمد أحمد",
      customerPhone: "01012345678",
      supplierName: "ابن سينا",
      demandCount: 3,
    }));
  });

  it("يرتب الأصناف الأكثر طلباً من الزبائن أولاً في النواقص", () => {
    const medA = medication({ id: "med-a", name: "دواء أ", quantity: 1, reorderLevel: 5 });
    const medB = medication({ id: "med-b", name: "دواء ب", quantity: 1, reorderLevel: 5 });
    const recordA: ReorderRecord = { medicationId: "med-a", quantityAtMark: 1, markedAt: "2026-08-24T12:00:00.000Z", demandCount: 1 };
    const recordB: ReorderRecord = { medicationId: "med-b", quantityAtMark: 1, markedAt: "2026-08-24T12:00:00.000Z", demandCount: 4 };

    const needs = buildReorderNeeds([medA, medB], [recordA, recordB]);
    expect(needs[0].medication.id).toBe("med-b");
    expect(needs[1].medication.id).toBe("med-a");
  });
});
