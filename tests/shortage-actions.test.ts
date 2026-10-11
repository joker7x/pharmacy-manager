import { describe, expect, it } from "vitest";

import type { ReorderRecord } from "../lib/pharmacy-context";
import { clearShortageUnavailable, commitSupplierOrder, logShortage, markShortageUnavailable, receiveShortages } from "../lib/shortage-actions";

const open: ReorderRecord = { medicationId: "med-1", markedAt: "2026-10-01T09:00:00.000Z", quantityAtMark: 0, manual: true, status: "needed", desiredQuantity: 12, demandCount: 1 };
const orderedOld: ReorderRecord = { medicationId: "med-2", markedAt: "2026-09-10T09:00:00.000Z", quantityAtMark: 0, manual: true, status: "ordered", desiredQuantity: 10, orderedAt: "2026-09-10T10:00:00.000Z" };
const orderedNew: ReorderRecord = { medicationId: "med-2", markedAt: "2026-09-20T09:00:00.000Z", quantityAtMark: 0, manual: true, status: "ordered", desiredQuantity: 10, orderedAt: "2026-09-20T10:00:00.000Z" };

describe("قواعد النواقص وطلبيات الموردين", () => {
  it("ينشئ سجلًا جديدًا عندما لا يوجد صنف مفتوح", () => {
    const { records, merged } = logShortage([], { medicationId: "med-9", qty: 6, at: "2026-10-05T09:00:00.000Z", baselineQuantity: 0, urgent: true });
    expect(merged).toBe(false);
    expect(records[0]).toMatchObject({ medicationId: "med-9", desiredQuantity: 6, status: "needed", urgent: true });
  });

  it("يدمج في الصنف المفتوح بدل التكرار، ويحتفظ بتاريخ الطلب الأصلي", () => {
    const { records, merged } = logShortage([open], { medicationId: "med-1", qty: 6, at: "2026-10-05T09:00:00.000Z", baselineQuantity: 0, urgent: true });
    expect(merged).toBe(true);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ desiredQuantity: 18, markedAt: open.markedAt, urgent: true, demandCount: 2 });
  });

  it("لا يدمج في صنف محوّل بالفعل لمورد، ويستبدل سجله", () => {
    const ordered: ReorderRecord = { ...open, status: "ordered" };
    const { records, merged } = logShortage([ordered], { medicationId: "med-1", qty: 3, at: "2026-10-05T09:00:00.000Z", baselineQuantity: 0 });
    expect(merged).toBe(false);
    expect(records).toHaveLength(1);
    expect(records[0].desiredQuantity).toBe(3);
  });

  it("رفض المورد ينقل الصنف لـ«من غير مورد» مع إبقائه مفتوحًا", () => {
    const withSupplier: ReorderRecord = { ...open, supplierName: "النور" };
    const next = markShortageUnavailable([withSupplier], "med-1", "النور");
    expect(next[0]).toMatchObject({ status: "needed", supplierName: undefined, unavailableSuppliers: ["النور"] });
    expect(clearShortageUnavailable(next, "med-1", "النور")[0].unavailableSuppliers).toBeUndefined();
  });

  it("إنهاء المكالمة يحوّل المشطوب إلى ordered ويترك الباقي", () => {
    const second: ReorderRecord = { ...open, medicationId: "med-3" };
    const { records, changed } = commitSupplierOrder([open, second], { supplier: "الدلتا", orderedIds: ["med-1"], unavailableIds: [], at: "2026-10-05T12:00:00.000Z" });
    expect(changed).toBe(1);
    expect(records.find((record) => record.medicationId === "med-1")).toMatchObject({ status: "ordered", supplierName: "الدلتا", orderedAt: "2026-10-05T12:00:00.000Z" });
    expect(records.find((record) => record.medicationId === "med-3")?.status).toBe("needed");
  });

  it("الاستلام بالأقدم أولًا ويدعم الجزئي", () => {
    const { records, received, partial } = receiveShortages([orderedNew, orderedOld], [{ medicationId: "med-2", qty: 14 }], "2026-10-05T12:00:00.000Z");
    expect(received).toBe(1);
    expect(partial).toBe(1);
    const older = records.find((record) => record.orderedAt === orderedOld.orderedAt);
    const newer = records.find((record) => record.orderedAt === orderedNew.orderedAt);
    expect(older).toMatchObject({ status: "received", receivedQty: 10, receivedAt: "2026-10-05T12:00:00.000Z" });
    expect(newer).toMatchObject({ status: "ordered", receivedQty: 4 });
  });
});
