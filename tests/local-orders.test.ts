import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock("expo-file-system", () => ({ File: class { delete() {} } }));
vi.mock("expo-sqlite", () => ({ openDatabaseAsync: vi.fn() }));

import { calculateOrderTotal, formatExpiryMonthYear, getExpiryBatches, getNearestExpiryDate, getUnitPrice, getUnitsPerPackage, normalizePharmacyState, type CartItem, type IncomingOrder } from "../lib/pharmacy-context";

describe("إدارة بيانات الطلبيات المحلية", () => {
  it("تضيف قائمة طلبيات فارغة للبيانات المحفوظة من الإصدارات السابقة", () => {
    const state = normalizePharmacyState({ medications: [], sales: [], suppliers: [] });
    expect(state.incomingOrders).toEqual([]);
  });

  it("تحافظ على بيانات طلب وارد وفاتورته عند استرجاع الحالة", () => {
    const order: IncomingOrder = {
      id: "order-test",
      supplierName: "شركة الدواء",
      sourceType: "شركة",
      referenceNumber: "INV-42",
      total: 1250,
      invoiceUri: "file:///invoices/invoice-42.jpg",
      createdAt: "2026-08-24T12:00:00.000Z",
    };
    const state = normalizePharmacyState({ medications: [], sales: [], suppliers: [], incomingOrders: [order] });
    expect(state.incomingOrders).toEqual([{ ...order, status: "قيد الانتظار" }]);
  });

  it("يحسب إجمالي عناصر الطلب بدقة", () => {
    const items: CartItem[] = [
      { medicationId: "med-1", name: "صنف أول", unitPrice: 75, quantity: 2 },
      { medicationId: "med-2", name: "صنف ثان", unitPrice: 40, quantity: 3 },
    ];
    expect(calculateOrderTotal(items)).toBe(270);
  });

  it("يحسب سعر وحدة البيع من سعر العبوة وعدد وحداتها", () => {
    expect(getUnitsPerPackage({ unitsPerPackage: 2 })).toBe(2);
    expect(getUnitPrice({ price: 96, unitsPerPackage: 2 })).toBe(48);
  });

  it("يرتب سجل دفعات الصلاحية ويعتمد أقرب تاريخ للصنف", () => {
    const medication = { expiryDate: "2027-10-01", quantity: 12, expiryBatches: [{ id: "later", expiryDate: "2027-10-01", quantity: 7, receivedAt: "2026-08-01" }, { id: "nearer", expiryDate: "2027-06-01", quantity: 5, receivedAt: "2026-08-02" }] };
    expect(getExpiryBatches(medication).map((batch) => batch.expiryDate)).toEqual(["2027-06-01", "2027-10-01"]);
    expect(getNearestExpiryDate(medication)).toBe("2027-06-01");
    expect(formatExpiryMonthYear("2029-08-27")).toBe("8/2029");
  });
});
