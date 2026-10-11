import type { PharmacyState } from "./pharmacy-context";

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const SUPABASE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const TABLE = (process.env.EXPO_PUBLIC_SUPABASE_TABLE ?? "pharmacy_backups").trim();

export const cloudBackupConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** عنوان المشروع كما يظهر في الواجهة بدون كشف المفتاح. */
export const cloudBackupTarget = SUPABASE_URL.replace(/^https?:\/\//, "").replace(/\.supabase\.co$/, ".supabase.co");

export type BackupCounts = {
  medications: number;
  sales: number;
  shifts: number;
  expenses: number;
  debts: number;
  suppliers: number;
  shortages: number;
};

export type BackupSummary = {
  id: number;
  createdAt: string;
  source: string;
  device: string;
  appVersion: string;
  size: number;
  counts: BackupCounts;
};

export type BackupPayload = {
  exportedAt: string;
  appVersion: string;
  device: string;
  counts: BackupCounts;
  state: PharmacyState;
};

const requestHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

function describeFailure(status: number, body: string) {
  if (status === 401 || status === 403) return "رفض Supabase الاتصال: تأكد من صحة المفتاح ومن أن سياسات RLS تسمح بالقراءة والكتابة على جدول النسخ.";
  if (status === 404) return `جدول النسخ «${TABLE}» غير موجود في مشروع Supabase بعد. نفّذ ملف supabase/pharmacy-backups.sql في SQL Editor.`;
  if (!navigatorOnLine()) return "لا يوجد اتصال بالإنترنت على هذا الجهاز.";
  const detail = body.slice(0, 180);
  return `تعذّر التواصل مع Supabase (${status}). ${detail}`;
}

const navigatorOnLine = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!cloudBackupConfigured) {
    throw new Error("النسخ السحابي غير مضبوط. أضف EXPO_PUBLIC_SUPABASE_URL وEXPO_PUBLIC_SUPABASE_ANON_KEY في ملف .env ثم أعد تشغيل التطبيق.");
  }
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: requestHeaders((init.headers as Record<string, string>) ?? {}) });
  } catch (error) {
    throw new Error(navigatorOnLine() ? `تعذّر الوصول إلى Supabase: ${error instanceof Error ? error.message : "خطأ شبكة"}` : "لا يوجد اتصال بالإنترنت على هذا الجهاز.");
  }
  if (!response.ok) throw new Error(describeFailure(response.status, await response.text().catch(() => "")));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * تسمية الجهاز بدون استيراد react-native: الملف داخل سلسلة استيرادات
 * اختبارات vitest التي لا تحوّل مصادر react-native.
 */
export function currentDeviceLabel() {
  if (typeof document !== "undefined") return "متصفح";
  const agent = typeof navigator === "undefined" ? "" : String(navigator.userAgent ?? "");
  if (/Android/i.test(agent)) return "أندرويد";
  if (/iPhone|iPad|iPod/i.test(agent)) return "iOS";
  return "جهاز";
}

// يوازي version في app.config.ts؛ يُحدّث يدويًا مع كل إصدار.
const appVersion = "1.0.0";

export function summarizeBackup(state: PharmacyState): BackupCounts {
  return {
    medications: state.medications.length,
    sales: state.sales.length,
    shifts: state.shifts.length,
    expenses: state.expenses.length,
    debts: state.debts.length,
    suppliers: state.suppliers.length,
    shortages: state.reorderRecords.length,
  };
}

export function buildBackupPayload(state: PharmacyState): BackupPayload {
  return { exportedAt: new Date().toISOString(), appVersion, device: currentDeviceLabel(), counts: summarizeBackup(state), state };
}

const toSummary = (row: { id: number; created_at: string; source: string; device: string; app_version: string; size: number; counts: Partial<BackupCounts> | null }): BackupSummary => ({
  id: row.id,
  createdAt: row.created_at,
  source: row.source ?? "يدوي",
  device: row.device ?? "—",
  appVersion: row.app_version ?? "—",
  size: row.size ?? 0,
  counts: { medications: 0, sales: 0, shifts: 0, expenses: 0, debts: 0, suppliers: 0, shortages: 0, ...(row.counts ?? {}) },
});

/** يرفع نسخة كاملة من بيانات التطبيق. يرجع ملخص النسخة المحفوظة. */
export async function uploadBackup(state: PharmacyState, source = "يدوي"): Promise<BackupSummary> {
  const payload = buildBackupPayload(state);
  const body = JSON.stringify({
    source,
    device: payload.device,
    app_version: payload.appVersion,
    size: JSON.stringify(payload).length,
    counts: payload.counts,
    payload,
  });
  const rows = await request<Array<Parameters<typeof toSummary>[0]>>(`/rest/v1/${TABLE}?select=id,created_at,source,device,app_version,size,counts`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body,
  });
  if (!rows?.length) throw new Error("قبِل Supabase الطلب لكنه لم يرجع بيانات النسخة.");
  return toSummary(rows[0]);
}

export async function listBackups(limit = 10): Promise<BackupSummary[]> {
  const rows = await request<Array<Parameters<typeof toSummary>[0]>>(
    `/rest/v1/${TABLE}?select=id,created_at,source,device,app_version,size,counts&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 50))}`,
  );
  return (rows ?? []).map(toSummary);
}

export async function downloadBackup(id: number): Promise<BackupPayload> {
  const rows = await request<Array<{ payload: BackupPayload }>>(`/rest/v1/${TABLE}?select=payload&id=eq.${encodeURIComponent(String(id))}`);
  const payload = rows?.[0]?.payload;
  if (!payload?.state) throw new Error("هذه النسخة لا تحتوي بيانات صالحة.");
  return payload;
}

export async function deleteBackup(id: number): Promise<void> {
  await request<void>(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(String(id))}`, { method: "DELETE" });
}

/** يبقي أحدث `keep` نسخة فقط حتى لا يمتلئ المشروع بالنسخ التلقائية. */
export async function pruneBackups(keep = 30): Promise<void> {
  const rows = await request<Array<{ id: number }>>(`/rest/v1/${TABLE}?select=id&order=created_at.desc&range=[${keep},${keep + 200}]`);
  await Promise.all((rows ?? []).map((row) => deleteBackup(row.id).catch(() => undefined)));
}
