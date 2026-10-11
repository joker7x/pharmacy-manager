import { useMemo, useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { COLORS, PageHeader, RoundIcon } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useSnackbar } from "@/components/snackbar";
import { usePharmacy, type ReorderNeed } from "@/lib/pharmacy-context";

const num = (value: number) => value.toLocaleString("ar-EG");
const NO_SUPPLIER = "من غير مورد";
const supplierOf = (need: ReorderNeed) => need.supplierName?.trim() || NO_SUPPLIER;

export default function SupplierOrderScreen() {
  const { reorderNeeds, reorderRecords, suppliers, activeShift, commitSupplierOrder, restoreReorderRecords, updateReorderNeed } = usePharmacy();
  const { show } = useSnackbar();
  const open = useMemo(() => reorderNeeds.filter((need) => need.status === "needed"), [reorderNeeds]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("الكل");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [supplierEdits, setSupplierEdits] = useState<Record<string, string>>({});
  const [showSupplierPicker, setShowSupplierPicker] = useState<string | null>(null);
  const supplierNames = useMemo(() => ["الكل", ...Array.from(new Set([...suppliers.map((s) => s.name), ...open.map(supplierOf)])).filter(Boolean)], [suppliers, open]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ar");
    return open.filter((item) => {
      const supplier = supplierEdits[item.medication.id] ?? supplierOf(item);
      return (supplierFilter === "الكل" || supplier === supplierFilter) && (!q || [item.medication.name, item.medication.sku, item.customerName ?? "", supplier].some((value) => value.toLocaleLowerCase("ar").includes(q)));
    }).sort((a, b) => Number(Boolean(b.urgent || b.medication.quantity === 0)) - Number(Boolean(a.urgent || a.medication.quantity === 0)) || a.medication.name.localeCompare(b.medication.name, "ar"));
  }, [open, query, supplierFilter, supplierEdits]);
  const selectedVisible = visible.length > 0 && visible.every((item) => selected.includes(item.medication.id));
  const selectedNeeds = open.filter((item) => selected.includes(item.medication.id));
  const selectedCount = selectedNeeds.length;
  const totalQuantity = selectedNeeds.reduce((sum, item) => sum + Math.max(1, Number.parseInt(quantities[item.medication.id] ?? String(item.desiredQuantity ?? 1), 10) || 1), 0);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const chooseAllVisible = () => setSelected((current) => selectedVisible ? current.filter((id) => !visible.some((item) => item.medication.id === id)) : [...new Set([...current, ...visible.map((item) => item.medication.id)])]);

  const commit = () => {
    if (!selectedCount) return;
    const snapshot = reorderRecords;
    const groups = new Map<string, ReorderNeed[]>();
    selectedNeeds.forEach((need) => {
      const supplier = supplierEdits[need.medication.id] ?? supplierOf(need);
      const list = groups.get(supplier) ?? [];
      list.push(need);
      groups.set(supplier, list);
    });
    let changed = 0;
    groups.forEach((items, supplier) => {
      changed += commitSupplierOrder({ supplier: supplier === NO_SUPPLIER ? null : supplier, orderedIds: items.map((item) => item.medication.id), unavailableIds: [], desiredQuantities: Object.fromEntries(items.map((item) => [item.medication.id, Math.max(1, Number.parseInt(quantities[item.medication.id] ?? String(item.desiredQuantity ?? 1), 10) || 1)])), orderedByName: activeShift?.pharmacistName });
    });
    show({ message: changed ? `تم اعتماد ${num(changed)} صنف كطلب شراء` : "لم يتم تسجيل تغييرات", actionLabel: changed ? "تراجع" : undefined, onAction: () => restoreReorderRecords(snapshot) });
    setSelected([]);
    router.back();
  };

  return <ScreenContainer className="flex-1" containerClassName="bg-background">
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><IconSymbol name="chevron.right" size={18} color={COLORS.ink} /><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
        <PageHeader title="قائمة الشراء" subtitle="اختار الأصناف اللي هتطلبها، راجع الكميات والمورد، وبعدها اعتمد الطلب مرة واحدة." />
        <View style={styles.hero}><View style={styles.heroIcon}><IconSymbol name="shippingbox.fill" size={24} color="#FFFFFF" /></View><View style={styles.heroCopy}><Text style={styles.heroTitle}>تجهيز طلب شراء</Text><Text style={styles.heroSub}>من غير مكالمات أو خطوات منفصلة — حدّد الأصناف واعتمدها كطلب شراء.</Text></View><View style={styles.heroCount}><Text style={styles.heroCountValue}>{num(open.length)}</Text><Text style={styles.heroCountLabel}>صنف مفتوح</Text></View></View>
        <View style={styles.searchBox}><IconSymbol name="magnifyingglass" size={17} color={COLORS.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن دواء أو مورد أو كود..." placeholderTextColor={COLORS.muted} style={styles.searchInput} returnKeyType="search" />{!!query && <TouchableOpacity onPress={() => setQuery("")}><IconSymbol name="xmark.circle.fill" size={17} color={COLORS.muted} /></TouchableOpacity>}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{supplierNames.map((name) => <TouchableOpacity key={name} onPress={() => setSupplierFilter(name)} style={[styles.filter, supplierFilter === name && styles.filterActive]}><Text style={[styles.filterText, supplierFilter === name && styles.filterTextActive]}>{name}</Text></TouchableOpacity>)}</ScrollView>
        <View style={styles.listHeading}><View><Text style={styles.listTitle}>الأصناف الناقصة</Text><Text style={styles.listSub}>{num(visible.length)} صنف ظاهر</Text></View><TouchableOpacity onPress={chooseAllVisible} style={styles.selectAll}><IconSymbol name={selectedVisible ? "checkmark.square.fill" : "square"} size={17} color={COLORS.primary} /><Text style={styles.selectAllText}>{selectedVisible ? "إلغاء تحديد الظاهر" : "تحديد الظاهر"}</Text></TouchableOpacity></View>
        {visible.length ? visible.map((item) => {
          const id = item.medication.id; const checked = selected.includes(id); const urgent = Boolean(item.urgent || item.medication.quantity === 0); const supplier = supplierEdits[id] ?? supplierOf(item); const qty = quantities[id] ?? String(item.desiredQuantity ?? 1);
          return <View key={id} style={[styles.itemCard, checked && styles.itemCardSelected]}>
            <TouchableOpacity onPress={() => toggle(id)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked }}><IconSymbol name={checked ? "checkmark.circle.fill" : "circle"} size={25} color={checked ? COLORS.primary : "#C6CECA"} /></TouchableOpacity>
            <View style={styles.itemBody}><View style={styles.itemTitleRow}><Text style={styles.itemName} numberOfLines={2}>{item.medication.name}</Text>{urgent ? <Text style={styles.urgent}>عاجل</Text> : null}</View>
              <Text style={styles.stockMeta}>{`المتاح ${num(item.medication.quantity)} · حد الطلب ${num(item.medication.reorderLevel)}${item.customerName ? ` · للعميل ${item.customerName}` : ""}`}</Text>{item.notes ? <Text style={styles.note} numberOfLines={1}>{item.notes}</Text> : null}
              <TouchableOpacity style={styles.supplierButton} onPress={() => setShowSupplierPicker(showSupplierPicker === id ? null : id)}><IconSymbol name="building.2.fill" size={13} color={COLORS.primary} /><Text style={styles.supplierButtonText}>{supplier}</Text><IconSymbol name="chevron.down" size={12} color={COLORS.muted} /></TouchableOpacity>
              {showSupplierPicker === id ? <View style={styles.supplierOptions}>{supplierNames.filter((name) => name !== "الكل").map((name) => <TouchableOpacity key={name} onPress={() => { setSupplierEdits((current) => ({ ...current, [id]: name })); updateReorderNeed(id, { supplierName: name === NO_SUPPLIER ? undefined : name }); setShowSupplierPicker(null); }} style={styles.supplierOption}><Text style={styles.supplierOptionText}>{name}</Text>{supplier === name ? <IconSymbol name="checkmark" size={14} color={COLORS.primary} /> : null}</TouchableOpacity>)}</View> : null}
            </View><View style={styles.qtyWrap}><Text style={styles.qtyLabel}>الكمية</Text><TextInput value={qty} onChangeText={(value) => setQuantities((current) => ({ ...current, [id]: value.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" selectTextOnFocus style={styles.qtyInput} /><Text style={styles.qtyUnit}>{item.unit ?? "علبة"}</Text></View>
          </View>;
        }) : <View style={styles.empty}><RoundIcon name="checkmark.circle.fill" color={COLORS.primary} background={COLORS.mint} /><Text style={styles.emptyTitle}>مفيش أصناف مطابقة</Text><Text style={styles.emptyText}>غيّر البحث أو اختار موردًا آخر.</Text></View>}
        <View style={{ height: 120 }} />
      </ScrollView>
      <View style={styles.footer}><View style={styles.footerSummary}><View><Text style={styles.footerCount}>{num(selectedCount)} أصناف محددة</Text><Text style={styles.footerSub}>{`إجمالي الكمية ${num(totalQuantity)} · غير المحدد سيظل في النواقص`}</Text></View><TouchableOpacity onPress={() => setSelected([])} disabled={!selectedCount} style={styles.clearButton}><Text style={[styles.clearText, !selectedCount && { opacity: 0.4 }]}>مسح</Text></TouchableOpacity></View><TouchableOpacity onPress={commit} disabled={!selectedCount} style={[styles.commitButton, !selectedCount && styles.commitDisabled]}><IconSymbol name="checkmark.circle.fill" size={19} color="#FFFFFF" /><Text style={styles.commitText}>اعتماد طلب الشراء</Text><View style={styles.commitCount}><Text style={styles.commitCountText}>{num(selectedCount)}</Text></View></TouchableOpacity></View>
    </View>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  back: { alignSelf: "flex-start", flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: COLORS.border, marginBottom: 5 }, backText: { color: COLORS.ink, fontSize: 12, fontWeight: "800" },
  hero: { flexDirection: "row-reverse", alignItems: "center", gap: 11, backgroundColor: COLORS.deep, borderRadius: 22, padding: 15, marginTop: 10, marginBottom: 15 }, heroIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: "#24564A", alignItems: "center", justifyContent: "center" }, heroCopy: { flex: 1, alignItems: "flex-end", gap: 4 }, heroTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", textAlign: "right" }, heroSub: { color: "#C4D2CD", fontSize: 10.5, lineHeight: 16, textAlign: "right" }, heroCount: { alignItems: "center", backgroundColor: "#FFFFFF16", borderRadius: 13, paddingVertical: 8, paddingHorizontal: 10 }, heroCountValue: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" }, heroCountLabel: { color: "#C4D2CD", fontSize: 9 },
  searchBox: { minHeight: 48, borderRadius: 15, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", gap: 9 }, searchInput: { flex: 1, textAlign: "right", color: COLORS.ink, fontSize: 12, paddingVertical: 10 }, filters: { flexDirection: "row-reverse", gap: 7, paddingVertical: 12 }, filter: { minHeight: 35, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#FFFFFF", paddingHorizontal: 12, justifyContent: "center" }, filterActive: { backgroundColor: COLORS.mint, borderColor: "#B5E1D2" }, filterText: { color: COLORS.muted, fontSize: 11, fontWeight: "800" }, filterTextActive: { color: COLORS.primary },
  listHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 9 }, listTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right" }, listSub: { color: COLORS.muted, fontSize: 10, textAlign: "right", marginTop: 3 }, selectAll: { flexDirection: "row-reverse", alignItems: "center", gap: 5, padding: 8 }, selectAllText: { color: COLORS.primary, fontSize: 11, fontWeight: "800" },
  itemCard: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, padding: 11, marginBottom: 8 }, itemCardSelected: { borderColor: COLORS.primary, backgroundColor: "#F7FCF9" }, check: { width: 28, alignItems: "center", paddingTop: 2 }, itemBody: { flex: 1, alignItems: "flex-end", minWidth: 0 }, itemTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, width: "100%" }, itemName: { flex: 1, color: COLORS.ink, fontSize: 12.5, fontWeight: "900", textAlign: "right", lineHeight: 18 }, urgent: { color: COLORS.danger, backgroundColor: COLORS.softDanger, fontSize: 9, fontWeight: "900", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }, stockMeta: { color: COLORS.muted, fontSize: 10, textAlign: "right", marginTop: 5 }, note: { color: "#8E462C", fontSize: 10, marginTop: 4, textAlign: "right" }, supplierButton: { flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: COLORS.mint, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6, marginTop: 7 }, supplierButtonText: { color: COLORS.primary, fontSize: 10, fontWeight: "800" }, supplierOptions: { alignSelf: "stretch", borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginTop: 5, overflow: "hidden", backgroundColor: "#FFFFFF" }, supplierOption: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border }, supplierOptionText: { color: COLORS.ink, fontSize: 11, textAlign: "right" },
  qtyWrap: { minWidth: 49, alignItems: "center", backgroundColor: "#F3F7F5", borderRadius: 12, paddingHorizontal: 5, paddingVertical: 6 }, qtyLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "700" }, qtyInput: { width: 44, height: 34, textAlign: "center", color: COLORS.primary, fontSize: 17, fontWeight: "900", padding: 0, borderBottomWidth: 1, borderBottomColor: "#C7E5D8" }, qtyUnit: { color: COLORS.muted, fontSize: 9, marginTop: 3 },
  empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 20, padding: 28, gap: 8 }, emptyTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900" }, emptyText: { color: COLORS.muted, fontSize: 11, textAlign: "center" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border }, footerSummary: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }, footerCount: { color: COLORS.ink, fontSize: 12, fontWeight: "900", textAlign: "right" }, footerSub: { color: COLORS.muted, fontSize: 10, marginTop: 3, textAlign: "right" }, clearButton: { padding: 8 }, clearText: { color: COLORS.danger, fontSize: 11, fontWeight: "800" }, commitButton: { minHeight: 52, borderRadius: 17, backgroundColor: COLORS.primary, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 }, commitDisabled: { opacity: 0.42 }, commitText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, commitCount: { minWidth: 25, height: 25, borderRadius: 9, backgroundColor: "#FFFFFF26", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, commitCountText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
});
