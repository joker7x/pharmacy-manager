/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { addDaysToKey, getDailyFinance, toLocalDayKey } from "../lib/daily-finance";
import type { Expense, Sale, Shift } from "../lib/pharmacy-context";

const sales: Sale[] = [
  { id: "sale-cash", createdAt: "2026-08-27T08:15:00.000Z", items: [], total: 150, paymentMethod: "نقدي" },
  { id: "sale-vodafone", createdAt: "2026-08-27T09:15:00.000Z", items: [], total: 50, paymentMethod: "فودافون كاش" },
  { id: "sale-card", createdAt: "2026-08-27T12:00:00.000Z", items: [], total: 250, paymentMethod: "بطاقة" },
  { id: "sale-old", createdAt: "2026-08-26T12:00:00.000Z", items: [], total: 999, paymentMethod: "محفظة" },
];
const expenses: Expense[] = [
  { id: "expense-1", title: "كهرباء", category: "تشغيل", amount: 80, createdAt: "2026-08-27T10:00:00.000Z" },
  { id: "expense-old", title: "نقل", category: "أخرى", amount: 40, createdAt: "2026-08-26T10:00:00.000Z" },
];
const shifts: Shift[] = [{ id: "shift-1", pharmacistName: "أحمد", openingCash: 1000, startedAt: "2026-08-27T07:00:00.000Z" }];

describe("المراجعة المالية اليومية", () => {
  it("يجمع المبيعات والمصروفات وطرق الدفع لليوم المطلوب فقط", () => {
    const daily = getDailyFinance("2026-08-27", sales, expenses, shifts);
    expect(daily.salesTotal).toBe(450);
    expect(daily.cashSalesTotal).toBe(150);
    expect(daily.vodafoneCashSalesTotal).toBe(50);
    expect(daily.cardSalesTotal).toBe(250);
    expect(daily.walletSalesTotal).toBe(0);
    expect(daily.expenseTotal).toBe(80);
    expect(daily.netTotal).toBe(370);
    expect(daily.sales).toHaveLength(3);
    expect(daily.expenses).toHaveLength(1);
    expect(daily.shifts).toHaveLength(1);
  });

  it("يحافظ على مفاتيح الأيام المحلية ويتنقل بين الأيام", () => {
    expect(toLocalDayKey(new Date("2026-08-27T12:00:00"))).toBe("2026-08-27");
    expect(addDaysToKey("2026-08-27", -1)).toBe("2026-08-26");
    expect(addDaysToKey("2026-08-27", 1)).toBe("2026-08-28");
  });
});
