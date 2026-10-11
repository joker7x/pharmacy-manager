import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { router } from "expo-router";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Badge, COLORS, PageHeader, RoundIcon } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { daysUntil, formatCurrency, formatExpiryMonthYear, getNearestExpiryDate, getUnitsPerPackage, isExpirySoon, Medication, usePharmacy } from "@/lib/pharmacy-context";
import { ScreenContainer } from "@/components/screen-container";

type Filter = "الكل" | "مخزون منخفض" | "صلاحية قريبة";

const num = (value: number) => value.toLocaleString("ar-EG");

function expiryCaption(days: number) {
  if (days < 0) return `منتهية منذ ${num(Math.abs(days))} يوم`;
  if (days === 0) return "منتهية اليوم";
  return `تنتهي خلال ${num(days)} يوم`;
}

export default function InventoryScreen() {
  const { medications } = usePharmacy();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("الكل");
  const deferredSearch = useDeferredValue(search.trim());

  const isLow = useCallback((item: Medication) => item.quantity <= item.reorderLevel, []);
  const isExpiring = useCallback((item: Medication) => isExpirySoon(getNearestExpiryDate(item)), []);
  const lowCount = useMemo(() => medications.filter(isLow).length, [isLow, medications]);
  const expiryCount = useMemo(() => medications.filter((item) => !isLow(item) && isExpiring(item)).length, [isExpiring, isLow, medications]);

  const visibleItems = useMemo(
    () => medications.filter((medication) => {
      const query = deferredSearch.toLowerCase();
      const matchesSearch = !query || [medication.name, medication.category, medication.sku, medication.barcode ?? ""]
        .some((value) => value.toLowerCase().includes(query));
      const matchesFilter = filter === "الكل"
        || (filter === "مخزون منخفض" && isLow(medication))
        || (filter === "صلاحية قريبة" && isExpiring(medication));
      return matchesSearch && matchesFilter;
    }),
    [deferredSearch, filter, isExpiring, isLow, medications],
  );
  const renderItem = useCallback(({ item }: { item: Medication }) => <InventoryRow item={item} />, []);
  const hasQuery = Boolean(deferredSearch) || filter !== "الكل";

  const tiles: { key: Filter; label: string; value: number; caption: string; color: string }[] = [
    { key: "الكل", label: "إجمالي الأصناف", value: medications.length, caption: "مسجّلة في المخزون", color: COLORS.primary },
    { key: "مخزون منخفض", label: "مخزون منخفض", value: lowCount, caption: "بلغت حد إعادة الطلب", color: COLORS.danger },
    { key: "صلاحية قريبة", label: "صلاحية قريبة", value: expiryCount, caption: "خلال ٦٠ يومًا", color: COLORS.warning },
  ];

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <View style={styles.screen}>
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={14}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={12}
          windowSize={9}
          removeClippedSubviews
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.header}>
              <PageHeader title="المخزون" subtitle="الكميات والصلاحية وحد إعادة الطلب في شاشة واحدة" />
              <TouchableOpacity onPress={() => router.push("/catalog")} style={styles.catalogLink} activeOpacity={0.72}>
                <RoundIcon name="books.vertical.fill" />
                <View style={styles.catalogText}>
                  <Text style={styles.catalogTitle}>دليل الأصناف والأسعار</Text>
                  <Text style={styles.catalogSubtitle}>ابحث في الكتالوج وتابع تغيّر الأسعار</Text>
                </View>
                <IconSymbol name="chevron.left" size={17} color={COLORS.muted} />
              </TouchableOpacity>
              <View style={styles.tiles}>
                {tiles.map((tile) => (
                  <TouchableOpacity
                    key={tile.key}
                    onPress={() => setFilter(tile.key)}
                    style={[styles.tile, filter === tile.key && [styles.tileActive, { borderColor: tile.color }]]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tileValue, { color: filter === tile.key ? "#FFFFFF" : tile.color }]}>{num(tile.value)}</Text>
                    <Text style={[styles.tileLabel, filter === tile.key && { color: "#FFFFFF" }]}>{tile.label}</Text>
                    <Text style={[styles.tileCaption, filter === tile.key && { color: "#B9C6C2" }]}>{tile.caption}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.searchBox}>
                <IconSymbol name="magnifyingglass" size={19} color={COLORS.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="ابحث باسم الدواء أو الكود أو الباركود"
                  placeholderTextColor="#8B9792"
                  style={styles.searchInput}
                  returnKeyType="done"
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch("")} hitSlop={8} activeOpacity={0.7}>
                    <IconSymbol name="xmark.circle.fill" size={19} color={COLORS.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.countRow}>
                <Text style={styles.countText}>عرض {num(visibleItems.length)} من {num(medications.length)} أصناف</Text>
                {hasQuery ? (
                  <TouchableOpacity onPress={() => { setSearch(""); setFilter("الكل"); }} activeOpacity={0.7}>
                    <Text style={styles.resetText}>إظهار الكل</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          }
          ListEmptyComponent={
            medications.length ? (
              <View style={styles.empty}>
                <RoundIcon name="magnifyingglass" color={COLORS.muted} background={COLORS.mint} />
                <Text style={styles.emptyTitle}>لا توجد نتائج مطابقة</Text>
                <Text style={styles.emptyDescription}>جرّب اسمًا أقرب أو الكود/الباركود، أو أعد ضبط الفلتر لعرض كل الأصناف.</Text>
                <TouchableOpacity onPress={() => { setSearch(""); setFilter("الكل"); }} style={styles.emptyAction} activeOpacity={0.8}>
                  <Text style={styles.emptyActionText}>إظهار كل الأصناف</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <RoundIcon name="shippingbox.fill" color={COLORS.muted} background={COLORS.mint} />
                <Text style={styles.emptyTitle}>المخزون فارغ</Text>
                <Text style={styles.emptyDescription}>ابدأ بتسجيل أول صنف باسمه وسعره وكميته وحد إعادة الطلب.</Text>
                <TouchableOpacity onPress={() => router.push("/medicine-form")} style={styles.emptyAction} activeOpacity={0.8}>
                  <IconSymbol name="plus" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyActionText}>إضافة أول صنف</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
        <TouchableOpacity
          onPress={() => router.push("/medicine-form")}
          style={styles.floatingAdd}
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel="إضافة صنف للمخزون"
        >
          <IconSymbol name="plus.circle.fill" size={22} color="#FFFFFF" />
          <Text style={styles.floatingAddText}>إضافة صنف</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const InventoryRow = memo(function InventoryRow({ item }: { item: Medication }) {
  const nearestExpiry = getNearestExpiryDate(item);
  const remainingDays = daysUntil(nearestExpiry);
  const lowStock = item.quantity <= item.reorderLevel;
  const expirySoon = !lowStock && isExpirySoon(nearestExpiry);
  const packages = Math.ceil(item.quantity / Math.max(1, getUnitsPerPackage(item)));
  const statusColor = lowStock ? COLORS.danger : expirySoon ? COLORS.warning : COLORS.success;
  const meta = `${item.category || "بدون تصنيف"} · ${num(item.quantity)} وحدة · ${num(packages)} عبوة`;

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: "/medicine-form", params: { id: item.id } })}
      style={styles.row}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`تفاصيل ${item.name}`}
    >
      <View style={[styles.statusRail, { backgroundColor: statusColor }]} />
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowSupporting} numberOfLines={1}>{meta}</Text>
        {expirySoon ? (
          <View style={styles.expiryLine}>
            <IconSymbol name="calendar" size={13} color={COLORS.warning} />
            <Text style={styles.expiryText}>{formatExpiryMonthYear(nearestExpiry)} · {expiryCaption(remainingDays)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.rowValue}>
        <Text style={styles.rowPrice}>{formatCurrency(item.price)}</Text>
        <Badge label={lowStock ? "منخفض" : expirySoon ? "قريبة الانتهاء" : "متوفر"} tone={lowStock ? "danger" : expirySoon ? "warning" : "success"} />
        <Text style={styles.rowReorder}>الحد {num(item.reorderLevel)}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 112 },
  header: { paddingBottom: 6 },
  catalogLink: { minHeight: 62, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  catalogText: { flex: 1, alignItems: "flex-end" },
  catalogTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right" },
  catalogSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 3, textAlign: "right" },
  tiles: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  tile: { flex: 1, alignItems: "flex-end", gap: 3, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 11, minHeight: 92 },
  tileActive: { backgroundColor: COLORS.deep },
  tileValue: { fontSize: 20, fontWeight: "900" },
  tileLabel: { color: COLORS.ink, fontSize: 11, fontWeight: "900", textAlign: "right" },
  tileCaption: { color: COLORS.muted, fontSize: 9, lineHeight: 13, textAlign: "right" },
  searchBox: { height: 50, backgroundColor: "#F2F1EE", borderWidth: 1, borderColor: "#F2F1EE", borderRadius: 17, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 14, gap: 9 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.ink, textAlign: "right", writingDirection: "rtl" },
  countRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 13, marginBottom: 11 },
  countText: { color: COLORS.muted, fontSize: 11, fontWeight: "800", textAlign: "right" },
  resetText: { color: COLORS.primary, fontSize: 11, fontWeight: "900" },
  row: { minHeight: 74, marginBottom: 10, paddingVertical: 13, paddingHorizontal: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  statusRail: { position: "absolute", right: 7, top: 14, bottom: 14, width: 4, borderRadius: 4 },
  rowText: { flex: 1, alignItems: "flex-end", minWidth: 0 },
  rowName: { width: "100%", color: COLORS.ink, fontSize: 14, fontWeight: "900", lineHeight: 20, textAlign: "right" },
  rowSupporting: { width: "100%", color: COLORS.muted, fontSize: 10, lineHeight: 15, textAlign: "right", marginTop: 3 },
  expiryLine: { flexDirection: "row-reverse", alignItems: "center", gap: 4, marginTop: 5 },
  expiryText: { color: COLORS.warning, fontSize: 10, fontWeight: "900", textAlign: "right" },
  rowValue: { width: 84, alignItems: "flex-start", gap: 5 },
  rowPrice: { color: COLORS.ink, fontSize: 14, fontWeight: "900", writingDirection: "ltr" },
  rowReorder: { color: COLORS.muted, fontSize: 9, fontWeight: "700", writingDirection: "rtl" },
  empty: { alignItems: "center", paddingTop: 46, paddingHorizontal: 20 },
  emptyTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900", marginTop: 12 },
  emptyDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 5, textAlign: "center" },
  emptyAction: { minHeight: 44, marginTop: 18, paddingHorizontal: 20, borderRadius: 15, backgroundColor: COLORS.primary, flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  emptyActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  floatingAdd: { position: "absolute", left: 20, bottom: 20, minHeight: 48, paddingHorizontal: 16, borderRadius: 16, backgroundColor: COLORS.primary, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6 },
  floatingAddText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
