import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { COLORS, PageHeader } from "@/components/app-ui";
import { IconSymbol, IconSymbolName } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { getStaffDevice, useStaffSession } from "@/lib/staff-session";
import { cloudBackupConfigured, cloudBackupTarget, type BackupSummary } from "@/lib/cloud-backup";
import { usePharmacy } from "@/lib/pharmacy-context";
import { trpc } from "@/lib/trpc";

const arabicNumber = (value: number) => value.toLocaleString("ar-EG");
const formatBackupWhen = (value: string) => new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const backupSummaryLine = (backup: BackupSummary) => `${arabicNumber(backup.counts.medications)} صنف · ${arabicNumber(backup.counts.sales)} فاتورة · ${arabicNumber(backup.counts.shifts)} وردية · ${arabicNumber(backup.counts.debts)} دين`;
const backupSizeLine = (backup: BackupSummary) => `${arabicNumber(Math.max(1, Math.round(backup.size / 1024)))} ك.ب · ${backup.device} · إصدار ${backup.appVersion}`;

type DeviceSummary = Awaited<ReturnType<typeof getStaffDevice>>;

export default function SettingsScreen() {
  const router = useRouter();
  const { staff, can, logout, enablePhoneNotifications } = useStaffSession();
  const [device, setDevice] = useState<DeviceSummary>();
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string }>();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pushStatus = trpc.staff.pushStatus.useQuery(undefined, { enabled: Boolean(staff), retry: false });
  useEffect(() => { void getStaffDevice().then(setDevice); }, []);
  const enablePush = async () => {
    setNotice(undefined);
    try { setNotice({ tone: "success", text: await enablePhoneNotifications() }); }
    catch (error) { setNotice({ tone: "error", text: `تعذر تفعيل الإشعارات: ${error instanceof Error ? error.message : "تحقق من إعدادات النظام ثم حاول مرة أخرى."}` }); }
  };
  const confirmSignOut = async () => {
    setIsSigningOut(true);
    await logout();
    setIsSigningOut(false);
    setConfirmingSignOut(false);
    setNotice({ tone: "success", text: "تم تسجيل الخروج من هذا الجهاز." });
  };
  return <ScreenContainer className="flex-1"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <PageHeader title="الإعدادات" subtitle="الحساب والجهاز والإشعارات في مكان واحد" />
    {notice ? <View style={[styles.notice, notice.tone === "error" ? styles.noticeError : styles.noticeSuccess]}><Text style={[styles.noticeText, notice.tone === "error" ? styles.noticeTextError : styles.noticeTextSuccess]}>{notice.text}</Text><TouchableOpacity onPress={() => setNotice(undefined)} style={styles.noticeClose} activeOpacity={0.75}><IconSymbol name="xmark" size={15} color={notice.tone === "error" ? COLORS.danger : COLORS.primary} /></TouchableOpacity></View> : null}
    <Text style={styles.section}>الحساب</Text>
    <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{staff?.displayName?.slice(0, 1) ?? "ص"}</Text></View><View style={styles.profileText}><Text style={styles.name}>{staff?.displayName ?? "مستخدم الصيدلية"}</Text><Text style={styles.userName}>@{staff?.username ?? "—"}</Text><Text style={styles.role}>{staff?.role === "owner" ? "مسؤول الصيدلية" : staff?.role === "pharmacist" ? "صيدلي" : staff?.role === "cashier" ? "كاشير" : "عرض فقط"}</Text></View></View>
    <Text style={styles.section}>الجهاز والإشعارات</Text>
    <View style={styles.card}><InfoRow title="الجهاز" detail={device?.deviceName ?? "جارٍ قراءة الجهاز…"} /><InfoRow title="طراز الجهاز" detail={device?.deviceModel ?? "غير متاح"} bordered /><InfoRow title="النظام" detail={`${device?.devicePlatform ?? "—"} ${device?.osVersion ?? ""}`.trim()} bordered /><InfoRow title="إصدار التطبيق" detail={device?.appVersion ?? "—"} bordered /><TouchableOpacity onPress={enablePush} style={styles.actionRow} activeOpacity={0.78}><View style={styles.actionIcon}><IconSymbol name="bell.fill" size={19} color={COLORS.primary} /></View><View style={styles.actionText}><Text style={styles.actionTitle}>إشعارات الهاتف</Text><Text style={styles.actionDetail}>{pushStatus.data?.enabledDevices ? `مفعّلة على ${pushStatus.data.enabledDevices.toLocaleString("ar-EG")} جهاز/أجهزة` : "فعّل الإذن لاستلام رسائل الأدمن على هاتفك"}</Text></View><Text style={styles.pushPill}>{pushStatus.data?.enabledDevices ? "مفعّلة" : "تفعيل"}</Text></TouchableOpacity><TouchableOpacity onPress={() => router.push("/notifications")} style={[styles.actionRow, styles.border]} activeOpacity={0.78}><View style={styles.actionIcon}><IconSymbol name="bubble.left.fill" size={19} color={COLORS.primary} /></View><View style={styles.actionText}><Text style={styles.actionTitle}>صندوق الإشعارات</Text><Text style={styles.actionDetail}>عرض الرسائل والتنبيهات المستلمة داخل التطبيق</Text></View><IconSymbol name="chevron.left" size={19} color={COLORS.muted} /></TouchableOpacity></View>
    <Text style={styles.section}>النسخ الاحتياطي السحابي</Text>
    <CloudBackupCard onNotice={(tone, text) => setNotice({ tone, text })} />
    <Text style={styles.section}>إدارة التطبيق</Text>
    <View style={styles.card}><ToolRow icon="printer" title="الطابعة وحافظة الملصقات" detail="USB مباشر، تصميم الملصق، والملصقات المعلقة" onPress={() => router.push("/tools")} />{can("staff.manage") ? <ToolRow icon="person.3.fill" title="لوحة المسؤول" detail="الأفراد والصلاحيات والجلسات وسجل النشاط" onPress={() => router.push("/staff-admin")} bordered /> : null}</View>
    {staff ? <><Text style={styles.section}>الأمان</Text>{confirmingSignOut ? <View style={styles.confirmCard}><Text style={styles.confirmTitle}>تسجيل الخروج من هذا الجهاز؟</Text><Text style={styles.confirmText}>سيُنهى تسجيل الدخول، وستحتاج إلى اسم المستخدم وكلمة المرور للدخول مجددًا.</Text><View style={styles.confirmRow}><TouchableOpacity onPress={() => setConfirmingSignOut(false)} style={styles.confirmCancel} activeOpacity={0.8}><Text style={styles.confirmCancelText}>إلغاء</Text></TouchableOpacity><TouchableOpacity onPress={() => void confirmSignOut()} disabled={isSigningOut} style={styles.confirmLogout} activeOpacity={0.8}><Text style={styles.confirmLogoutText}>{isSigningOut ? "جارٍ الخروج…" : "تأكيد الخروج"}</Text></TouchableOpacity></View></View> : <TouchableOpacity onPress={() => { setNotice(undefined); setConfirmingSignOut(true); }} style={styles.logout} activeOpacity={0.78}><Text style={styles.logoutText}>تسجيل الخروج من هذا الجهاز</Text></TouchableOpacity>}</> : null}
  </ScrollView></ScreenContainer>;
}

