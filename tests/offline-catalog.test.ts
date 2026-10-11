import { describe, expect, it } from "vitest";

import { normalizeCatalogText, parseOfflineRow } from "../lib/offline-catalog";

describe("البحث في الدليل المحفوظ داخل الجهاز", () => {
  it("يسوّي النص مثل فهرس البناء: تشكيل وألف وياء وتاء مربوطة وأرقام عربية", () => {
    // بنادول/بانادول بتتطابق عبر المفتاح المرن (حذف الألف)، مش بالتسوية نفسها.
    expect(normalizeCatalogText("بنادول").replace(/ا/g, "")).toBe(normalizeCatalogText("بانادول").replace(/ا/g, ""));
    expect(normalizeCatalogText("أوجمنتين™")).toContain("اوجمنتين");
    expect(normalizeCatalogText("١٢٣ قرصًا")).toBe("123 قرصا");
  });

  it("يفكّ سطر الصنف إلى نفس حقول السيرفر", () => {
    const item = parseOfflineRow("1737|بنادول اكسترا|Panadol Extra|gsk|pain|116.00|6222010611487|4");
    expect(item).toMatchObject({
      externalId: "1737",
      arabicName: "بنادول اكسترا",
      name: "Panadol Extra",
      company: "gsk",
      category: "pain",
      currentPrice: "116.00",
      barcode: "6222010611487",
      unitsPerPackage: 4,
    });
  });

  it("يتجاهل الأسطر الناقصة بدل أن يفشل", () => {
    expect(parseOfflineRow("only-one-field")).toBeNull();
    expect(parseOfflineRow("||name|||")).toBeNull();
  });
});
