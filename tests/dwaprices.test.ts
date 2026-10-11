import { describe, expect, it } from "vitest";

import { extractProductList, keepSourceOrder, normalizeDwapriceProduct } from "../server/dwaprices";
import { normalizeDrugListLine, normalizeDrugListRecord } from "../server/druglist";

describe("تطبيع بيانات dwaprices", () => {
  it("يستخرج قائمة أصناف سواء وصلت مباشرة أو داخل كائن", () => {
    expect(extractProductList([{ id: "1" }])).toEqual([{ id: "1" }]);
    expect(extractProductList({ products: [{ id: "2" }] })).toEqual([{ id: "2" }]);
  });

  it("يحوّل بيانات الصنف إلى نموذج الفهرس مع السعر القديم والجديد", () => {
    expect(normalizeDwapriceProduct({ id: "42", name: "sample", arabic: "صنف تجريبي", price: "120", oldprice: "99", sold_times: "8", Date_updated: "1787601957" })).toEqual(expect.objectContaining({ externalId: "42", arabicName: "صنف تجريبي", currentPrice: "120.00", previousPrice: "99.00", soldTimes: 8, sourceUpdatedAt: 1787601957000 }));
  });

  it("يرفض السجل الناقص الذي لا يمكن عرضه أو تسعيره", () => {
    expect(normalizeDwapriceProduct({ id: "", name: "", price: "" })).toBeNull();
  });

  it("يتعامل مع السعر السابق الفارغ بوصفه غير متاح لا صفرًا", () => {
    expect(normalizeDwapriceProduct({ id: "7", name: "sample", arabic: "صنف", price: "120", oldprice: "", sold_times: "1", Date_updated: "1787601957" })).toEqual(expect.objectContaining({ previousPrice: null }));
  });

  it("يحافظ على ترتيب endpoint ويزيل تكرار الصنف بين الدفعات", () => {
    expect(keepSourceOrder([{ externalId: "new" }, { externalId: "same" }, { externalId: "same" }, { externalId: "old" }]).map((item) => item.externalId)).toEqual(["new", "same", "old"]);
  });

  it("يحوّل سطر ملف الأدوية إلى بيانات كاملة قابلة للفهرسة", () => {
    const line = "42,English drug,دواء عربي,10,15,active,upload/pic.png,category,company,tablet,1,6221000000010,oral.solid,وصف الدواء,88,1780000000,0";
    expect(normalizeDrugListLine(line)).toEqual(expect.objectContaining({ externalId: "42", arabicName: "دواء عربي", currentPrice: "15.00", previousPrice: "10.00", category: "category", company: "company", unitsPerPackage: 1, barcode: "6221000000010", soldTimes: 88, sourceUpdatedAt: 1780000000000 }));
  });

  it("يتجاوز السطر غير الصالح من ملف الأدوية", () => {
    expect(normalizeDrugListLine("invalid,,")).toBeNull();
  });

  it("يحفظ الوصف المقتبس الذي يحتوي فواصل عند تمرير سجل CSV محلل", () => {
    const record = ["43", "English drug", "دواء عربي", "", "15", "active", "", "category", "company", "tablet", "1", "", "oral.solid", "وصف، يحتوي، فواصل", "12", "1780000000"];
    expect(normalizeDrugListRecord(record)).toEqual(expect.objectContaining({ description: "وصف، يحتوي، فواصل", soldTimes: 12 }));
  });
});
