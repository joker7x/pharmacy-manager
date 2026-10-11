import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Card, COLORS, PageHeader, PharmacyMark, RoundIcon, commonStyles } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useStaffSession } from "@/lib/staff-session";
import { usePharmacy } from "@/lib/pharmacy-context";
import type { StaffPermission } from "@/lib/staff-access";
import { trpc } from "@/lib/trpc";

type Destination = { title: string; subtitle: string; icon: Parameters<typeof RoundIcon>[0]["name"]; path: string; permission?: StaffPermission; ownerOnly?: boolean; badge?: number };
type Tone = "green" | "aqua" | "peach" | "orange" | "dark";

const TONES: Record<Tone, { background: string; color: string }> = {
  green: { background: "#E9F8F1", color: COLORS.primary },
  aqua: { background: "#CFF2E7", color: "#2F9D83" },
  peach: { background: "#FCE4D7", color: "#D66A42" },
  orange: { background: COLORS.softWarning, color: COLORS.warning },
  dark: { background: COLORS.deep, color: "#82E3C0" },
};

const inventoryGroup: Destination[] = [
  { title: "المخزون", subtitle: "الأصناف والوحدات والصلاحية وحد إعادة الطلب", icon: "shippingbox.fill", path: "/(tabs)/inventory", permission: "inventory.view" },
  { title: "دليل الأدوية والأسعار", subtitle: "بحث بالاسم والباركود ومتابعة التغيرات", icon: "books.vertical.fill", path: "/catalog", permission: "inventory.view" },
];
const supply: Destination[] = [
  { title: "الطلبيات والفواتير", subtitle: "تسجيل توريد الموردين وحفظ الفواتير", icon: "doc.text.fill", path: "/orders", permission: "orders.manage" },
  { title: "الموردون", subtitle: "جهات التوريد وسجلها الإحصائي", icon: "truck.box.fill", path: "/suppliers", permission: "orders.manage" },
];
const cash: Destination[] = [
  { title: "الورديات", subtitle: "بدء وردية وإغلاقها بمطابقة نقدية", icon: "clock.fill", path: "/shifts", permission: "shifts.manage" },
  { title: "المصروفات", subtitle: "تشغيل وتوريد ومتابعة الإجمالي", icon: "arrow.down.circle.fill", path: "/expenses", permission: "expenses.manage" },
  { title: "حسابات العملاء", subtitle: "الآجل والمدفوع والمتبقي", icon: "person.crop.circle.fill", path: "/debts", permission: "sales.use" },
];
const followUp: Destination[] = [
  { title: "التقارير التشغيلية", subtitle: "المبيعات وحركة الأصناف", icon: "chart.line.uptrend.xyaxis", path: "/reports", permission: "reports.view" },
];
const setup: Destination[] = [
  { title: "لوحة المالك", subtitle: "تجميع بيانات الصيدلية والأفراد — للمالك فقط", icon: "person.crop.circle.fill", path: "/owner-console", ownerOnly: true },
  { title: "الحساب والدخول", subtitle: "تسجيل دخول المسؤول أو إنشاء حساب مالك الصيدلية", icon: "person.crop.circle.fill", path: "/login" },
  { title: "إعدادات الصيدلية", subtitle: "إدارة البيانات وإعدادات التطبيق", icon: "gearshape.fill", path: "/settings", permission: "staff.manage" },
  { title: "أفراد الصيدلية", subtitle: "الحسابات والصلاحيات والجلسات وسجل النشاط", icon: "person.3.fill", path: "/staff-admin", permission: "staff.manage" },
];

