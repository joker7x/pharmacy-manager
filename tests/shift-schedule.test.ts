import { describe, expect, it } from "vitest";

import { SHIFT_WINDOWS, canStartShift, formatClock, shiftClock, windowAt } from "../lib/shift-schedule";

const at = (hour: number, minute: number) => new Date(2026, 9, 4, hour, minute, 0, 0);
const startedMorning = at(8, 35).toISOString();

describe("مواعيد الورديات", () => {
  it("يعرّف النافذة الحالية ويرفض الأوقات خارجها", () => {
    expect(windowAt(at(9, 0))?.kind).toBe("morning");
    expect(windowAt(at(20, 0))?.kind).toBe("night");
    expect(windowAt(at(3, 0))).toBeNull();
  });

  it("صيغة المواعيد بالأرقام العربية", () => {
    expect(formatClock(SHIFT_WINDOWS[0].startMinutes)).toBe("٨:٣٠ ص");
    expect(formatClock(SHIFT_WINDOWS[0].endMinutes)).toBe("٤:٣٠ م");
    expect(formatClock(SHIFT_WINDOWS[1].endMinutes)).toBe("١١:٣٠ م");
  });

  it("يمنع بدء شيفت قبل قفل السابق", () => {
    const blocked = canStartShift([{ pharmacistName: "سعيد", startedAt: startedMorning }], at(16, 40));
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toContain("سعيد");
    expect(blocked.reason).toContain("متأخر");
  });

  it("يمنع البدء خارج النوافذ ويسمح داخلها", () => {
    expect(canStartShift([], at(3, 0)).ok).toBe(false);
    const allowed = canStartShift([], at(21, 15));
    expect(allowed.ok).toBe(true);
    expect(allowed.kind).toBe("night");
  });

  it("يحسب حالة الشيفت: مفتوح ثم تذكير ثم تجاوز", () => {
    expect(shiftClock({ startedAt: startedMorning }, at(12, 0))?.status).toBe("open");
    expect(shiftClock({ startedAt: startedMorning }, at(16, 10))?.status).toBe("closing_soon");
    const late = shiftClock({ startedAt: startedMorning }, at(16, 45));
    expect(late?.status).toBe("overdue");
    expect(late?.minutesRemaining).toBeLessThan(0);
  });

  it("الشيفت المقفول لا يُعاد حساب موعد له", () => {
    const closed = shiftClock({ startedAt: startedMorning, closedAt: at(16, 20).toISOString() }, at(18, 0));
    expect(closed?.status).toBe("closed");
    expect(closed?.detail).toContain("داخل الموعد");
  });
});
