import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  medications: [], sales: [], suppliers: [], incomingOrders: [], reorderRecords: [], shifts: [], expenses: [], debts: [],
  settings: { imageRetentionDays: 30, printer: {}, labelQueue: [] },
} as never;

const loadModule = async () => {
  vi.resetModules();
  return import("../lib/cloud-backup");
};

describe("النسخ الاحتياطي السحابي", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_TABLE;
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_TABLE;
  });

  it("يرفض الرفع برسالة واضحة قبل ضبط المشروع", async () => {
    const cloud = await loadModule();
    expect(cloud.cloudBackupConfigured).toBe(false);
    await expect(cloud.uploadBackup(state)).rejects.toThrow("النسخ السحابي غير مضبوط");
  });

  it("يبني طلب الإدراج بالمفتاح واسم الجدول الافتراضي", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://demo.supabase.co/";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ id: 7, created_at: "2026-10-03T12:00:00Z", source: "يدوي", device: "متصفح", app_version: "1.0.0", size: 120, counts: { medications: 3, sales: 1 } }]), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const cloud = await loadModule();
    expect(cloud.cloudBackupConfigured).toBe(true);
    expect(cloud.cloudBackupTarget).toBe("demo.supabase.co");

    const summary = await cloud.uploadBackup(state);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://demo.supabase.co/rest/v1/pharmacy_backups?select=id,created_at,source,device,app_version,size,counts");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).apikey).toBe("public-anon-key");
    expect((init.headers as Record<string, string>).Prefer).toBe("return=representation");
    expect(JSON.parse(String(init.body)).payload.state).toBeTruthy();
    expect(summary.counts.medications).toBe(3);
    expect(summary.counts.debts).toBe(0);
  });

  it("يحترم اسم الجدول المخصص ويترجم خطأ ٤٠٤", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "k";
    process.env.EXPO_PUBLIC_SUPABASE_TABLE = "saydalty_snapshots";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("table not found", { status: 404 })));

    const cloud = await loadModule();
    await expect(cloud.listBackups(3)).rejects.toThrow("جدول النسخ «saydalty_snapshots» غير موجود");
    const url = (vi.mocked(fetch).mock.calls[0] as [string])[0];
    expect(url).toContain("/rest/v1/saydalty_snapshots?");
    expect(url).toContain("limit=3");
  });

  it("يحوّل الاسترجاع إلى بيانات الحالة نفسها", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "k";
    const payload = { exportedAt: "2026-10-03T12:00:00Z", appVersion: "1.0.0", device: "متصفح", counts: {}, state };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ payload }]), { status: 200 })));

    const cloud = await loadModule();
    const pack = await cloud.downloadBackup(12);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("id=eq.12");
    expect(pack.state).toEqual(state);
  });
});
