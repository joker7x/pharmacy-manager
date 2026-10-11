import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS, commonStyles } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatCurrency, usePharmacy } from "@/lib/pharmacy-context";
import { shiftClock } from "@/lib/shift-schedule";
import { ScreenContainer } from "@/components/screen-container";

export default function DashboardScreen() {
  const { sales, expenses, reorderNeeds, alerts, isReady, activeShift } = usePharmacy();
  const shiftStatus = activeShift ? shiftClock(activeShift) : null;
  const urgentShortages = reorderNeeds.filter((need) => need.status === "needed" && (need.urgent || need.medication.quantity === 0)).length;
  const today = new Date().toDateString();
  const todaysSales = sales.filter((sale) => new Date(sale.createdAt).toDateString() === today);
  const todaysExpenses = expenses.filter((expense) => new Date(expense.createdAt).toDateString() === today);
  const revenue = todaysSales.reduce((sum, sale) => sum + sale.total, 0);
  const expenseTotal = todaysExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netRevenue = revenue - expenseTotal;
  const activeReorders = reorderNeeds.filter((item) => item.status === "needed").length;
  const expiryCount = alerts.filter((alert) => alert.kind === "expiry").length;
  const hasUrgent = expiryCount > 0 || activeReorders > 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 17 ? "نهارك سعيد" : "مساء الخير";
  const countNoun = (count: number, one: string, two: string, many: string) => count === 1 ? `صنف واحد ${one}` : count === 2 ? `صنفان ${two}` : `${count.toLocaleString("ar-EG")} أصناف ${many}`;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="flex-1"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={commonStyles.content}><View style={styles.headerRow}><View style={styles.accountIcon}><IconSymbol name="person.crop.circle.fill" size={25} color="#82E4C2" /></View><View style={styles.brandText}><Text style={styles.greeting}>{greeting}</Text><Text style={styles.brandName}>صيدليتي</Text></View></View><TouchableOpacity onPress={() => router.push("/reports")} style={styles.revenueCard} activeOpacity={0.9}><View style={styles.revenueTop}><View style={styles.revenueIcon}><IconSymbol name="chart.line.uptrend.xyaxis" size={22} color="#FFFFFF" /></View><View style={styles.revenueCopy}><Text style={styles.revenueLabel}>مبيعات اليوم</Text><Text style={styles.revenueValue}>{formatCurrency(revenue)}</Text></View></View><View style={styles.revenueMeta}><Text style={styles.metaValue}>{formatCurrency(netRevenue)}</Text><Text style={styles.metaLabel}>صافي</Text><View style={styles.metaDivider} /><Text style={styles.metaValue}>{formatCurrency(expenseTotal)}</Text><Text style={styles.metaLabel}>مصروفات</Text><View style={styles.metaDivider} /><Text style={styles.metaValue}>{todaysSales.length.toLocaleString("ar-EG")}</Text><Text style={styles.metaLabel}>فاتورة</Text></View></TouchableOpacity>{shiftStatus ? <TouchableOpacity onPress={() => router.push("/shifts")} style={[styles.shiftNotice, shiftStatus.status === "closing_soon" && styles.shiftNoticeSoon, shiftStatus.status === "overdue" && styles.shiftNoticeOverdue]} activeOpacity={0.85}><View style={styles.shiftNoticeIcon}><IconSymbol name={shiftStatus.status === "open" ? "clock.fill" : "exclamationmark.triangle.fill"} size={18} color="#FFFFFF" /></View><Text style={styles.shiftNoticeText}>{shiftStatus.headline} — {shiftStatus.detail}{shiftStatus.status !== "open" ? " · راجع المصروفات قبل عدّ الدرج" : ""}</Text></TouchableOpacity> : null}{urgentShortages ? <TouchableOpacity onPress={() => router.push("/(tabs)/alerts")} style={styles.expiryNotice} activeOpacity={0.8}><View style={styles.noticeIcon}><IconSymbol name="exclamationmark.triangle.fill" size={20} color="#FFFFFF" /></View><Text style={styles.noticeText}>{`${urgentShortages.toLocaleString("ar-EG")} أصناف عاجلة ناقصة`}</Text><IconSymbol name="chevron.left" size={17} color="#B4694A" /></TouchableOpacity> : null}<TouchableOpacity onPress={() => router.push("/(tabs)/alerts")} style={[styles.expiryNotice, !hasUrgent && styles.noticeCalm]} activeOpacity={0.8}><View style={[styles.noticeIcon, !hasUrgent && styles.noticeIconCalm]}><IconSymbol name={hasUrgent ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"} size={20} color="#FFFFFF" /></View><Text style={[styles.noticeText, !hasUrgent && styles.noticeTextCalm]}>{expiryCount ? countNoun(expiryCount, "اقتربت صلاحيته", "اقتربت صلاحيتهما", "اقتربت صلاحيتها") : activeReorders ? countNoun(activeReorders, "يحتاج إعادة طلب", "يحتاجان إعادة طلب", "تحتاج إعادة طلب") : "المخزون مستقر ولا توجد تنبيهات عاجلة"}</Text><IconSymbol name="chevron.left" size={17} color={hasUrgent ? "#B4694A" : "#3C9B78"} /></TouchableOpacity><Text style={styles.sectionTitle}>اختصارات سريعة</Text><View style={styles.unitGrid}><UnitTile icon="cart.fill" label="الكاشير" tone="green" onPress={() => router.push("/(tabs)/sales")} /><UnitTile icon="shippingbox.fill" label="المخزون" tone="dark" onPress={() => router.push("/(tabs)/inventory")} /><UnitTile icon="truck.box.fill" label="الطلبات" tone="orange" onPress={() => router.push("/orders")} /><UnitTile icon="person.crop.circle.fill" label="العملاء" tone="mint" onPress={() => router.push("/debts")} /><UnitTile icon="clock.fill" label="الشيفتات" tone="peach" onPress={() => router.push("/shifts")} /><UnitTile icon="bell.fill" label="النواقص" tone="aqua" count={activeReorders} onPress={() => router.push("/(tabs)/alerts")} /></View><View style={styles.statusLine}><View style={[styles.statusDot, isReady && styles.statusDotReady]} /><Text style={styles.statusText}>{isReady ? "البيانات محفوظة على الجهاز" : "جارٍ تجهيز البيانات"}</Text></View></ScrollView></ScreenContainer>;
}

function UnitTile({ icon, label, tone, count, onPress }: { icon: Parameters<typeof IconSymbol>[0]["name"]; label: string; tone: "green" | "dark" | "orange" | "mint" | "peach" | "aqua"; count?: number; onPress: () => void }) {
  const tones = { green: { background: "#E9F8F1", icon: COLORS.primary }, dark: { background: COLORS.deep, icon: "#FFFFFF" }, orange: { background: COLORS.softWarning, icon: COLORS.warning }, mint: { background: "#E6F6F1", icon: "#2D8B75" }, peach: { background: "#FCE4D7", icon: "#D66A42" }, aqua: { background: "#CFF2E7", icon: "#2F9D83" } };
  const colors = tones[tone];
  return <TouchableOpacity onPress={onPress} style={styles.unitTile} activeOpacity={0.78}><View style={[styles.unitIcon, { backgroundColor: colors.background }]}><IconSymbol name={icon} size={24} color={colors.icon} /></View><Text style={styles.unitLabel}>{label}</Text>{count ? <View style={styles.unitCount}><Text style={styles.unitCountText}>{count.toLocaleString("ar-EG")}</Text></View> : null}</TouchableOpacity>;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  accountIcon: { width: 53, height: 53, borderRadius: 18, backgroundColor: COLORS.deep, alignItems: "center", justifyContent: "center" },
  brandText: { flex: 1, alignItems: "flex-end", paddingRight: 14 },
  greeting: { color: COLORS.muted, fontSize: 13, fontWeight: "700", textAlign: "right" },
  brandName: { color: COLORS.ink, fontSize: 25, lineHeight: 32, fontWeight: "900", marginTop: 2, textAlign: "right" },
  revenueCard: { backgroundColor: COLORS.primary, borderRadius: 29, padding: 20, minHeight: 158 },
  revenueTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" },
  revenueIcon: { width: 49, height: 49, borderRadius: 16, backgroundColor: "#15906B", alignItems: "center", justifyContent: "center" },
  revenueCopy: { flex: 1, alignItems: "flex-end", paddingLeft: 13 },
  revenueLabel: { color: "#D5F6E8", fontSize: 13, fontWeight: "800", textAlign: "right" },
  revenueValue: { color: "#FFFFFF", fontSize: 32, lineHeight: 40, fontWeight: "900", marginTop: 4, textAlign: "right" },
  revenueMeta: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 6, marginTop: 14 },
  metaLabel: { color: "#D5F6E8", fontSize: 11 },
  metaValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  metaDivider: { width: 1, height: 17, backgroundColor: "#64CBA6", marginHorizontal: 5 },
  shiftNotice: { minHeight: 62, borderRadius: 22, backgroundColor: COLORS.deep, marginTop: 14, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  shiftNoticeSoon: { backgroundColor: COLORS.warning },
  shiftNoticeOverdue: { backgroundColor: COLORS.danger },
  shiftNoticeIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  shiftNoticeText: { flex: 1, color: "#FFFFFF", fontSize: 11.5, fontWeight: "800", lineHeight: 18, textAlign: "right" },
  expiryNotice: { minHeight: 62, borderRadius: 22, backgroundColor: COLORS.softWarning, marginTop: 14, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  noticeIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.warning, alignItems: "center", justifyContent: "center" },
  noticeText: { flex: 1, color: "#8E462C", fontSize: 13, fontWeight: "900", textAlign: "right" },
  noticeCalm: { backgroundColor: COLORS.mint },
  noticeIconCalm: { backgroundColor: COLORS.primary },
  noticeTextCalm: { color: COLORS.primary },
  sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "900", textAlign: "right", marginTop: 31, marginBottom: 13 },
  unitGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  unitTile: { width: "30%", minHeight: 132, borderRadius: 25, backgroundColor: "#FAF9F6", alignItems: "center", justifyContent: "center", padding: 12, position: "relative" },
  unitIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  unitLabel: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "center" },
  unitCount: { position: "absolute", top: 9, left: 9, minWidth: 21, height: 21, borderRadius: 11, backgroundColor: COLORS.warning, alignItems: "center", justifyContent: "center" },
  unitCountText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  statusLine: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 23 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.warning },
  statusDotReady: { backgroundColor: COLORS.primary },
  statusText: { color: COLORS.muted, fontSize: 10, fontWeight: "700" },
});
