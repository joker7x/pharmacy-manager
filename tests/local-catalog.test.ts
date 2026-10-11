import { describe, expect, it } from "vitest";

import { getLocalCatalog, localCatalogStatus, localGetProduct, localSearchProducts, normalizeSearchText } from "../server/local-catalog";

describe("دليل الأصناف المحلي المبني من druglist.csv", () => {
  it("يوحّد نصوص البحث العربية والأرقام", () => {
    expect(normalizeSearchText("بانادول® ٥٠٠")).toBe("بانادول 500");
    expect(normalizeSearchText("أوجمنتين")).toBe(normalizeSearchText("اوجمنتين"));
  });

  it("يحمّل الملف كاملاً ويبلّغ عن حالته", async () => {
    const status = await localCatalogStatus();
    expect(status.productCount).toBeGreaterThan(25_000);
    expect(status.isComplete).toBe(true);
    expect(status.lastError).toBeNull();
  }, 30_000);

  it("يجد الصنف بالاسم العربي والمعرف والباركود", async () => {
    const byName = await localSearchProducts("بانادول", 5, 0);
    expect(byName.total).toBeGreaterThan(0);
    expect(byName.items.length).toBeGreaterThan(0);
    expect(byName.items[0].arabicName).toContain("بانادول");

    // الأسماء المنقولة: الكتابة بدون ألف تجلب نفس الأصناف.
    const byLooseName = await localSearchProducts("بنادول", 20, 0);
    expect(byLooseName.items.some((product) => product.arabicName.includes("بانادول"))).toBe(true);

    expect((await localGetProduct("25205"))?.arabicName).toContain("بريتيير");
    const byBarcode = await localSearchProducts("6224003574106", 5, 0);
    expect(byBarcode.items[0].externalId).toBe("2510");
  }, 30_000);

  it("يدمج أسعار المصدر الحيّ فوق صنف الملف نفس المعرف", async () => {
    const catalog = await getLocalCatalog();
    const before = catalog.get("25205")!;
    catalog.record([{ ...before, syncedAt: new Date(before.syncedAt), currentPrice: "999.00", previousPrice: before.currentPrice, sourceUpdatedAt: before.sourceUpdatedAt + 1000 }]);
    const after = catalog.get("25205")!;
    expect(after.currentPrice).toBe("999.00");
    expect(after.previousPrice).toBe(before.currentPrice);
    expect(after.arabicName).toBe(before.arabicName);
  }, 30_000);
});
