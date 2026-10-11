import { describe, expect, it } from "vitest";
import { mergeLatestPriceItems, type LatestPriceItem } from "../lib/latest-price-cache-types";

const item = (externalId: string, sourceUpdatedAt: number): LatestPriceItem => ({
  externalId,
  name: externalId,
  arabicName: externalId,
  currentPrice: "10.00",
  previousPrice: "9.00",
  soldTimes: 0,
  activeIngredient: null,
  category: null,
  company: null,
  barcode: null,
  sourceUpdatedAt,
});

describe("دمج ذاكرة أحدث الأسعار", () => {
  it("يضع الوارد من المصدر أولًا ويمنع تكرار الصنف", () => {
    const merged = mergeLatestPriceItems([item("new", 30), item("same", 20)], [item("same", 10), item("old", 5)]);
    expect(merged.map((value) => value.externalId)).toEqual(["new", "same", "old"]);
    expect(merged[1]?.sourceUpdatedAt).toBe(20);
  });

  it("يبقي أول ألف صنف فقط عند تجاوز الحد", () => {
    const source = Array.from({ length: 1002 }, (_, index) => item(String(index), 1002 - index));
    expect(mergeLatestPriceItems(source, []).length).toBe(1000);
  });
});