export default function MoreScreen() {
  const { staff, can, logout } = useStaffSession();
  const { medications, incomingOrders } = usePharmacy();
  const inbox = trpc.staff.notifications.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const unread = inbox.data?.filter((item) => !item.readAt).length ?? 0;
  const lowStock = useMemo(() => medications.filter((medication) => medication.quantity <= medication.reorderLevel).length, [medications]);
  const pendingOrders = useMemo(() => incomingOrders.filter((order) => order.status !== "تم الاستلام").length, [incomingOrders]);

  const followUpItems: Destination[] = [
    ...followUp,
    { title: "الإشعارات", subtitle: "رسائل موجهة إليك من إدارة الصيدلية", icon: "bell.fill", path: "/notifications", badge: unread },
  ];

  const withBadges = (items: Destination[]) => items.map((item) => {
    if (item.title === "المخزون" && lowStock) return { ...item, badge: lowStock };
    if (item.title === "الطلبيات والفواتير" && pendingOrders) return { ...item, badge: pendingOrders };
    return item;
  });
  const visible = (items: Destination[]) => withBadges(items).filter((item) => (!item.ownerOnly || staff?.role === "owner") && (!item.permission || can(item.permission)));
  const group = (heading: string, tone: Tone, items: Destination[]) => (visible(items).length ? <Section heading={heading} tone={tone} items={visible(items)} /> : null);

  return <ScreenContainer className="flex-1"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={commonStyles.content}><PageHeader title="الإدارة" subtitle="أدوات الصيدلية مرتبة حسب المهمة، لا حسب التعقيد" />
    <View style={styles.identity}><PharmacyMark inverse size="small" /><View style={styles.identityText}><Text style={styles.identityTitle}>{staff?.displayName ?? "صيدليتي"}</Text><Text style={styles.identitySubtitle}>{staff ? `${staff.username} · ${staff.role}` : "تشغيل محلي منظم، سريع، وقابل للمراجعة"}</Text></View><View style={styles.localPill}><View style={styles.localDot} /><Text style={styles.localPillText}>محلي</Text></View></View>
    {!staff ? <TouchableOpacity onPress={() => router.push("/staff-admin")} style={styles.loginNotice} activeOpacity={0.85}><View style={styles.loginText}><Text style={styles.loginTitle}>لم تسجّل الدخول بعد</Text><Text style={styles.loginSubtitle}>أدخل باسمك لتفعيل إدارة الأفراد والإشعارات وسجل النشاط.</Text></View><IconSymbol name="chevron.left" size={17} color={COLORS.primary} /></TouchableOpacity> : null}
    {group("المخزون والأصناف", "green", inventoryGroup)}
    {group("التوريد", "aqua", supply)}
    {group("الصندوق والحسابات", "peach", cash)}
    {group("المتابعة", "orange", followUpItems)}
    {group("الإعدادات", "dark", setup)}
    {staff ? <TouchableOpacity onPress={() => void logout()} style={styles.logout} activeOpacity={0.8}><IconSymbol name="rectangle.portrait.and.arrow.right" size={17} color={COLORS.danger} /><Text style={styles.logoutText}>تسجيل الخروج من {staff.displayName}</Text></TouchableOpacity> : null}
    <View style={styles.footerNote}><IconSymbol name="checkmark.circle.fill" size={14} color={COLORS.primary} /><Text style={styles.footerText}>بيانات التشغيل الأساسية محفوظة على هذا الجهاز</Text></View>
  </ScrollView></ScreenContainer>;
}

function Section({ heading, tone, items }: { heading: string; tone: Tone; items: Destination[] }) {
  const colors = TONES[tone];
  return <View style={styles.section}><View style={styles.sectionHead}><View style={[styles.sectionAccent, { backgroundColor: colors.color }]} /><Text style={styles.sectionHeading}>{heading}</Text><Text style={styles.sectionCount}>{items.length.toLocaleString("ar-EG")} أدوات</Text></View>
    <Card style={styles.menu}>{items.map((item, index) => <TouchableOpacity key={item.title} onPress={() => router.push(item.path as never)} style={[styles.menuItem, index < items.length - 1 && styles.menuBorder]} activeOpacity={0.75}><RoundIcon name={item.icon} color={colors.color} background={tone === "dark" ? "#12312B" : colors.background} /><View style={styles.menuText}><Text style={styles.menuTitle}>{item.title}</Text><Text style={styles.menuSubtitle}>{item.subtitle}</Text></View>{item.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{item.badge.toLocaleString("ar-EG")}</Text></View> : null}<IconSymbol name="chevron.left" size={17} color={COLORS.muted} /></TouchableOpacity>)}</Card>
  </View>;
}

const styles = StyleSheet.create({
  identity: { backgroundColor: COLORS.deep, borderRadius: 24, padding: 16, flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  identityText: { flex: 1, alignItems: "flex-end" },
  identityTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", textAlign: "right" },
  identitySubtitle: { color: "#BDE5D4", fontSize: 10, marginTop: 4, textAlign: "right" },
  localPill: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderRadius: 9, borderWidth: 1, borderColor: "#477A6D", paddingHorizontal: 8, paddingVertical: 5 },
  localDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#82E3C0" },
  localPillText: { color: "#D6F2E7", fontSize: 9, fontWeight: "900" },
  loginNotice: { flexDirection: "row-reverse", alignItems: "center", gap: 11, marginTop: 12, backgroundColor: COLORS.mint, borderColor: COLORS.mint, borderWidth: 1, borderRadius: 20, padding: 13 },
  loginText: { flex: 1, alignItems: "flex-end" },
  loginTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right" },
  loginSubtitle: { color: "#2A5C4C", fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "right" },
  section: { marginTop: 26 },
  sectionHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10, paddingHorizontal: 2 },
  sectionAccent: { width: 4, height: 16, borderRadius: 2 },
  sectionHeading: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right", flex: 1 },
  sectionCount: { color: COLORS.muted, fontSize: 10, fontWeight: "700" },
  menu: { paddingHorizontal: 14, paddingVertical: 0, borderRadius: 24 },
  menuItem: { flexDirection: "row-reverse", alignItems: "center", gap: 11, paddingVertical: 14 },
  menuBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  menuText: { flex: 1, alignItems: "flex-end" },
  menuTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900", textAlign: "right" },
  menuSubtitle: { color: COLORS.muted, fontSize: 10.5, lineHeight: 16, marginTop: 3, textAlign: "right" },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: COLORS.warning, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  logout: { minHeight: 50, marginTop: 26, borderRadius: 18, borderWidth: 1, borderColor: COLORS.softDanger, flexDirection: "row-reverse", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1EE" },
  logoutText: { color: COLORS.danger, fontSize: 12, fontWeight: "900" },
  footerNote: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18 },
  footerText: { color: COLORS.muted, fontSize: 10, fontWeight: "700" },
});
