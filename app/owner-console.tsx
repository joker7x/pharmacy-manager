import { useMemo, useState } from "react";
import { Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { COLORS, RoundIcon } from "@/components/app-ui";
import { AdminButton, AdminCard, AdminShell } from "@/components/local-admin-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatCurrency, usePharmacy } from "@/lib/pharmacy-context";
import { useStaffSession } from "@/lib/staff-session";
import { trpc } from "@/lib/trpc";

const num = (value: number) => value.toLocaleString("ar-EG");
const when = (value?: string | Date | null) => (value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function OwnerConsoleScreen() {
  const { staff } = useStaffSession();
  const { medications, sales, expenses, debts, suppliers, shifts, reorderNeeds, backupNow, cloudBackupBusy } = usePharmacy();
  const isOwner = staff?.role === "owner";

  const staffList = trpc.staff.list.useQuery(undefined, { enabled: isOwner, retry: false });
  const sessions = trpc.staff.sessions.useQuery(undefined, { enabled: isOwner, retry: false });
  const audits = trpc.staff.audits.useQuery(undefined, { enabled: isOwner, retry: false });

  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string }>();

  const totals = useMemo(() => {
    const stockValue = medications.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const salesTotal = sales.reduce((sum, item) => sum + item.total, 0);
    const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
    const debtsOpen = debts.reduce((sum, item) => sum + Math.max(0, item.total - item.paid), 0);
    return { stockValue, salesTotal, expensesTotal, debtsOpen };
  }, [debts, expenses, medications, sales]);

  const aggregate = useMemo(() => ({
    generatedAt: new Date().toISOString(),
    owner: staff ? { username: staff.username, displayName: staff.displayName } : null,
    pharmacy: {
      medications, sales, expenses, debts, suppliers, shifts,
      shortages: reorderNeeds.map((need) => ({
        name: need.medication.name, sku: need.medication.sku, status: need.status,
        quantity: need.medication.quantity, reorderLevel: need.medication.reorderLevel,
        desiredQuantity: need.desiredQuantity, supplierName: need.supplierName ?? null,
        customerName: need.customerName ?? null, demandCount: need.demandCount,
      })),
    },
  }), [debts, expenses, medications, reorderNeeds, sales, shifts, staff, suppliers]);

  const exportAggregate = async () => {
    const payload = JSON.stringify(aggregate, null, 2);
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
        setNotice({ tone: "success", text: "تم نسخ ملف البيانات الكامل (JSON) إلى الحافظة." });
        return;
      }
      await Share.share({ message: payload, title: "بيانات صيدليتي" });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? `تعذّر التصدير: ${error.message}` : "تعذّر التصدير." });
    }
  };

  const uploadBackup = async () => {
    setNotice(undefined);
    try { setNotice({ tone: "success", text: await backupNow("لوحة المالك") }); }
    catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "تعذّر رفع النسخة." }); }
  };

  if (!staff) {
    return (
      <ScreenDeny
        icon="lock.fill"
        title="لوحة المالك محمية"
        text="هذه لوحة تجميع بيانات الصيدلية والأفراد، ولا تُفتح إلا لحساب المالك الأساسي. سجّل دخولك أولًا."
      />
    );
  }

  if (!isOwner) {
    return (
      <ScreenDeny
        icon="person.crop.circle.fill"
        title="هذه اللوحة للمالك الأساسي"
        text={`حساب «${staff.displayName}» دوره ${staff.role === "pharmacist" ? "صيدلي" : staff.role === "cashier" ? "كاشير" : "عرض فقط"}، ورؤية كل بيانات الصيدلية وحسابات الأفراد مسموحة للمالك فقط.`}
      />
    );
  }

  return (
    <AdminShell title="لوحة المالك" subtitle="تجميع كامل لبيانات الصيدلية والحسابات — مرئية لك وحدك">
      {notice ? (
        <View style={[styles.notice, notice.tone === "error" ? styles.noticeError : styles.noticeSuccess]}>
          <IconSymbol name={notice.tone === "error" ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"} size={16} color={notice.tone === "error" ? COLORS.danger : COLORS.primary} />
          <Text style={[styles.noticeText, notice.tone === "error" ? styles.noticeTextError : styles.noticeTextSuccess]}>{notice.text}</Text>
          <TouchableOpacity onPress={() => setNotice(undefined)} style={styles.noticeClose} activeOpacity={0.7}><IconSymbol name="xmark" size={13} color={COLORS.muted} /></TouchableOpacity>
        </View>
      ) : null}

      <AdminCard>
        <Text style={styles.sectionTitle}>ملخص الصيدلية</Text>
        <View style={styles.tiles}>
          <Tile label="أصناف مسجّلة" value={num(medications.length)} />
          <Tile label="قيمة المخزون" value={formatCurrency(totals.stockValue)} />
          <Tile label="إجمالي المبيعات" value={formatCurrency(totals.salesTotal)} caption={`${num(sales.length)} فاتورة`} />
          <Tile label="إجمالي المصروفات" value={formatCurrency(totals.expensesTotal)} caption={`${num(expenses.length)} عملية`} tone={COLORS.warning} />
          <Tile label="ديون مستحقة" value={formatCurrency(totals.debtsOpen)} caption={`${num(debts.length)} عميل`} tone={COLORS.danger} />
          <Tile label="نواقص حالية" value={num(reorderNeeds.length)} caption={`${num(medications.filter((item) => item.quantity === 0).length)} نافد`} tone={COLORS.danger} />
          <Tile label="ورديات مغلقة" value={num(shifts.filter((shift) => shift.closedAt).length)} caption={shifts.some((shift) => !shift.closedAt) ? "واحد مفتوح الآن" : "لا شيفت مفتوح"} />
          <Tile label="موردون" value={num(suppliers.length)} />
        </View>
      </AdminCard>

      <AdminCard style={styles.gap}>
        <Text style={styles.sectionTitle}>تصدير ونسخ</Text>
        <Text style={styles.sectionHint}>ملف JSON واحد فيه كل بيانات الصيدلية (أصناف، فواتير، مصروفات، ديون، ورديات، نواقص، موردين) مع بيانات الحساب الحالي.</Text>
        <View style={styles.actions}>
          <AdminButton title="نسخ ملف البيانات" onPress={() => void exportAggregate()} />
          <AdminButton title={cloudBackupBusy ? "جارٍ الرفع…" : "رفع نسخة سحابية"} secondary disabled={cloudBackupBusy} onPress={() => void uploadBackup()} />
        </View>
        <TouchableOpacity onPress={() => router.push("/settings")} style={styles.linkRow} activeOpacity={0.78}>
          <Text style={styles.linkText}>إدارة النسخ الاحتياطي والاسترجاع</Text>
          <IconSymbol name="chevron.left" size={16} color={COLORS.muted} />
        </TouchableOpacity>
      </AdminCard>

      <AdminCard style={styles.gap}>
        <Text style={styles.sectionTitle}>حسابات الأفراد</Text>
        {staffList.isError ? <OfflineNote text="سيرفر الصيدلية غير متاح، فبيانات الحسابات مخفية. بياناتك المحلية ما زالت محفوظة." onRetry={() => void staffList.refetch()} /> : null}
        {staffList.isLoading && !staffList.isError ? <Text style={styles.muted}>جارٍ تحميل الحسابات…</Text> : null}
        {(staffList.data ?? []).map((account, index) => (
          <View key={account.userId ?? account.username} style={[styles.row, index > 0 && styles.rowDivider]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{account.displayName}</Text>
              <Text style={styles.rowMeta}>@{account.username} · {account.role === "owner" ? "مالك" : account.role === "pharmacist" ? "صيدلي" : account.role === "cashier" ? "كاشير" : "عرض فقط"} · {account.permissions.length} صلاحية</Text>
            </View>
            <Text style={[styles.rowBadge, account.status !== "active" && styles.rowBadgeWarn]}>{account.status === "active" ? "نشط" : account.status === "frozen" ? "مجمّد" : "معطّل"}</Text>
          </View>
        ))}
        {staffList.data && staffList.data.length === 0 ? <Text style={styles.muted}>لا توجد حسابات على السيرفر بعد.</Text> : null}
      </AdminCard>

      <AdminCard style={styles.gap}>
        <Text style={styles.sectionTitle}>الأجهزة والجلسات</Text>
        {sessions.isError ? <OfflineNote text="لا يمكن قراءة الجلسات بدون السيرفر." onRetry={() => void sessions.refetch()} /> : null}
        {sessions.isLoading && !sessions.isError ? <Text style={styles.muted}>جارٍ تحميل الجلسات…</Text> : null}
        {(sessions.data ?? []).slice(0, 6).map((session, index) => (
          <View key={session.id ?? index} style={[styles.row, index > 0 && styles.rowDivider]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>{session.deviceName ?? "جهاز غير معروف"}</Text>
              <Text style={styles.rowMeta}>{session.devicePlatform ?? "—"} · آخر نشاط {when(session.lastActiveAt ?? session.createdAt)}</Text>
            </View>
          </View>
        ))}
      </AdminCard>

      <AdminCard style={styles.gap}>
        <Text style={styles.sectionTitle}>سجل النشاط الإداري</Text>
        {audits.isError ? <OfflineNote text="سجل النشاط على السيرفر، والسيرفر غير متاح الآن." onRetry={() => void audits.refetch()} /> : null}
        {audits.isLoading && !audits.isError ? <Text style={styles.muted}>جارٍ تحميل السجل…</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.auditTrack}>
          {(audits.data ?? []).slice(0, 12).map((entry, index) => (
            <View key={entry.id ?? index} style={styles.auditCard}>
              <Text style={styles.auditAction}>{entry.action}</Text>
              <Text style={styles.auditDetail} numberOfLines={3}>{entry.detail}</Text>
              <Text style={styles.auditWhen}>{when(typeof entry.createdAt === "string" ? entry.createdAt : undefined)}</Text>
            </View>
          ))}
        </ScrollView>
        {audits.data && audits.data.length === 0 ? <Text style={styles.muted}>لا توجد أنشطة مسجّلة.</Text> : null}
      </AdminCard>

      <AdminCard style={styles.gap}>
        <Text style={styles.sectionTitle}>أحدث الفواتير</Text>
        {sales.slice(0, 6).map((sale, index) => (
          <View key={sale.id} style={[styles.row, index > 0 && styles.rowDivider]}>
            <Text style={styles.rowAmount}>{formatCurrency(sale.total)}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{sale.items.length} صنف · {sale.paymentMethod}</Text>
              <Text style={styles.rowMeta}>{when(sale.createdAt)}</Text>
            </View>
          </View>
        ))}
        {!sales.length ? <Text style={styles.muted}>لا توجد فواتير مسجّلة على هذا الجهاز.</Text> : null}
      </AdminCard>
    </AdminShell>
  );
}

function ScreenDeny({ icon, title, text }: { icon: Parameters<typeof RoundIcon>[0]["name"]; title: string; text: string }) {
  return (
    <View style={styles.deny}>
      <RoundIcon name={icon} color={COLORS.muted} background="#EEF3F1" />
      <Text style={styles.denyTitle}>{title}</Text>
      <Text style={styles.denyText}>{text}</Text>
      <TouchableOpacity onPress={() => router.push("/login")} style={styles.denyButton} activeOpacity={0.85}>
        <Text style={styles.denyButtonText}>تسجيل الدخول</Text>
      </TouchableOpacity>
    </View>
  );
}

function OfflineNote({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={styles.offline}>
      <IconSymbol name="exclamationmark.triangle.fill" size={15} color={COLORS.warning} />
      <Text style={styles.offlineText}>{text}</Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.8}><Text style={styles.offlineRetry}>إعادة</Text></TouchableOpacity>
    </View>
  );
}

function Tile({ label, value, caption, tone = COLORS.ink }: { label: string; value: string; caption?: string; tone?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color: tone }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {caption ? <Text style={styles.tileCaption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderRadius: 17, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 14 },
  noticeError: { backgroundColor: COLORS.softDanger }, noticeSuccess: { backgroundColor: COLORS.mint },
  noticeText: { flex: 1, fontSize: 11, fontWeight: "800", textAlign: "right", lineHeight: 18 },
  noticeTextError: { color: COLORS.danger }, noticeTextSuccess: { color: COLORS.primary },
  noticeClose: { width: 25, height: 25, borderRadius: 8, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right", marginBottom: 10 },
  sectionHint: { color: COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: "right", marginBottom: 12 },
  gap: { marginTop: 14 },
  tiles: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  tile: { width: "48%", flexGrow: 1, minWidth: 150, backgroundColor: "#F7F7F5", borderRadius: 16, padding: 13 },
  tileValue: { fontSize: 17, fontWeight: "900", textAlign: "right" },
  tileLabel: { color: COLORS.ink, fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 4 },
  tileCaption: { color: COLORS.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  actions: { gap: 10 },
  linkRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingTop: 14, marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  linkText: { color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  row: { minHeight: 58, flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 9 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  rowText: { flex: 1, alignItems: "flex-end" },
  rowTitle: { color: COLORS.ink, fontSize: 12.5, fontWeight: "900", textAlign: "right" },
  rowMeta: { color: COLORS.muted, fontSize: 10, textAlign: "right", marginTop: 3, lineHeight: 15 },
  rowAmount: { color: COLORS.ink, fontSize: 13.5, fontWeight: "900", minWidth: 72, textAlign: "left" },
  rowBadge: { color: COLORS.primary, backgroundColor: COLORS.mint, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: "900" },
  rowBadgeWarn: { color: COLORS.warning, backgroundColor: COLORS.softWarning },
  muted: { color: COLORS.muted, fontSize: 11.5, textAlign: "right", paddingVertical: 8 },
  offline: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: COLORS.softWarning, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  offlineText: { flex: 1, color: "#8E462C", fontSize: 10.5, lineHeight: 17, textAlign: "right" },
  offlineRetry: { color: COLORS.warning, fontSize: 11, fontWeight: "900" },
  auditTrack: { gap: 10, paddingVertical: 4 },
  auditCard: { width: 210, backgroundColor: "#F7F7F5", borderRadius: 16, padding: 12 },
  auditAction: { color: COLORS.ink, fontSize: 11, fontWeight: "900", textAlign: "right" },
  auditDetail: { color: COLORS.muted, fontSize: 10.5, lineHeight: 17, textAlign: "right", marginTop: 5 },
  auditWhen: { color: "#9CA6A1", fontSize: 9.5, textAlign: "right", marginTop: 7 },
  deny: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 10, backgroundColor: COLORS.background },
  denyTitle: { color: COLORS.ink, fontSize: 19, fontWeight: "900", textAlign: "center" },
  denyText: { color: COLORS.muted, fontSize: 12, textAlign: "center", lineHeight: 20 },
  denyButton: { minHeight: 50, borderRadius: 18, backgroundColor: COLORS.primary, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", marginTop: 8 },
  denyButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});