function CloudBackupCard({ onNotice }: { onNotice: (tone: "error" | "success", text: string) => void }) {
  const { settings, updateSettings, cloudBackups, cloudBackupBusy, cloudBackupError, backupNow, refreshCloudBackups, restoreCloudBackup, deleteCloudBackup } = usePharmacy();
  const [confirming, setConfirming] = useState<{ kind: "restore" | "delete"; backup: BackupSummary }>();

  const run = async (action: () => Promise<string>) => {
    try { onNotice("success", await action()); }
    catch (error) { onNotice("error", error instanceof Error ? error.message : "حدث خطأ غير متوقع."); }
  };

  if (!cloudBackupConfigured) {
    return (
      <View style={styles.card}>
        <View style={styles.cloudHead}>
          <View style={styles.cloudIcon}><IconSymbol name="icloud.slash" size={19} color={COLORS.warning} /></View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>غير مضبوط على هذا الجهاز</Text>
            <Text style={styles.actionDetail}>للتشغيل: انسخ .env.example إلى .env وضع رابط المشروع ومفتاح anon، نفّذ supabase/pharmacy-backups.sql في SQL Editor، ثم أعد تشغيل التطبيق.</Text>
          </View>
        </View>
        {cloudBackupError ? <Text style={styles.cloudError}>{cloudBackupError}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cloudHead}>
        <View style={styles.cloudIcon}><IconSymbol name="checkmark.icloud" size={19} color={COLORS.primary} /></View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>متصل بـ {cloudBackupTarget}</Text>
          <Text style={styles.actionDetail}>
            {cloudBackups.length ? `آخر نسخة ${formatBackupWhen(cloudBackups[0].createdAt)} · ${cloudBackups[0].source}` : "لم تُرفع أي نسخة بعد من هذا الجهاز."}
          </Text>
        </View>
        <TouchableOpacity onPress={() => void run(async () => { await refreshCloudBackups(); return "تم تحديث قائمة النسخ."; })} disabled={cloudBackupBusy} style={[styles.cloudBtn, cloudBackupBusy && styles.cloudBtnDisabled]} activeOpacity={0.78}>
          <IconSymbol name="arrow.clockwise" size={15} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.actionRow, styles.border]}>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>رفع تلقائي بعد التعديلات</Text>
          <Text style={styles.actionDetail}>تُرسل نسخة كاملة بعد ٤٥ ثانية من توقف التعديل، مع الاحتفاظ بأحدث ٣٠ نسخة.</Text>
        </View>
        <Switch
          value={Boolean(settings.autoCloudBackup)}
          onValueChange={(value) => { updateSettings({ autoCloudBackup: value }); onNotice("success", value ? "تم تفعيل الرفع التلقائي." : "تم إيقاف الرفع التلقائي."); }}
          trackColor={{ true: COLORS.primary, false: "#E2E2DE" }}
          thumbColor="#FFFFFF"
        />
      </View>

      <View style={styles.cloudActions}>
        <TouchableOpacity onPress={() => void run(() => backupNow("يدوي"))} disabled={cloudBackupBusy} style={[styles.cloudPrimary, cloudBackupBusy && styles.cloudBtnDisabled]} activeOpacity={0.85}>
          <IconSymbol name="arrow.up.circle.fill" size={17} color="#FFFFFF" />
          <Text style={styles.cloudPrimaryText}>{cloudBackupBusy ? "جارٍ الرفع…" : "رفع نسخة الآن"}</Text>
        </TouchableOpacity>
      </View>

      {cloudBackupError ? <Text style={styles.cloudError}>{cloudBackupError}</Text> : null}

      {cloudBackups.length ? (
        <View style={styles.border}>
          {cloudBackups.map((backup, index) => (
            <View key={backup.id} style={[styles.backupRow, index ? styles.border : null]}>
              <View style={styles.backupText}>
                <Text style={styles.backupTitle}>{formatBackupWhen(backup.createdAt)} · {backup.source}</Text>
                <Text style={styles.backupMeta}>{backupSummaryLine(backup)}</Text>
                <Text style={styles.backupMeta}>{backupSizeLine(backup)}</Text>
              </View>
              <View style={styles.backupActions}>
                <TouchableOpacity onPress={() => setConfirming({ kind: "restore", backup })} style={styles.backupRestore} activeOpacity={0.8}>
                  <Text style={styles.backupRestoreText}>استرجاع</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirming({ kind: "delete", backup })} hitSlop={6} style={styles.backupDelete} activeOpacity={0.8}>
                  <IconSymbol name="trash" size={15} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {confirming ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{confirming.kind === "restore" ? "استرجاع هذه النسخة على الجهاز؟" : "حذف النسخة من السحابة؟"}</Text>
          <Text style={styles.confirmText}>
            {confirming.kind === "restore"
              ? `سيُستبدل كل ما على هذا الجهاز ببيانات نسخة ${formatBackupWhen(confirming.backup.createdAt)} (${backupSummaryLine(confirming.backup)}). النسخ الأخرى تبقى كما هي في السحابة.`
              : `سيُحذف أثر نسخة ${formatBackupWhen(confirming.backup.createdAt)} نهائيًا من Supabase.`}
          </Text>
          <View style={styles.confirmRow}>
            <TouchableOpacity onPress={() => setConfirming(undefined)} style={styles.confirmCancel} activeOpacity={0.8}><Text style={styles.confirmCancelText}>إلغاء</Text></TouchableOpacity>
            {confirming.kind === "restore" ? (
              <TouchableOpacity
                disabled={cloudBackupBusy}
                onPress={() => { const target = confirming.backup; setConfirming(undefined); void run(() => restoreCloudBackup(target.id)); }}
                style={[styles.cloudPrimary, cloudBackupBusy && styles.cloudBtnDisabled]}
                activeOpacity={0.8}
              >
                <Text style={styles.cloudPrimaryText}>تأكيد الاسترجاع</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { const target = confirming.backup; setConfirming(undefined); void run(async () => { await deleteCloudBackup(target.id); return "تم حذف النسخة من السحابة."; }); }}
                style={styles.backupDeleteConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.backupDeleteConfirmText}>حذف نهائي</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function InfoRow({ title, detail, bordered }: { title: string; detail: string; bordered?: boolean }) { return <View style={[styles.infoRow, bordered && styles.border]}><Text style={styles.infoDetail}>{detail}</Text><Text style={styles.infoTitle}>{title}</Text></View>; }
function ToolRow({ icon, title, detail, onPress, bordered }: { icon: IconSymbolName; title: string; detail: string; onPress: () => void; bordered?: boolean }) { return <TouchableOpacity onPress={onPress} style={[styles.actionRow, bordered && styles.border]} activeOpacity={0.78}><View style={styles.actionIcon}><IconSymbol name={icon} size={19} color={COLORS.primary} /></View><View style={styles.actionText}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View><IconSymbol name="chevron.left" size={19} color={COLORS.muted} /></TouchableOpacity>; }

const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 42 }, notice: { marginTop: 14, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row-reverse", alignItems: "center", gap: 9 }, noticeError: { backgroundColor: COLORS.softDanger }, noticeSuccess: { backgroundColor: COLORS.mint }, noticeText: { flex: 1, fontSize: 11, fontWeight: "800", lineHeight: 18, textAlign: "right" }, noticeTextError: { color: COLORS.danger }, noticeTextSuccess: { color: COLORS.primary }, noticeClose: { width: 26, height: 26, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, section: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right", marginTop: 24, marginBottom: 9 }, profileCard: { minHeight: 106, padding: 17, borderRadius: 23, backgroundColor: COLORS.deep, flexDirection: "row-reverse", alignItems: "center", gap: 13 }, avatar: { width: 53, height: 53, borderRadius: 27, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center" }, avatarText: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" }, profileText: { flex: 1, alignItems: "flex-end" }, name: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", textAlign: "right" }, userName: { color: "#BDE5D4", fontSize: 11, marginTop: 3 }, role: { color: "#DDF5EA", fontSize: 10, fontWeight: "800", marginTop: 7, backgroundColor: "#24574F", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 }, card: { backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border }, infoRow: { minHeight: 50, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 18 }, infoTitle: { color: COLORS.ink, fontSize: 11, fontWeight: "900" }, infoDetail: { flex: 1, color: COLORS.muted, fontSize: 10, textAlign: "left" }, border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }, actionRow: { minHeight: 72, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", gap: 11 }, actionIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#E8F8F1", alignItems: "center", justifyContent: "center" }, actionText: { flex: 1, alignItems: "flex-end" }, actionTitle: { color: COLORS.ink, fontSize: 12, fontWeight: "900", textAlign: "right" }, actionDetail: { color: COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: "right", marginTop: 3 }, pushPill: { color: COLORS.primary, backgroundColor: "#E8F8F1", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: "900" }, confirmCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.danger }, confirmTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right" }, confirmText: { color: COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 6 }, confirmRow: { flexDirection: "row-reverse", gap: 9, marginTop: 14 }, confirmCancel: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: "#F2F1EE", alignItems: "center", justifyContent: "center" }, confirmCancelText: { color: COLORS.ink, fontSize: 12, fontWeight: "900" }, confirmLogout: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center" }, confirmLogoutText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" }, logout: { minHeight: 50, borderRadius: 16, backgroundColor: "#FFF0ED", justifyContent: "center", alignItems: "center" }, logoutText: { color: COLORS.danger, fontSize: 13, fontWeight: "900" },
  cloudHead: { minHeight: 74, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  cloudIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#E8F8F1", alignItems: "center", justifyContent: "center" },
  cloudBtn: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#E8F8F1", alignItems: "center", justifyContent: "center" },
  cloudBtnDisabled: { opacity: 0.5 },
  cloudActions: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, paddingTop: 12 },
  cloudPrimary: { minHeight: 46, borderRadius: 15, backgroundColor: COLORS.primary, paddingHorizontal: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7 },
  cloudPrimaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  cloudError: { color: COLORS.danger, fontSize: 10, lineHeight: 17, textAlign: "right", paddingHorizontal: 14, paddingBottom: 12 },
  backupRow: { paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  backupText: { flex: 1, alignItems: "flex-end" },
  backupTitle: { color: COLORS.ink, fontSize: 11, fontWeight: "900", textAlign: "right" },
  backupMeta: { color: COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: "right", marginTop: 3 },
  backupActions: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  backupRestore: { minHeight: 34, borderRadius: 11, backgroundColor: "#E8F8F1", paddingHorizontal: 11, alignItems: "center", justifyContent: "center" },
  backupRestoreText: { color: COLORS.primary, fontSize: 11, fontWeight: "900" },
  backupDelete: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#FFF0ED", alignItems: "center", justifyContent: "center" },
  backupDeleteConfirm: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center" },
  backupDeleteConfirmText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" } });
