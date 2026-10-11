import * as Linking from "expo-linking";
import { router } from "expo-router";
import { ReactNode, memo, useCallback, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Badge, Card, COLORS, PageHeader, RoundIcon, SectionTitle, commonStyles } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Supplier, formatCurrency, formatShortDate, usePharmacy } from "@/lib/pharmacy-context";
import { SupplierStats, formatCount, formatDays, getSupplierStats } from "@/lib/supplier-stats";
import { ScreenContainer } from "@/components/screen-container";

type DraftSupplier = { company: string; name: string; phone: string };
type DraftErrors = Partial<Record<keyof DraftSupplier, string>>;

const initialDraft = (): DraftSupplier => ({ company: "", name: "", phone: "" });

function validate(draft: DraftSupplier): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.company.trim()) errors.company = "اكتب اسم الشركة أو المخزن.";
  if (!draft.name.trim()) errors.name = "اكتب اسم شخص يمكن التواصل معه.";
  const digits = draft.phone.replace(/\D/g, "");
  if (!digits) errors.phone = "اكتب رقم هاتف للتواصل.";
  else if (digits.length < 8) errors.phone = "الرقم يبدو قصيرًا، اكتبه كاملًا.";
  return errors;
}

function matches(supplier: Supplier, term: string) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;
  return [supplier.company, supplier.name, supplier.phone].some((value) => (value ?? "").toLowerCase().includes(normalized));
}

function ordersCaption(count: number) {
  if (count === 1) return "مبني على طلب واحد محفوظ على هذا الجهاز.";
  if (count === 2) return "مبني على طلبين محفوظين على هذا الجهاز.";
  return `مبني على ${count.toLocaleString("ar-EG")} طلبيات محفوظة على هذا الجهاز.`;
}

