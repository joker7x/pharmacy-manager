// قواعد الورديات: المواعيد، التذكير بالقفل، ومنع فتح شيفت قبل قفل السابق.
// كل الحسابات بالدقائق من منتصف الليل حتى تبقى قابلة للاختبار بدون تواريخ حقيقية.

export type ShiftKind = "morning" | "night";

export type ShiftWindow = { kind: ShiftKind; label: string; startMinutes: number; endMinutes: number };

export const SHIFT_WINDOWS: ShiftWindow[] = [
  { kind: "morning", label: "الشيفت الصباحي", startMinutes: 8 * 60 + 30, endMinutes: 16 * 60 + 30 },
  { kind: "night", label: "الشيفت الليلي", startMinutes: 16 * 60 + 30, endMinutes: 23 * 60 + 30 },
];

/** قبل موعد القفل بهالمدة يبدأ التذكير الأصفر. */
export const CLOSING_SOON_MINUTES = 30;

const arabicNumber = (value: number) => Math.trunc(value).toLocaleString("ar-EG");

export const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

export function formatClock(minutes: number) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour24 < 12 ? "ص" : "م";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${arabicNumber(hour12)}:${minute.toString().padStart(2, "0").replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)])} ${suffix}`;
}

export function formatDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${arabicNumber(rest)} دقيقة`;
  if (!rest) return `${arabicNumber(hours)} ساعة`;
  return `${arabicNumber(hours)} س ${arabicNumber(rest)} د`;
}

export function windowFor(kind: ShiftKind) {
  return SHIFT_WINDOWS.find((item) => item.kind === kind) ?? SHIFT_WINDOWS[0];
}

/** النافذة التي ينتمي إليها وقت معيّن، أو null لو خارج مواعيد الورديات. */
export function windowAt(date: Date): ShiftWindow | null {
  const minutes = minutesOfDay(date);
  return SHIFT_WINDOWS.find((item) => minutes >= item.startMinutes && minutes < item.endMinutes) ?? null;
}

export type ShiftClock = {
  window: ShiftWindow;
  deadlineMinutes: number;
  /** دقائق موجبة لحد موعد القفل، وسالبة بعد تجاوزه. */
  minutesRemaining: number;
  status: "open" | "closing_soon" | "overdue" | "closed";
  headline: string;
  detail: string;
};

/** حالة شيفت (مفتوح أو مقفول) بالنسبة لموعده الرسمي. */
export function shiftClock(shift: { startedAt: string; closedAt?: string }, now = new Date()): ShiftClock | null {
  const started = new Date(shift.startedAt);
  if (Number.isNaN(started.getTime())) return null;
  const window = windowAt(started) ?? SHIFT_WINDOWS.find((item) => minutesOfDay(started) < item.endMinutes) ?? windowFor("morning");
  const deadline = new Date(started);
  deadline.setHours(Math.floor(window.endMinutes / 60), window.endMinutes % 60, 0, 0);

  if (shift.closedAt) {
    const closed = new Date(shift.closedAt);
    const lateMinutes = (closed.getTime() - deadline.getTime()) / 60_000;
    return {
      window,
      deadlineMinutes: window.endMinutes,
      minutesRemaining: -lateMinutes,
      status: "closed",
      headline: `${window.label} مقفول`,
      detail: lateMinutes > 0 ? `أُغلق بعد موعدّه بـ ${formatDuration(lateMinutes)}.` : `أُغلق داخل الموعد (${formatClock(window.endMinutes)}).`,
    };
  }

  const minutesRemaining = (deadline.getTime() - now.getTime()) / 60_000;
  const status: ShiftClock["status"] = minutesRemaining <= 0 ? "overdue" : minutesRemaining <= CLOSING_SOON_MINUTES ? "closing_soon" : "open";
  return {
    window,
    deadlineMinutes: window.endMinutes,
    minutesRemaining,
    status,
    headline: `${window.label} — القفل الساعة ${formatClock(window.endMinutes)}`,
    detail: status === "overdue"
      ? `متأخر ${formatDuration(-minutesRemaining)} عن موعد القفل.`
      : status === "closing_soon"
        ? `فاضل ${formatDuration(minutesRemaining)} على موعد القفل.`
        : `باقي ${formatDuration(minutesRemaining)} على موعد القفل.`,
  };
}

export type StartPermission = { ok: boolean; kind: ShiftKind | null; window: ShiftWindow | null; reason?: string; blocker?: { pharmacistName: string; startedAt: string } };

/**
 * الشرط الأساسي: لا يبدأ شيفت قبل قفل السابق، ولا يبدأ أصلاً خارج نوافذ الورديات.
 * المالك يقفل صباحي ٤:٣٠، وبعدها فقط يُفتح الليلي.
 */
export function canStartShift(shifts: { pharmacistName: string; startedAt: string; closedAt?: string }[], now = new Date()): StartPermission {
  const open = shifts.find((shift) => !shift.closedAt);
  const target = windowAt(now);
  if (open) {
    const clock = shiftClock(open, now);
    return {
      ok: false,
      kind: null,
      window: target,
      blocker: { pharmacistName: open.pharmacistName, startedAt: open.startedAt },
      reason: `لا يمكن بدء ${target?.label ?? "شيفت جديد"} قبل قفل «${open.pharmacistName}» (${clock?.window.label ?? "الشيفت الحالي"}). ${clock && clock.status === "overdue" ? "الشيفت الحالي متأخر عن موعد قفله — اقفله أولًا." : `موعد قفله ${clock ? formatClock(clock.window.endMinutes) : "غير محدد"}.`}`,
    };
  }
  if (!target) {
    return { ok: false, kind: null, window: null, reason: `خارج مواعيد الورديات. الشيفت الصباحي يبدأ ${formatClock(SHIFT_WINDOWS[0].startMinutes)} والليلي حتى ${formatClock(SHIFT_WINDOWS[1].endMinutes)}.` };
  }
  return { ok: true, kind: target.kind, window: target };
}