export default function SuppliersScreen() {
  const { suppliers, addSupplier, deleteSupplier, incomingOrders } = usePharmacy();
  const [query, setQuery] = useState("");
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [draft, setDraft] = useState<DraftSupplier>(initialDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [notice, setNotice] = useState<{ title: string; subtitle: string }>();
  const [pendingDelete, setPendingDelete] = useState<string>();
  const [statsFor, setStatsFor] = useState<Supplier>();

  const filtered = useMemo(() => suppliers.filter((supplier) => matches(supplier, query)), [suppliers, query]);
  const statsById = useMemo(() => {
    const stats = new Map<string, SupplierStats>();
    for (const supplier of suppliers) stats.set(supplier.id, getSupplierStats(supplier, incomingOrders));
    return stats;
  }, [suppliers, incomingOrders]);

  const updateDraft = <K extends keyof DraftSupplier>(key: K, value: DraftSupplier[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const closeForm = () => { setIsFormVisible(false); setDraft(initialDraft()); setErrors({}); };
  const openForm = () => { setNotice(undefined); setDraft(initialDraft()); setErrors({}); setIsFormVisible(true); };

  const saveSupplier = () => {
    const nextErrors = validate(draft);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    const company = draft.company.trim();
    addSupplier({ company, name: draft.name.trim(), phone: draft.phone.trim() });
    setIsFormVisible(false);
    setDraft(initialDraft());
    setErrors({});
    setNotice({ title: `تمت إضافة «${company}»`, subtitle: "يمكنك الآن اختيارها عند تسجيل طلب وارد، واضغط هنا للإخفاء." });
  };

  const confirmDelete = (supplier: Supplier) => {
    deleteSupplier(supplier.id);
    setPendingDelete(undefined);
    setNotice({ title: `تم حذف «${supplier.company}»`, subtitle: "الطلبيات المحفوظة بهذه الجهة باقية كما هي، واضغط هنا للإخفاء." });
  };

  const renderSupplier = useCallback(({ item }: { item: Supplier }) => (
    <SupplierCard
      supplier={item}
      stats={statsById.get(item.id) ?? getSupplierStats(item, [])}
      isConfirming={pendingDelete === item.id}
      onOpenStats={() => setStatsFor(item)}
      onRequestDelete={() => setPendingDelete(item.id)}
      onCancelDelete={() => setPendingDelete(undefined)}
      onConfirmDelete={() => confirmDelete(item)}
    />
  ), [statsById, pendingDelete]);
  const renderSeparator = useCallback(() => <View style={styles.listSeparator} />, []);

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1"><FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={renderSupplier} ItemSeparatorComponent={renderSeparator} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={commonStyles.content} ListHeaderComponent={<><TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.75}><IconSymbol name="chevron.right" size={20} color={COLORS.ink} /><Text style={styles.backText}>رجوع</Text></TouchableOpacity><PageHeader title="الموردون" subtitle={`${suppliers.length.toLocaleString("ar-EG")} جهات توريد مسجلة`} /><View style={styles.searchBox}><TextInput value={query} onChangeText={setQuery} placeholder="ابحث باسم الجهة أو المسؤول أو الهاتف" placeholderTextColor="#99A5A3" style={styles.searchInput} autoCapitalize="none" /><IconSymbol name="magnifyingglass" size={19} color={COLORS.muted} /></View><TouchableOpacity onPress={openForm} style={commonStyles.primaryButton} activeOpacity={0.85}><IconSymbol name="plus.circle.fill" size={19} color="#FFFFFF" /><Text style={commonStyles.primaryButtonText}>إضافة مورد جديد</Text></TouchableOpacity>{notice ? <TouchableOpacity onPress={() => setNotice(undefined)} style={styles.savedBanner} activeOpacity={0.85}><View style={styles.savedText}><Text style={styles.savedTitle}>{notice.title}</Text><Text style={styles.savedSubtitle}>{notice.subtitle}</Text></View><IconSymbol name="checkmark.circle.fill" size={21} color={COLORS.primary} /></TouchableOpacity> : null}<SectionTitle title={query ? `نتائج البحث (${filtered.length.toLocaleString("ar-EG")})` : `قائمة الموردين (${filtered.length.toLocaleString("ar-EG")})`} /></>} ListEmptyComponent={<Card style={styles.emptyCard}><RoundIcon name="truck.box.fill" color={COLORS.muted} background="#EEF3F1" /><Text style={styles.emptyTitle}>{suppliers.length ? "لا توجد جهة مطابقة" : "لم تُسجّل أي جهة توريد بعد"}</Text><Text style={styles.emptySubtitle}>{suppliers.length ? "جرّب بحثًا باسم أقصر أو رقم هاتف." : "أضف الشركات والمكاتب التي تتعامل معها ليصبح اختيارها أسرع في الطلبيات."}</Text><TouchableOpacity onPress={suppliers.length ? () => setQuery("") : openForm} style={commonStyles.secondaryButton} activeOpacity={0.85}>{suppliers.length ? <Text style={commonStyles.secondaryButtonText}>مسح البحث</Text> : <><IconSymbol name="plus.circle.fill" size={19} color={COLORS.primary} /><Text style={commonStyles.secondaryButtonText}>إضافة أول مورد</Text></>}</TouchableOpacity></Card>} />
  <SupplierForm visible={isFormVisible} draft={draft} errors={errors} onChange={updateDraft} onClose={closeForm} onSave={saveSupplier} />
  <SupplierStatsSheet supplier={statsFor} stats={statsFor ? statsById.get(statsFor.id) ?? getSupplierStats(statsFor, []) : undefined} onClose={() => setStatsFor(undefined)} />
  </ScreenContainer>;
}

type SupplierCardProps = { supplier: Supplier; stats: SupplierStats; isConfirming: boolean; onOpenStats: () => void; onRequestDelete: () => void; onCancelDelete: () => void; onConfirmDelete: () => void };

const SupplierCard = memo(function SupplierCard({ supplier, stats, isConfirming, onOpenStats, onRequestDelete, onCancelDelete, onConfirmDelete }: SupplierCardProps) {
  const orderLabel = stats.orderCount === 1 ? "طلب واحد" : stats.orderCount === 2 ? "طلبان" : `${formatCount(stats.orderCount)} طلبيات`;
  return <Card style={[styles.supplierCard, isConfirming && styles.supplierCardConfirm]}>
    <TouchableOpacity onPress={onOpenStats} activeOpacity={0.85} style={styles.cardHead}><RoundIcon name="truck.box.fill" /><View style={styles.supplierText}><Text style={styles.supplierName}>{supplier.company}</Text><Text style={styles.contact}>مسؤول التوريد: {supplier.name}</Text></View>{stats.orderCount ? <Badge label={orderLabel} tone="success" /> : null}</TouchableOpacity>
    <TouchableOpacity onPress={onOpenStats} activeOpacity={0.85} style={styles.statsStrip}><Metric label="إجمالي الطلبيات" value={stats.knownTotalCount ? formatCurrency(stats.total) : "—"} /><View style={styles.metricDivider} /><Metric label="متوسط الطلب" value={stats.knownTotalCount ? formatCurrency(stats.average) : "—"} /><View style={styles.metricDivider} /><Metric label="آخر طلب" value={stats.lastOrderAt ? formatShortDate(stats.lastOrderAt) : "لم يُطلب بعد"} /><IconSymbol name="chevron.left" size={16} color={COLORS.muted} /></TouchableOpacity>
    <View style={commonStyles.rowDivider} />
    {isConfirming ? <View style={styles.confirmBlock}><Text style={styles.confirmText}>{stats.orderCount ? "حذف المورد لن يمس الطلبيات المحفوظة بهذه الجهة." : "سيُحذف المورد من القائمة على هذا الجهاز."}</Text><View style={styles.confirmActions}><TouchableOpacity onPress={onConfirmDelete} style={styles.deleteButton} activeOpacity={0.85}><IconSymbol name="trash" size={16} color="#FFFFFF" /><Text style={styles.deleteButtonText}>تأكيد الحذف</Text></TouchableOpacity><TouchableOpacity onPress={onCancelDelete} style={styles.keepButton} activeOpacity={0.8}><Text style={styles.keepButtonText}>إلغاء</Text></TouchableOpacity></View></View> : <View style={styles.supplierFooter}><Text style={styles.orderText}>{supplier.lastOrder}</Text><View style={styles.footerActions}><TouchableOpacity onPress={() => Linking.openURL(`tel:${supplier.phone}`)} style={styles.callButton} activeOpacity={0.8}><Text style={styles.phone}>{supplier.phone}</Text><IconSymbol name="phone.fill" size={15} color={COLORS.primary} /></TouchableOpacity><TouchableOpacity onPress={onRequestDelete} style={styles.deleteChip} activeOpacity={0.8}><IconSymbol name="trash" size={16} color={COLORS.danger} /></TouchableOpacity></View></View>}
  </Card>;
});

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></View>;
}

type SupplierFormProps = {
  visible: boolean;
  draft: DraftSupplier;
  errors: DraftErrors;
  onChange: <K extends keyof DraftSupplier>(key: K, value: DraftSupplier[K]) => void;
  onClose: () => void;
  onSave: () => void;
};

function SupplierForm({ visible, draft, errors, onChange, onClose, onSave }: SupplierFormProps) {
  const hasErrors = Boolean(errors.company || errors.name || errors.phone);
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1"><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.formBody}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
      <View style={styles.modalHeader}><TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.75}><IconSymbol name="xmark" size={21} color={COLORS.ink} /></TouchableOpacity><View style={styles.modalHeaderText}><Text style={styles.modalTitle}>إضافة مورد</Text><Text style={styles.modalSubtitle}>ثلاثة بيانات أساسية تكفي للرجوع إليه لاحقًا</Text></View></View>
      <Card style={styles.helperCard}><RoundIcon name="person.crop.circle.fill" /><View style={styles.helperText}><Text style={styles.helperTitle}>لماذا نطلب المسؤول والهاتف؟</Text><Text style={styles.helperSubtitle}>اسم الجهة يظهر في الطلبيات والفواتير، والمسؤول والهاتف يوفّران عليك البحث عن الرقم وقت الاستلام.</Text></View></Card>
      <Field label="اسم الشركة أو المخزن *" value={draft.company} onChangeText={(value) => onChange("company", value)} placeholder="مثال: المتحدة للأدوية" error={errors.company} autoCapitalize="none" />
      <Field label="اسم مسؤول التوريد *" value={draft.name} onChangeText={(value) => onChange("name", value)} placeholder="مثال: سارة عادل" error={errors.name} autoCapitalize="none" />
      <Field label="رقم الهاتف *" value={draft.phone} onChangeText={(value) => onChange("phone", value)} placeholder="مثال: 0122 880 5431" keyboardType="phone-pad" error={errors.phone} />
    </ScrollView>
    <View style={styles.formFooter}>{hasErrors ? <Text style={styles.footerError}>أكمل البيانات المطلوبة ثم احفظ المورد.</Text> : <Text style={styles.footerHint}>كل شيء يُحفظ محليًا على جهاز الصيدلية.</Text>}<TouchableOpacity onPress={onSave} style={commonStyles.primaryButton} activeOpacity={0.85}><IconSymbol name="checkmark.circle.fill" size={19} color="#FFFFFF" /><Text style={commonStyles.primaryButtonText}>حفظ المورد</Text></TouchableOpacity></View>
  </KeyboardAvoidingView></ScreenContainer></Modal>;
}

type StatsSheetProps = { supplier?: Supplier; stats?: SupplierStats; onClose: () => void };

function SupplierStatsSheet({ supplier, stats, onClose }: StatsSheetProps) {
  const goNewOrder = () => { onClose(); router.push("/orders"); };
  return <Modal visible={Boolean(supplier && stats)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1">
    <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
      <View style={styles.modalHeader}><TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.75}><IconSymbol name="xmark" size={21} color={COLORS.ink} /></TouchableOpacity><View style={styles.modalHeaderText}><Text style={styles.modalTitle}>{supplier?.company}</Text><Text style={styles.modalSubtitle}>سجل المورد من طلبياتك المحفوظة على الجهاز</Text></View></View>
      {supplier && stats ? <>
        {supplier.phone ? <TouchableOpacity onPress={() => Linking.openURL(`tel:${supplier.phone}`)} style={styles.contactRow} activeOpacity={0.8}><Text style={styles.contactName}>مسؤول التوريد: {supplier.name}</Text><View style={styles.callButton}><Text style={styles.phone}>{supplier.phone}</Text><IconSymbol name="phone.fill" size={15} color={COLORS.primary} /></View></TouchableOpacity> : null}
        <View style={styles.heroCard}><Text style={styles.heroEyebrow}>إجمالي التوريد المسجل</Text><Text style={styles.heroValue}>{stats.knownTotalCount ? formatCurrency(stats.total) : "لا توجد قيم مسجلة"}</Text><View style={styles.heroMeta}><Text style={styles.heroMetaValue}>{formatCount(stats.orderCount)}</Text><Text style={styles.heroMetaLabel}>طلبيات</Text><View style={styles.heroDivider} /><Text style={styles.heroMetaValue}>{formatCount(stats.itemsQuantity)}</Text><Text style={styles.heroMetaLabel}>صنف مُورد</Text><View style={styles.heroDivider} /><Text style={styles.heroMetaValue}>{stats.lastOrderAt ? formatShortDate(stats.lastOrderAt) : "—"}</Text><Text style={styles.heroMetaLabel}>آخر طلب</Text></View></View>
        <View style={styles.kpiGrid}><KpiTile icon="cart.fill" label="عدد الطلبيات" value={formatCount(stats.orderCount)} /><KpiTile icon="creditcard.fill" label="متوسط الطلب" value={stats.knownTotalCount ? formatCurrency(stats.average) : "—"} /><KpiTile icon="checkmark.circle.fill" label="تم استلامها" value={`${formatCount(stats.receivedCount)} من ${formatCount(stats.orderCount)}`} /><KpiTile icon="clock.fill" label="لم تُستلم بعد" value={formatCount(stats.pendingCount)} /></View>
        {stats.orderCount ? <>
          <StatsSection title="إيقاع التعامل"><StatRow label="أول تعامل مع الجهة" value={stats.firstOrderAt ? formatShortDate(stats.firstOrderAt) : "—"} /><StatRow label="آخر طلب وارد" value={stats.lastOrderAt ? formatShortDate(stats.lastOrderAt) : "—"} /><StatRow label="متوسط الفترة بين الطلبات" value={formatDays(stats.averageGapDays)} /></StatsSection>
          <StatsSection title="حالة الطلبيات"><ShareBar label="تم استلامها" value={stats.receivedCount} total={stats.orderCount} color={COLORS.primary} /><ShareBar label="قيد الانتظار أو الإرسال" value={stats.pendingCount} total={stats.orderCount} color={COLORS.warning} /></StatsSection>
          <StatsSection title="الفواتير"><ShareBar label="مرفق بها صورة فاتورة" value={stats.invoiceCount} total={stats.orderCount} color={COLORS.primary} /><Text style={styles.sectionNote}>{formatCount(stats.invoiceShare)}% من طلبيات هذه الجهة عليها فاتورة مصورة تُرجع إليها وقت المراجعة.</Text></StatsSection>
          <StatsSection title="أكبر وأصغر طلب"><StatRow label="أكبر طلب" value={stats.largest?.total !== undefined ? formatCurrency(stats.largest.total) : "—"} hint={stats.largest ? formatShortDate(stats.largest.createdAt) : undefined} /><StatRow label="أصغر طلب" value={stats.smallest?.total !== undefined ? formatCurrency(stats.smallest.total) : "—"} hint={stats.smallest ? formatShortDate(stats.smallest.createdAt) : undefined} /><StatRow label="طلبيات بلا قيمة مسجلة" value={formatCount(stats.orderCount - stats.knownTotalCount)} /></StatsSection>
          <StatsSection title="أكثر الأصناف طلبًا">{stats.topItems.length ? stats.topItems.map((item, index) => <View key={item.name} style={styles.itemRow}><Text style={styles.itemIndex}>{index + 1}</Text><View style={styles.itemText}><Text style={styles.itemName} numberOfLines={1}>{item.name}</Text><Text style={styles.itemMeta}>{formatCount(item.quantity)} وحدة{item.cost ? ` · ${formatCurrency(item.cost)}` : ""}</Text></View></View>) : <Text style={styles.sectionNote}>لم تُسجَّل أصناف في طلبيات هذه الجهة. تُضاف تلقائيًا عند استلام الطلب، وبعدها يظهر توزيع الأصناف هنا.</Text>}</StatsSection>
        </> : <Card style={styles.noOrdersCard}><RoundIcon name="doc.text.fill" color={COLORS.muted} background="#EEF3F1" /><Text style={styles.noOrdersTitle}>لا توجد طلبيات لهذه الجهة بعد</Text><Text style={styles.noOrdersText}>سجّل أول طلب وارد منها لتبدأ الإحصائيات في الامتلاء: القيم، الفواتير، والأصناف الموردة.</Text><TouchableOpacity onPress={goNewOrder} style={commonStyles.primaryButton} activeOpacity={0.85}><IconSymbol name="plus.circle.fill" size={19} color="#FFFFFF" /><Text style={commonStyles.primaryButtonText}>تسجيل طلب وارد</Text></TouchableOpacity></Card>}
      </> : null}
    </ScrollView>
    <View style={styles.formFooter}><Text style={styles.footerHint}>{stats?.orderCount ? ordersCaption(stats.orderCount) : "الأرقام تتحدث فور حفظ أي طلب وارد."}</Text><TouchableOpacity onPress={stats?.orderCount ? onClose : goNewOrder} style={commonStyles.secondaryButton} activeOpacity={0.85}><Text style={commonStyles.secondaryButtonText}>{stats?.orderCount ? "إغلاق السجل" : "الذهاب للطلبيات"}</Text></TouchableOpacity></View>
  </ScreenContainer></Modal>;
}

function KpiTile({ icon, label, value }: { icon: Parameters<typeof IconSymbol>[0]["name"]; label: string; value: string }) {
  return <View style={styles.kpiTile}><View style={styles.kpiIcon}><IconSymbol name={icon} size={17} color={COLORS.primary} /></View><Text style={styles.kpiValue} numberOfLines={1}>{value}</Text><Text style={styles.kpiLabel}>{label}</Text></View>;
}

function StatsSection({ title, children }: { title: string; children: ReactNode }) {
  return <Card style={styles.statsCard}><Text style={styles.statsCardTitle}>{title}</Text><View style={styles.statsCardBody}>{children}</View></Card>;
}

function StatRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <View style={styles.statRow}><View style={styles.statLabelText}><Text style={styles.statLabel}>{label}</Text>{hint ? <Text style={styles.statHint}>{hint}</Text> : null}</View><Text style={styles.statValue}>{value}</Text></View>;
}

function ShareBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return <View style={styles.barRow}><View style={styles.barHead}><Text style={styles.barLabel}>{label}</Text><Text style={styles.barValue}>{formatCount(value)} من {formatCount(total)}</Text></View><View style={styles.barTrack}><View style={[styles.barFill, { width: `${percent}%`, backgroundColor: color }]} /></View></View>;
}

function Field({ label, error, ...props }: { label: string; error?: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={commonStyles.inputGroup}><Text style={commonStyles.inputLabel}>{label}</Text><TextInput {...props} textAlign="right" style={[commonStyles.input, Boolean(error) && styles.inputError]} placeholderTextColor="#99A5A3" />{error ? <Text style={styles.inlineError}>{error}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  back: { flexDirection: "row-reverse", alignSelf: "flex-end", alignItems: "center", gap: 3, marginBottom: 13, paddingVertical: 4 }, backText: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
  searchBox: { flexDirection: "row-reverse", alignItems: "center", gap: 9, backgroundColor: "#F2F1EE", borderWidth: 1, borderColor: "#F2F1EE", borderRadius: 21, minHeight: 54, paddingHorizontal: 16, marginBottom: 14 }, searchInput: { flex: 1, color: COLORS.ink, fontSize: 15, textAlign: "right", writingDirection: "rtl", paddingVertical: 14 },
  savedBanner: { flexDirection: "row-reverse", alignItems: "center", gap: 11, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 22, padding: 14, marginTop: 14 }, savedText: { flex: 1, alignItems: "flex-end" }, savedTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right" }, savedSubtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "right" },
  listSeparator: { height: 12 }, supplierCard: { backgroundColor: "#F2F1EE", borderColor: "#F2F1EE", borderRadius: 24, padding: 16 }, supplierCardConfirm: { borderColor: COLORS.softDanger, backgroundColor: COLORS.softDanger }, cardHead: { flexDirection: "row-reverse", alignItems: "center", gap: 12 }, statsStrip: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 2 }, metric: { flex: 1, alignItems: "flex-end" }, metricLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "700", textAlign: "right" }, metricValue: { color: COLORS.ink, fontSize: 12, fontWeight: "900", marginTop: 3, textAlign: "right" }, metricDivider: { width: 1, height: 26, backgroundColor: COLORS.border }, supplierText: { flex: 1, alignItems: "flex-end" }, supplierName: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right" }, contact: { color: COLORS.muted, fontSize: 12, marginTop: 4, textAlign: "right" }, supplierFooter: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 }, footerActions: { flexDirection: "row-reverse", alignItems: "center", gap: 8 }, orderText: { color: COLORS.muted, fontSize: 11, fontWeight: "700" }, callButton: { flexDirection: "row-reverse", alignItems: "center", gap: 7, backgroundColor: COLORS.mint, borderRadius: 14, paddingHorizontal: 12, minHeight: 36 }, phone: { color: COLORS.primary, fontSize: 12, fontWeight: "900", writingDirection: "ltr" }, deleteChip: { width: 36, height: 36, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  confirmBlock: { gap: 11 }, confirmText: { color: "#8A3A2E", fontSize: 11, lineHeight: 18, fontWeight: "700", textAlign: "right" }, confirmActions: { flexDirection: "row-reverse", gap: 9 }, deleteButton: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, borderRadius: 15, backgroundColor: COLORS.danger }, deleteButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, keepButton: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface }, keepButtonText: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
  contactRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }, contactName: { flex: 1, color: COLORS.muted, fontSize: 12, fontWeight: "700", textAlign: "right" },
  heroCard: { backgroundColor: COLORS.deep, borderRadius: 26, padding: 18, marginBottom: 14 }, heroEyebrow: { color: "#A9B6B2", fontSize: 11, fontWeight: "800", textAlign: "right" }, heroValue: { color: "#FFFFFF", fontSize: 27, lineHeight: 36, fontWeight: "900", marginTop: 6, textAlign: "right" }, heroMeta: { flexDirection: "row-reverse", alignItems: "center", gap: 9, marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#1E3A34", paddingTop: 13 }, heroMetaValue: { color: "#82E3C0", fontSize: 13, fontWeight: "900" }, heroMetaLabel: { color: "#A9B6B2", fontSize: 10, marginLeft: 2 }, heroDivider: { width: 1, height: 18, backgroundColor: "#1E3A34" },
  kpiGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginBottom: 4 }, kpiTile: { width: "48.5%", flexGrow: 1, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14 }, kpiIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: COLORS.mint, alignItems: "center", justifyContent: "center", marginBottom: 10, alignSelf: "flex-end" }, kpiValue: { color: COLORS.ink, fontSize: 16, fontWeight: "900", textAlign: "right" }, kpiLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "700", marginTop: 4, textAlign: "right" },
  statsCard: { marginTop: 14, borderRadius: 24 }, statsCardTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right", marginBottom: 6 }, statsCardBody: { gap: 4 },
  statRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }, statLabelText: { flex: 1, alignItems: "flex-end" }, statLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "700", textAlign: "right" }, statHint: { color: COLORS.muted, fontSize: 10, marginTop: 2, textAlign: "right" }, statValue: { color: COLORS.primary, fontSize: 13, fontWeight: "900", writingDirection: "rtl" },
  barRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }, barHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, barLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "700" }, barValue: { color: COLORS.muted, fontSize: 11, fontWeight: "800" }, barTrack: { height: 8, borderRadius: 4, backgroundColor: "#EEF1EF", overflow: "hidden" }, barFill: { height: 8, borderRadius: 4 },
  sectionNote: { color: COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: "right", paddingVertical: 6 },
  itemRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }, itemIndex: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.mint, color: COLORS.primary, fontSize: 11, fontWeight: "900", textAlign: "center", overflow: "hidden" }, itemText: { flex: 1, alignItems: "flex-end" }, itemName: { color: COLORS.ink, fontSize: 12, fontWeight: "800", textAlign: "right" }, itemMeta: { color: COLORS.muted, fontSize: 11, marginTop: 3, textAlign: "right" },
  noOrdersCard: { alignItems: "center", paddingVertical: 26, marginTop: 4 }, noOrdersTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", marginTop: 12, textAlign: "center" }, noOrdersText: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: 18, textAlign: "center", paddingHorizontal: 26 },
  emptyCard: { alignItems: "center", paddingVertical: 28, marginTop: 12 }, emptyTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", marginTop: 12, textAlign: "center" }, emptySubtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: 18, textAlign: "center", paddingHorizontal: 24 },
  formBody: { flex: 1, backgroundColor: COLORS.background }, formContent: { padding: 20, paddingBottom: 26 }, modalHeader: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 12, marginBottom: 18 }, modalHeaderText: { flex: 1, alignItems: "flex-end" }, modalTitle: { color: COLORS.ink, fontSize: 23, fontWeight: "900", textAlign: "right" }, modalSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 4, textAlign: "right" }, closeButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  helperCard: { flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: COLORS.mint, borderColor: COLORS.mint, borderRadius: 22, marginBottom: 20 }, helperText: { flex: 1, alignItems: "flex-end" }, helperTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right" }, helperSubtitle: { color: "#2A5C4C", fontSize: 11, lineHeight: 18, marginTop: 4, textAlign: "right" },
  inputError: { borderColor: COLORS.danger, backgroundColor: COLORS.softDanger }, inlineError: { color: COLORS.danger, fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 6 },
  formFooter: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, backgroundColor: COLORS.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }, footerHint: { color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: "right", marginBottom: 10 }, footerError: { color: COLORS.danger, fontSize: 11, fontWeight: "800", textAlign: "right", marginBottom: 10 },
});
