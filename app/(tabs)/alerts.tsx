/**
 * كشكول النواقص — Shortages Screen
 * تصميم بسيط وسلس يناسب جميع المستخدمين.
 *
 * المبادئ:
 * - بطاقة واحدة = معلومة واحدة رئيسية
 * - زر عمل واحد بارز لكل حالة
 * - النقر على البطاقة يفتح نافذة التفاصيل الكاملة
 * - زر إضافة عائم (FAB) في أسفل اليمين
 */

import { useCallback, useEffect, useDeferredValue, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Linking from "expo-linking";

import { COLORS, PageHeader, RoundIcon } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { offlineCatalogSize } from "@/lib/offline-catalog";
import { useCatalogSearch } from "@/hooks/use-catalog-search";
import { formatCurrency, Medication, ReorderNeed, usePharmacy } from "@/lib/pharmacy-context";
import { trpc } from "@/lib/trpc";
import { ScreenContainer } from "@/components/screen-container";
import { useSnackbar } from "@/components/snackbar";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ActiveFilter = "needed" | "ordered" | "received";

type ConfirmSheet = {
  title: string;
  body: string;
  actions: { label: string; tone?: "danger" | "primary" | "success"; onPress: () => void }[];
};

type CatalogProduct = {
  externalId: string;
  arabicName: string;
  name: string;
  category: string | null;
  company: string | null;
  barcode: string | null;
  currentPrice: string | number;
  unitsPerPackage: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const num = (value: number) => value.toLocaleString("ar-EG");
const itemsWord = (count: number) =>
  count === 0 ? "٠ صنف" : count === 1 ? "صنف" : count === 2 ? "صنفان" : count <= 10 ? `${num(count)} أصناف` : `${num(count)} صنفًا`;

/** تطبيع حرفي بسيط حتى يتطابق «بنادول» مع «بانادول» كما في دليل الأصناف. */
function searchKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .trim();
}

const URGENCY_RANK = { critical: 0, high: 1, normal: 2 } as const;

const UNAVAILABLE_TAG_TEXT = "#8E462C";

const hourFormatter = new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit" });

type ShortageSection = { key: string; title: string; tone?: "danger" | "warning"; data: ReorderNeed[] };

const URGENCY_TONE: Record<"normal" | "high" | "critical", { background: string; text: string }> = {
  normal: { background: COLORS.deep, text: "#FFFFFF" },
  high: { background: COLORS.softWarning, text: COLORS.warning },
  critical: { background: COLORS.softDanger, text: COLORS.danger },
};

function urgencyColor(item: ReorderNeed) {
  if (item.medication.quantity === 0 || item.urgency === "critical") return COLORS.danger;
  if (item.urgency === "high") return COLORS.warning;
  return COLORS.primary;
}

function statusLabel(status: ReorderNeed["status"]) {
  if (status === "ordered") return "قيد الشراء";
  if (status === "received") return "تم الاستلام";
  return "ناقص";
}

function statusColor(status: ReorderNeed["status"]) {
  if (status === "ordered") return COLORS.warning;
  if (status === "received") return COLORS.success;
  return COLORS.danger;
}

function statusCaption(status: ReorderNeed["status"]) {
  if (status === "ordered") return "عند المورد";
  if (status === "received") return "تم توريدها";
  return "تحتاج طلب";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function AlertsScreen() {
  const {
    medications,
    reorderNeeds,
    suppliers,
    markReorderOrdered,
    markReorderReceived,
    updateReorderNeed,
    incrementReorderDemand,
    removeReorderNeed,
    addCustomShortage,
    addReorderNeedFromCatalog,
    reorderRecords,
    restoreReorderRecords,
  } = usePharmacy();

  const { show } = useSnackbar();

  // Filters
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("needed");
  const [searchQuery, setSearchQuery] = useState("");

  // Bottom Sheet (Detail)
  const [detailItem, setDetailItem] = useState<ReorderNeed | null>(null);

  // Add Shortage Modal
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "catalog">("manual");
  const [catalogQuery, setCatalogQuery] = useState("");
  const deferredCatalogQuery = useDeferredValue(catalogQuery.trim());
  const catalogResults = useCatalogSearch(deferredCatalogQuery, { limit: 12, enabled: addOpen && addMode === "catalog" });
  const [addedCatalogItem, setAddedCatalogItem] = useState<CatalogProduct | null>(null);
  const [catalogSize, setCatalogSize] = useState(0);
  useEffect(() => { void offlineCatalogSize().then(setCatalogSize); }, []);

  // Manual Add Form
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("12");
  const [qtyManualOpen, setQtyManualOpen] = useState(false);
  const [manualUrgent, setManualUrgent] = useState(false);
  const [showNoteField, setShowNoteField] = useState(false);
  const [manualSupplier, setManualSupplier] = useState("");
  const [manualCustomer, setManualCustomer] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualNameError, setManualNameError] = useState<string>();

  // Inline confirmations (Alert is unavailable on web and too limited on mobile)
  const [confirmSheet, setConfirmSheet] = useState<ConfirmSheet | null>(null);
  const requestReceive = (medicationId: string, medicationName: string, afterReceive?: () => void) => {
    const finish = () => { setConfirmSheet(null); afterReceive?.(); };
    setConfirmSheet({
      title: "استلام الصنف",
      body: `هل وصل «${medicationName}»؟ اختر إن كان يجب إضافة وحداته للمخزون.`,
      actions: [
        { label: "وصل وأضفه للمخزون", tone: "success", onPress: () => { markReorderReceived(medicationId, true); finish(); } },
        { label: "وصل فقط", onPress: () => { markReorderReceived(medicationId, false); finish(); } },
        { label: "إلغاء", onPress: finish },
      ],
    });
  };

  // WhatsApp Share Modal
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSupplier, setShareSupplier] = useState("all");
  const [copied, setCopied] = useState(false);

  // Detail editing state
  const [editQty, setEditQty] = useState("5");
  const [editSupplier, setEditSupplier] = useState("");
  const [editCustomer, setEditCustomer] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editQtyError, setEditQtyError] = useState<string>();

  // Alternatives
  const [altOpen, setAltOpen] = useState(false);
  const [altSource, setAltSource] = useState<Medication | null>(null);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const receivedCount = useMemo(() => reorderNeeds.filter(i => i.status === "received").length, [reorderNeeds]);
  const neededCount  = useMemo(() => reorderNeeds.filter(i => i.status === "needed").length,   [reorderNeeds]);
  const orderedCount = useMemo(() => reorderNeeds.filter(i => i.status === "ordered").length,  [reorderNeeds]);
  const outCount     = useMemo(() => reorderNeeds.filter(i => i.medication.quantity === 0).length, [reorderNeeds]);
  const customerCount = useMemo(() => reorderNeeds.filter(i => i.status === "needed" && Boolean(i.customerName)).length, [reorderNeeds]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const tiles: { key: ActiveFilter; label: string; value: number; caption: string; color: string }[] = [
    { key: "needed", label: "ناقصة", value: neededCount, caption: outCount ? `منها ${num(outCount)} نافد` : statusCaption("needed"), color: COLORS.danger },
    { key: "ordered", label: "قيد الشراء", value: orderedCount, caption: statusCaption("ordered"), color: COLORS.warning },
    { key: "received", label: "مستلمة", value: receivedCount, caption: statusCaption("received"), color: COLORS.success },
  ];

  const visibleItems = useMemo(() => {
    const q = searchKey(searchQuery);
    return reorderNeeds
      .filter(item => item.status === activeFilter)
      .filter(item => {
        if (!q) return true;
        return [item.medication.name, item.medication.sku, item.medication.barcode ?? "", item.customerName ?? "", item.supplierName ?? ""]
          .some(value => searchKey(value).includes(q));
      })
      .sort((a, b) =>
        URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
        a.medication.quantity - b.medication.quantity ||
        b.demandCount - a.demandCount);
  }, [reorderNeeds, activeFilter, searchQuery]);

  // ── WhatsApp message ───────────────────────────────────────────────────────
  const shareItems = useMemo(() => reorderNeeds.filter(i => {
    if (i.status === "received") return false;
    if (shareSupplier !== "all" && i.supplierName !== shareSupplier) return false;
    return true;
  }), [reorderNeeds, shareSupplier]);

  const whatsAppText = useMemo(() => {
    const today = new Intl.DateTimeFormat("ar-EG", { dateStyle: "full" }).format(new Date());
    if (!shareItems.length) return "لا توجد نواقص مختارة.";
    let msg = `📋 *طلبية نواقص صيدلية*\n📅 ${today}\n`;
    if (shareSupplier !== "all") msg += `🏢 المورد: ${shareSupplier}\n`;
    msg += `──────────────────\n`;
    shareItems.forEach((item, i) => {
      msg += `${num(i + 1)}. *${item.medication.name}* — ${num(item.desiredQuantity ?? 1)} علب`;
      if (item.notes) msg += ` (${item.notes})`;
      msg += "\n";
    });
    msg += `──────────────────\nإجمالي: ${shareItems.length === 1 ? "صنف واحد" : itemsWord(shareItems.length)}\n*شكراً، برجاء التوريد بسرعة.*`;
    return msg;
  }, [shareItems, shareSupplier]);

  // ── Open Detail Sheet ──────────────────────────────────────────────────────
  const openDetail = useCallback((item: ReorderNeed) => {
    setDetailItem(item);
    setEditQty(String(item.desiredQuantity ?? 5));
    setEditSupplier(item.supplierName ?? "");
    setEditCustomer(item.customerName ?? "");
    setEditPhone(item.customerPhone ?? "");
    setEditNotes(item.notes ?? "");
    setEditQtyError(undefined);
  }, []);

  // البطاقة قد تتغيّر أثناء فتح النافذة (عدد الطلبات/الحالة)؛ تُقرأ النسخة الحيّة.
  const detail = useMemo(
    () => (detailItem ? reorderNeeds.find(i => i.medication.id === detailItem.medication.id) ?? detailItem : null),
    [detailItem, reorderNeeds],
  );

  const saveDetail = () => {
    if (!detail) return;
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty < 1) {
      setEditQtyError("اكتب عددًا صحيحًا أكبر من صفر لعدد العلب المطلوب.");
      return;
    }
    updateReorderNeed(detail.medication.id, {
      desiredQuantity: qty,
      supplierName: editSupplier.trim() || undefined,
      customerName: editCustomer.trim() || undefined,
      customerPhone: editPhone.trim() || undefined,
      notes: editNotes.trim() || undefined,
    });
    setDetailItem(null);
  };

  // ── Manual Add ─────────────────────────────────────────────────────────────
  const submitManual = () => {
    if (!manualName.trim()) {
      setManualNameError("اكتب اسم الدواء أو الصنف الناقص قبل الحفظ.");
      return;
    }
    setManualNameError(undefined);
    const qty = parseInt(manualQty, 10);
    const snapshot = reorderRecords;
    addCustomShortage({
      name: manualName.trim(),
      desiredQuantity: isNaN(qty) || qty < 1 ? 12 : qty,
      supplierName: manualSupplier.trim() || undefined,
      customerName: manualCustomer.trim() || undefined,
      customerPhone: manualPhone.trim() || undefined,
      notes: manualNotes.trim() || undefined,
      urgent: manualUrgent,
    });
    setManualName(""); setManualQty("12"); setManualSupplier("");
    setManualCustomer(""); setManualPhone(""); setManualNotes("");
    setManualUrgent(false); setShowNoteField(false); setQtyManualOpen(false);
    setAddOpen(false);
    show({ message: "اتسجّل الصنف الناقص", actionLabel: "تراجع", onAction: () => restoreReorderRecords(snapshot) });
  };

  // ── Catalog add ─────────────────────────────────────────────────────────────
  const handleAddCatalog = (p: CatalogProduct) => {
    addReorderNeedFromCatalog({
      catalogId: p.externalId,
      name: p.arabicName || p.name,
      category: p.category || "أخرى",
      sku: p.barcode || p.externalId,
      barcode: p.barcode || undefined,
      price: Number(p.currentPrice) || 0,
      quantity: 0,
      unitsPerPackage: Math.max(1, p.unitsPerPackage || 1),
      reorderLevel: 5,
      expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
    });
    setAddedCatalogItem(p);
  };

  const stockFor = (p: CatalogProduct) =>
    medications.find(m =>
      (p.barcode && m.barcode === p.barcode) ||
      m.catalogId === p.externalId ||
      m.sku === p.externalId
    );

  // ── Alternatives ───────────────────────────────────────────────────────────
  const alternatives = useMemo(() => {
    if (!altSource) return [];
    const keywords = altSource.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return medications.filter(m => {
      if (m.id === altSource.id || m.quantity <= 0) return false;
      if (altSource.category && m.category === altSource.category && m.category !== "أخرى") return true;
      return keywords.some(k => m.name.toLowerCase().includes(k));
    });
  }, [medications, altSource]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: ReorderNeed }) => <ShortageCard item={item} onPress={() => openDetail(item)} />;

  const renderSectionHeader = ({ section }: { section: ShortageSection }) => (section.title ? (
    <View style={s.sectionBar}>
      <View style={[s.sectionBarFill, { backgroundColor: section.tone === "danger" ? COLORS.danger : COLORS.warning }]} />
      <Text style={s.sectionBarText}>{section.title}</Text>
      <Text style={s.sectionBarCount}>{num(section.data.length)}</Text>
    </View>
  ) : null);

  const renderSeparator = useCallback(() => <View style={{ height: 10 }} />, []);

  const sections = useMemo<ShortageSection[]>(() => {
    if (activeFilter !== "needed") return [{ key: activeFilter, title: "", data: visibleItems }];
    const critical = visibleItems.filter((item) => item.urgent || item.medication.quantity === 0);
    const soon = visibleItems.filter((item) => !item.urgent && item.medication.quantity > 0);
    const result: ShortageSection[] = [];
    if (critical.length) result.push({ key: "critical", title: "حرج", tone: "danger", data: critical });
    if (soon.length) result.push({ key: "soon", title: "قرّب يخلص", tone: "warning", data: soon });
    return result;
  }, [activeFilter, visibleItems]);

  return (
    <ScreenContainer containerClassName="bg-background" className="flex-1">

      {/* ── List with everything in header ───────────────────────────────────── */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.medication.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={s.listContent}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={16}
        removeClippedSubviews
        ListHeaderComponent={() => (
          <>
            {/* ── Header ─────────────────────────────────────────────────────────── */}
            <View style={s.header}>
              <View style={{ flex: 1 }}>
                <PageHeader title="النواقص" subtitle="سجّل الناقص، جهّز طلب الشراء، وتابع الاستلام من مكان واحد." />
              </View>
              <View style={s.headerActions}>
                <TouchableOpacity
                  style={s.shareBtn}
                  onPress={() => { setShareOpen(true); setCopied(false); }}
                  activeOpacity={0.8}
                  accessibilityLabel="مشاركة النواقص عبر واتساب"
                >
                  <IconSymbol name="paperplane.fill" size={16} color={COLORS.ink} />
                  <Text style={s.shareBtnText}>مشاركة</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() => { setAddOpen(true); setAddedCatalogItem(null); }}
                  activeOpacity={0.85}
                  accessibilityLabel="سجّل صنف ناقص"
                >
                  <IconSymbol name="plus" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Filter tiles ───────────────────────────────────────────────────── */}
            <View style={s.tiles}>
              {tiles.map((tile) => {
                const active = activeFilter === tile.key;
                return (
                  <TouchableOpacity
                    key={tile.key}
                    onPress={() => setActiveFilter(tile.key)}
                    style={[s.tile, active && s.tileActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.tileValue, { color: active ? "#FFFFFF" : tile.color }]}>{num(tile.value)}</Text>
                    <Text style={[s.tileLabel, active && { color: "#FFFFFF" }]}>{tile.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Search ─────────────────────────────────────────────────────────── */}
            <View style={s.searchWrap}>
              <IconSymbol name="magnifyingglass" size={18} color={COLORS.muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="ابحث بالاسم أو الكود أو الباركود أو العميل..."
                placeholderTextColor={COLORS.muted}
                style={s.searchInput}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="مسح البحث">
                  <IconSymbol name="xmark.circle.fill" size={18} color={COLORS.muted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.countRow}>
              <Text style={s.countText}>
                {`عرض ${num(visibleItems.length)} من ${num(reorderNeeds.filter(i => i.status === activeFilter).length)} صنف`}
                {activeFilter === "needed" && customerCount ? ` · ${num(customerCount)} بطلب عميل` : ""}
              </Text>
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                  <Text style={s.resetText}>إظهار الكل</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}
        ListEmptyComponent={
          searchQuery ? (
            <View style={s.empty}>
              <RoundIcon name="magnifyingglass" color={COLORS.muted} background={COLORS.mint} />
              <Text style={s.emptyTitle}>لا توجد نتائج مطابقة</Text>
              <Text style={s.emptySub}>جرّب جزءًا من الاسم أو الكود، أو أعد ضبط البحث لعرض كل أصناف هذا القسم.</Text>
              <TouchableOpacity style={s.emptyAction} onPress={() => setSearchQuery("")} activeOpacity={0.8}>
                <Text style={s.emptyActionText}>إظهار كل الأصناف</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.empty}>
              <RoundIcon
                name={activeFilter === "needed" ? "checkmark.circle.fill" : activeFilter === "ordered" ? "shippingbox.fill" : "cart.fill"}
                color={COLORS.muted}
                background={COLORS.mint}
              />
              <Text style={s.emptyTitle}>
                {activeFilter === "needed"
                  ? "لا توجد أصناف ناقصة"
                  : activeFilter === "ordered"
                  ? "لا توجد طلبات قيد الشراء"
                  : "لم تستلم أي أصناف بعد"}
              </Text>
              <Text style={s.emptySub}>
                {activeFilter === "needed"
                  ? "المخزون في وضع جيد. سجّل طلب مريض أو صنفًا تعلم أنه سينفد."
                  : activeFilter === "ordered"
                  ? "حوّل الأصناف الناقصة إلى طلبية شراء لتظهر هنا."
                  : "الأصناف التي تصل من المورد وتؤكدها تظهر في هذا القسم."}
              </Text>
              {activeFilter === "needed" ? (
                <TouchableOpacity style={s.emptyAction} onPress={() => { setAddOpen(true); setAddedCatalogItem(null); }} activeOpacity={0.8}>
                  <IconSymbol name="plus" size={16} color="#FFFFFF" />
                  <Text style={s.emptyActionText}>تسجيل صنف ناقص</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={<View style={{ height: 132 }} />}
      />

      {/* ── الإجراء الأساسي: تجهيز طلب شراء ───────────────────────────────── */}
      {activeFilter !== "received" ? (
        <TouchableOpacity style={s.orderBar} onPress={() => router.push("/supplier-order")} activeOpacity={0.9} accessibilityRole="button">
          <IconSymbol name="shippingbox.fill" size={18} color="#FFFFFF" />
          <Text style={s.orderBarText}>تجهيز طلب شراء</Text>
          <Text style={s.orderBarCount}>{num(neededCount)}</Text>
        </TouchableOpacity>
      ) : null}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Detail Bottom Sheet                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={Boolean(detail)}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailItem(null)}
      >
        <Pressable style={s.backdrop} onPress={() => setDetailItem(null)} />
        <View style={s.sheet}>
          {detail && (
            <>
              <View style={s.sheetHandle} />
              <View style={s.quickHeader}>
                <TouchableOpacity style={s.quickIconBtn} onPress={() => setDetailItem(null)} accessibilityLabel="إغلاق التفاصيل"><IconSymbol name="xmark" size={17} color={COLORS.ink} /></TouchableOpacity>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={s.sheetTitle} numberOfLines={2}>{detail.medication.name}</Text>
                  <Text style={s.quickSku}>كود الصنف: {detail.medication.sku}</Text>
                </View>
                <TouchableOpacity style={s.sheetDeleteBtn} onPress={() => {
                  const target = detail;
                  setConfirmSheet({ title: "حذف من النواقص", body: `سيُحذف «${target.medication.name}» من قائمة النواقص. لن يتأثر المخزون.`, actions: [
                    { label: "حذف", tone: "danger", onPress: () => { removeReorderNeed(target.medication.id); setConfirmSheet(null); setDetailItem(null); } },
                    { label: "إلغاء", onPress: () => setConfirmSheet(null) },
                  ] });
                }} activeOpacity={0.7} accessibilityLabel="حذف من النواقص"><IconSymbol name="trash" size={16} color={COLORS.danger} /></TouchableOpacity>
              </View>

              <View style={s.quickStatusRow}>
                <View style={[s.statusChip, { backgroundColor: statusColor(detail.status) + "18" }]}><Text style={[s.statusChipText, { color: statusColor(detail.status) }]}>{statusLabel(detail.status)}</Text></View>
                {detail.medication.quantity === 0 ? <View style={[s.statusChip, { backgroundColor: COLORS.softDanger }]}><Text style={[s.statusChipText, { color: COLORS.danger }]}>نفد تمامًا</Text></View> : null}
                <Text style={s.quickStock}>المتاح {num(detail.medication.quantity)} من حد {num(detail.medication.reorderLevel)}</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={s.quickScroll}>
                <View style={s.quickEditCard}>
                  <View style={s.quickField}>
                    <Text style={s.fieldLabel}>الكمية المطلوبة (علب)</Text>
                    <View style={s.qtyRow}>
                      <TouchableOpacity style={s.qtyBtn} onPress={() => { setEditQty(q => String(Math.max(1, parseInt(q, 10) - 1 || 1))); setEditQtyError(undefined); }} accessibilityLabel="إنقاص الكمية"><Text style={s.qtyBtnText}>−</Text></TouchableOpacity>
                      <TextInput value={editQty} onChangeText={(value) => { setEditQty(value); setEditQtyError(undefined); }} keyboardType="numeric" style={[s.qtyInput, Boolean(editQtyError) && s.qtyInputError]} selectTextOnFocus />
                      <TouchableOpacity style={s.qtyBtn} onPress={() => { setEditQty(q => String((parseInt(q, 10) || 0) + 1)); setEditQtyError(undefined); }} accessibilityLabel="زيادة الكمية"><Text style={s.qtyBtnText}>+</Text></TouchableOpacity>
                    </View>
                    {editQtyError ? <Text style={s.fieldErrorText}>{editQtyError}</Text> : null}
                  </View>
                  <View style={s.quickField}>
                    <Text style={s.fieldLabel}>المورد (اختياري)</Text>
                    <TextInput value={editSupplier} onChangeText={setEditSupplier} placeholder="اختار أو اكتب اسم المورد" placeholderTextColor={COLORS.muted} style={s.fieldInput} />
                  </View>
                </View>

                {detail.customerName || detail.customerPhone ? <View style={s.quickExistingInfo}><IconSymbol name="person.crop.circle.fill" size={16} color={COLORS.primary} /><View style={{ flex: 1, alignItems: "flex-end" }}><Text style={s.quickInfoTitle}>{detail.customerName || "طلب عميل"}</Text>{detail.customerPhone ? <Text style={s.quickInfoSub}>{detail.customerPhone}</Text> : null}</View>{detail.customerPhone ? <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${detail.customerPhone}`)}><IconSymbol name="phone.fill" size={13} color="#FFFFFF" /><Text style={s.callBtnText}>اتصال</Text></TouchableOpacity> : null}</View> : null}
                {detail.notes ? <View style={s.quickNote}><Text style={s.quickInfoTitle}>ملاحظة</Text><Text style={s.quickInfoSub}>{detail.notes}</Text></View> : null}

                <TouchableOpacity style={s.quickSecondaryAction} onPress={() => incrementReorderDemand(detail.medication.id)} activeOpacity={0.8}>
                  <IconSymbol name="person.badge.plus" size={16} color={COLORS.primary} /><Text style={s.quickSecondaryText}>تسجيل طلب عميل آخر</Text><View style={s.quickDemandCount}><Text style={s.quickDemandCountText}>{num(detail.demandCount)}</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={s.altBtn} onPress={() => { setAltSource(detail.medication); setAltOpen(true); }} activeOpacity={0.8}><IconSymbol name="cross.case.fill" size={15} color={COLORS.primary} /><Text style={s.altBtnText}>البحث عن بديل متاح بالمخزون</Text></TouchableOpacity>
              </ScrollView>

              <View style={s.quickFooter}>
                <TouchableOpacity style={s.sheetSaveBtn} onPress={saveDetail} activeOpacity={0.85}><Text style={s.sheetSaveBtnText}>حفظ</Text></TouchableOpacity>
                {detail.status === "needed" ? <TouchableOpacity style={s.sheetOrderBtn} onPress={() => { markReorderOrdered(detail.medication.id); setDetailItem(null); }} activeOpacity={0.85}><IconSymbol name="cart.fill" size={16} color="#FFFFFF" /><Text style={s.sheetOrderBtnText}>تم الشراء</Text></TouchableOpacity> : null}
                {detail.status === "ordered" ? <TouchableOpacity style={[s.sheetOrderBtn, { backgroundColor: COLORS.success }]} onPress={() => requestReceive(detail.medication.id, detail.medication.name, () => setDetailItem(null))} activeOpacity={0.85}><IconSymbol name="checkmark.circle.fill" size={16} color="#FFFFFF" /><Text style={s.sheetOrderBtnText}>تسجيل الاستلام</Text></TouchableOpacity> : null}
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Add Shortage Modal                                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setAddOpen(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />

          {/* Tabs */}
          <View style={s.addTabs}>
            {(["manual", "catalog"] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[s.addTab, addMode === mode && s.addTabActive]}
                onPress={() => setAddMode(mode)}
                activeOpacity={0.8}
              >
                <View style={s.addTabInner}>
                  <IconSymbol name={mode === "manual" ? "pencil" : "magnifyingglass"} size={15} color={addMode === mode ? COLORS.primary : COLORS.muted} />
                  <Text style={[s.addTabText, addMode === mode && s.addTabTextActive]}>
                    {mode === "manual" ? "تسجيل سريع" : "دليل الأدوية"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {addMode === "manual" ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={s.addSectionTitle}>أضف صنفاً ناقصاً أو طلب مريض</Text>

              <Text style={s.fieldLabel}>اسم الدواء أو الصنف *</Text>
              <TextInput
                value={manualName}
                onChangeText={(value) => { setManualName(value); if (value.trim()) setManualNameError(undefined); }}
                placeholder="مثال: بروفين 400 مجم أو شامبو هيد آند شولدرز"
                placeholderTextColor={COLORS.muted}
                style={[s.fieldInput, Boolean(manualNameError) && s.fieldInputError]}
                autoFocus
              />
              {manualNameError ? <Text style={s.fieldErrorText}>{manualNameError}</Text> : null}

              <Text style={s.fieldLabel}>الكمية المطلوبة (علب)</Text>
              <View style={s.qtyPickRow}>
                {[3, 6, 12, 24].map((value) => (
                  <TouchableOpacity key={value} onPress={() => { setManualQty(String(value)); setQtyManualOpen(false); }} style={[s.qtyPick, manualQty === String(value) && !qtyManualOpen && s.qtyPickOn]} activeOpacity={0.8}>
                    <Text style={[s.qtyPickText, manualQty === String(value) && !qtyManualOpen && s.qtyPickTextOn]}>{num(value)}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setQtyManualOpen((value) => !value)} style={[s.qtyPick, qtyManualOpen && s.qtyPickOn]} activeOpacity={0.8} accessibilityLabel="كتابة كمية مخصصة">
                  <IconSymbol name="pencil" size={14} color={qtyManualOpen ? "#FFFFFF" : COLORS.muted} />
                </TouchableOpacity>
              </View>
              {qtyManualOpen ? (
                <TextInput
                  value={manualQty}
                  onChangeText={(value) => setManualQty(value.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                  autoFocus
                  placeholder="عدد العلب"
                  placeholderTextColor={COLORS.muted}
                  style={[s.fieldInput, { marginTop: 8 }]}
                />
              ) : null}

              <Text style={s.fieldLabel}>المورد (اختياري)</Text>
              <TextInput value={manualSupplier} onChangeText={setManualSupplier} placeholder="ابن سينا، المتحدة..." placeholderTextColor={COLORS.muted} style={s.fieldInput} />

              {/* Customer box */}
              <View style={s.customerBox}>
                <Text style={s.customerBoxTitle}>طلب مريض (اختياري)</Text>
                <View style={s.sheetFieldRow}>
                  <TextInput value={manualCustomer} onChangeText={setManualCustomer} placeholder="اسم المريض" placeholderTextColor={COLORS.muted} style={[s.fieldInput, { flex: 1 }]} />
                  <TextInput value={manualPhone} onChangeText={setManualPhone} placeholder="رقم الهاتف" keyboardType="phone-pad" placeholderTextColor={COLORS.muted} style={[s.fieldInput, { flex: 1 }]} />
                </View>
              </View>

              <View style={s.toggleRow}>
                <TouchableOpacity onPress={() => setManualUrgent((value) => !value)} style={[s.toggleChip, manualUrgent && s.toggleChipUrgent]} activeOpacity={0.8} accessibilityRole="switch" accessibilityState={{ checked: manualUrgent }}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={14} color={manualUrgent ? "#FFFFFF" : COLORS.warning} />
                  <Text style={[s.toggleChipText, manualUrgent && s.toggleChipTextOn]}>عاجل</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowNoteField((value) => !value)} style={[s.toggleChip, showNoteField && s.toggleChipOn]} activeOpacity={0.8}>
                  <IconSymbol name="pencil" size={14} color={showNoteField ? "#FFFFFF" : COLORS.muted} />
                  <Text style={[s.toggleChipText, showNoteField && s.toggleChipTextOn]}>ملاحظة</Text>
                </TouchableOpacity>
              </View>

              {showNoteField ? (
                <View style={{ marginTop: 8 }}>
                  <TextInput value={manualNotes} onChangeText={setManualNotes} placeholder="ملاحظة إضافية..." placeholderTextColor={COLORS.muted} style={s.fieldInput} />
                  <View style={s.tagRow}>
                    {["ماركة معينة", "بديل مقبول"].map((tag) => (
                      <TouchableOpacity key={tag} onPress={() => setManualNotes((current) => (current.includes(tag) ? current : [current, tag].filter(Boolean).join(" · ")))} style={s.tagChip} activeOpacity={0.8}>
                        <Text style={s.tagChipText}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              <TouchableOpacity style={s.addSubmitBtn} onPress={submitManual} activeOpacity={0.85}>
                <Text style={s.addSubmitBtnText}>{`سجّل ناقص · ${num(parseInt(manualQty, 10) || 0)}`}</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <>
              <View style={s.searchWrap}>
                <IconSymbol name="magnifyingglass" size={18} color={COLORS.muted} />
                <TextInput
                  autoFocus
                  value={catalogQuery}
                  onChangeText={v => { setCatalogQuery(v); setAddedCatalogItem(null); }}
                  placeholder="اسم الدواء أو الكود أو الباركود..."
                  placeholderTextColor={COLORS.muted}
                  style={s.searchInput}
                />
                {catalogQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setCatalogQuery("")} hitSlop={8} accessibilityLabel="مسح البحث">
                    <IconSymbol name="xmark.circle.fill" size={18} color={COLORS.muted} />
                  </TouchableOpacity>
                )}
              </View>

              {catalogResults.isFetching
                ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />
                : null
              }

              <FlatList
                data={(catalogResults.data?.items ?? []) as CatalogProduct[]}
                keyExtractor={item => item.externalId}
                style={{ maxHeight: 340, marginTop: 8 }}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border }} />}
                renderItem={({ item }) => {
                  const stock = stockFor(item);
                  const already = reorderNeeds.some(n =>
                    n.medication.catalogId === item.externalId ||
                    (item.barcode && n.medication.barcode === item.barcode)
                  );
                  return (
                    <View style={s.catalogRow}>
                      <View style={s.catalogText}>
                        <Text style={s.catalogName} numberOfLines={2}>{item.arabicName || item.name}</Text>
                        <Text style={s.catalogMeta}>
                          {[item.company, item.category].filter(Boolean).join(" · ") || "صنف دوائي"}
                        </Text>
                        <Text style={s.catalogPrice}>
                          {`${item.currentPrice ? formatCurrency(Number(item.currentPrice)) : "بدون سعر"} · ${item.barcode ?? item.externalId}`}
                        </Text>
                        <Text style={[s.catalogStock, { color: stock ? COLORS.primary : COLORS.muted }]}>
                          {stock ? `متوفر بالمخزون (${num(stock.quantity)})` : "غير مسجّل بالمخزون"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[s.catalogAddBtn, already && s.catalogAddBtnDone]}
                        disabled={already}
                        onPress={() => handleAddCatalog(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.catalogAddBtnText}>{already ? "مُضاف" : "أضف"}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  catalogResults.isFetching ? null
                    : deferredCatalogQuery.length >= 2
                    ? <Text style={s.noResults}>لا توجد نتائج في الدليل؛ جرّب جزءًا من الاسم أو الكود.</Text>
                    : <Text style={s.noResults}>اكتب حرفين على الأقل للبحث في دليل الأصناف ({num(catalogSize)} صنف).</Text>
                }
              />

              {addedCatalogItem && (
                <View style={s.addedNotice}>
                  <IconSymbol name="checkmark.circle.fill" size={16} color={COLORS.success} />
                  <Text style={s.addedNoticeText}>أُضيف «{addedCatalogItem.arabicName || addedCatalogItem.name}» إلى كشكول النواقص</Text>
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={s.closeSheetBtn} onPress={() => setAddOpen(false)} activeOpacity={0.8}>
            <Text style={s.closeSheetBtnText}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* WhatsApp Share Modal                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setShareOpen(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>مشاركة النواقص عبر واتساب</Text>
          <Text style={s.sheetSub}>{`سيتم إرسال ${itemsWord(shareItems.length)} للموردين.`}</Text>

          {/* Supplier Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.supplierChips}>
            <TouchableOpacity
              style={[s.supplierChip, shareSupplier === "all" && s.supplierChipActive]}
              onPress={() => setShareSupplier("all")}
              activeOpacity={0.8}
            >
              <Text style={[s.supplierChipText, shareSupplier === "all" && s.supplierChipTextActive]}>
                الكل
              </Text>
            </TouchableOpacity>
            {suppliers.map(sup => (
              <TouchableOpacity
                key={sup.id}
                style={[s.supplierChip, shareSupplier === sup.name && s.supplierChipActive]}
                onPress={() => setShareSupplier(sup.name)}
                activeOpacity={0.8}
              >
                <Text style={[s.supplierChipText, shareSupplier === sup.name && s.supplierChipTextActive]}>
                  {sup.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Preview */}
          <View style={s.previewBox}>
            <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator>
              <Text style={s.previewText}>{whatsAppText}</Text>
            </ScrollView>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[s.waBtn, !shareItems.length && s.actionDisabled]}
            disabled={!shareItems.length}
            onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(whatsAppText)}`)}
            activeOpacity={0.85}
          >
            <Text style={s.waBtnText}>فتح في واتساب</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.copyBtn, !shareItems.length && s.actionDisabled]}
            disabled={!shareItems.length}
            onPress={async () => {
              if (Platform.OS === "web" && navigator.clipboard) {
                await navigator.clipboard.writeText(whatsAppText);
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 3000);
            }}
            activeOpacity={0.85}
          >
            <Text style={s.copyBtnText}>{copied ? "تم النسخ" : "نسخ النص"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.closeSheetBtn} onPress={() => setShareOpen(false)} activeOpacity={0.8}>
            <Text style={s.closeSheetBtnText}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Alternatives Modal                                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal visible={altOpen} transparent animationType="fade" onRequestClose={() => setAltOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setAltOpen(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>بدائل متوفرة في المخزون</Text>
          <Text style={s.sheetSub}>{`${altSource?.name ?? ""} · ${itemsWord(alternatives.length)}`}</Text>

          {alternatives.length > 0 ? (
            <ScrollView style={{ maxHeight: 300, marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {alternatives.map(alt => (
                <View key={alt.id} style={s.altRow}>
                  <View style={s.catalogText}>
                    <Text style={s.altName}>{alt.name}</Text>
                    <Text style={s.altMeta}>{`${alt.category} · متاح ${num(alt.quantity)}`}</Text>
                  </View>
                  <Text style={s.altPrice}>{formatCurrency(alt.price)}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={s.empty}>
              <RoundIcon name="magnifyingglass" color={COLORS.muted} background={COLORS.mint} />
              <Text style={s.emptyTitle}>لا توجد بدائل مباشرة في المخزون</Text>
              <Text style={s.emptySub}>جرّب البحث عن صنف بنفس المادة الفعالة أو نفس التصنيف في دليل الأصناف.</Text>
            </View>
          )}

          <TouchableOpacity style={s.closeSheetBtn} onPress={() => setAltOpen(false)} activeOpacity={0.8}>
            <Text style={s.closeSheetBtnText}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Inline confirmation (replaces system Alert)                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal visible={Boolean(confirmSheet)} transparent animationType="fade" onRequestClose={() => setConfirmSheet(null)}>
        <Pressable style={s.confirmBackdrop} onPress={() => setConfirmSheet(null)} />
        <View style={s.confirmWrap}>
          <View style={s.confirmSheet}>
            <Text style={s.confirmTitle}>{confirmSheet?.title}</Text>
            <Text style={s.confirmBody}>{confirmSheet?.body}</Text>
            <View style={s.confirmActions}>
              {confirmSheet?.actions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={[s.confirmBtn, action.tone === "danger" && s.confirmBtnDanger, action.tone === "primary" && s.confirmBtnPrimary, action.tone === "success" && s.confirmBtnSuccess]}
                  onPress={action.onPress}
                  activeOpacity={0.85}
                >
                  <Text style={[s.confirmBtnText, action.tone === "danger" && s.confirmBtnTextDanger, (action.tone === "primary" || action.tone === "success") && s.confirmBtnTextLight]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ShortageCard Component — بطاقة بسيطة ومريحة للعين
// ─────────────────────────────────────────────────────────────────────────────
function ShortageCard({
  item,
  onPress,
}: {
  item: ReorderNeed;
  onPress: () => void;

}) {
  const isOut     = item.medication.quantity === 0;
  const isOrdered = item.status === "ordered";
  const isReceived = item.status === "received";
  const accent    = urgencyColor(item);

  return (
    <TouchableOpacity
      style={[s.card, isOut && !isOrdered && !isReceived && s.cardOut, isOrdered && s.cardOrdered, isReceived && s.cardReceived]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Left accent bar */}
      <View style={[s.cardBar, { backgroundColor: accent }]} />

      <View style={s.cardBody}>
        {/* Top row: name + status badge */}
        <View style={s.cardTopRow}>
          <Text style={s.cardName} numberOfLines={2}>{item.medication.name}</Text>
          <View style={[s.statusPill, { backgroundColor: statusColor(item.status) + "18" }]}>
            <Text style={[s.statusPillText, { color: statusColor(item.status) }]}>
              {isOut && item.status === "needed" ? "نافد" : statusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={s.cardInfoRow}>
          <Text style={s.cardStockLine}>{isOut ? "نفد من المخزون" : `متاح ${num(item.medication.quantity)} · حد الطلب ${num(item.medication.reorderLevel)}`}</Text>
          {Boolean(item.customerName) ? <Text style={s.cardInlineTag} numberOfLines={1}>طلب {item.customerName}</Text> : null}
          {Boolean(item.notes) && !item.customerName ? <Text style={s.cardInlineNote} numberOfLines={1}>{item.notes}</Text> : null}
        </View>

        <View style={s.cardBottomRow}>
          <Text style={s.cardCaption} numberOfLines={1}>
            {[
              item.requestedByName ? `د. ${item.requestedByName}` : null,
              hourFormatter.format(new Date(item.orderedAt ?? Date.now())),
              isOrdered && item.supplierName ? item.supplierName : null,
              isOrdered && item.receivedQty ? `استلام ${num(item.receivedQty)} من ${num(item.desiredQuantity ?? 0)}` : null,
              isReceived ? "تم الاستلام" : null,
            ].filter(Boolean).join(" · ")}
          </Text>
          <View style={s.cardQtyBox}>
            <Text style={s.cardQty}>{num(item.desiredQuantity ?? 1)}</Text>
            <Text style={s.cardQtyUnit}>{item.unit ?? "علبة"}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────


function InfoBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={s.infoBox}>
      <View style={s.infoBoxValueRow}>
        {danger ? <IconSymbol name="exclamationmark.triangle.fill" size={13} color={COLORS.danger} /> : null}
        <Text style={[s.infoBoxValue, danger && { color: COLORS.danger }]}>{value}</Text>
      </View>
      <Text style={s.infoBoxLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 5,
    gap: 10,
  },
  shareBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shareBtnText: { fontSize: 12, fontWeight: "900", color: COLORS.ink },

  // ── Filter tiles ─────────────────────────────────────────────────────────
  tiles: { flexDirection: "row-reverse", gap: 7, paddingHorizontal: 16, marginBottom: 8 },
  tile: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 64,
  },
  tileActive: { backgroundColor: COLORS.deep, borderColor: COLORS.deep },
  tileValue: { fontSize: 18, fontWeight: "900" },
  tileLabel: { fontSize: 11, fontWeight: "900", color: COLORS.ink, textAlign: "right" },
  tileCaption: { fontSize: 9, lineHeight: 15, color: COLORS.muted, textAlign: "right" },

  // ── Search ───────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#F2F1EE",
    borderRadius: 21,
    marginHorizontal: 16,
    paddingHorizontal: 15,
    minHeight: 48,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
    textAlign: "right",
    writingDirection: "rtl",
    paddingVertical: 0,
  },
  countRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 8 },
  countText: { fontSize: 11, fontWeight: "800", color: COLORS.muted, textAlign: "right" },
  resetText: { fontSize: 11, fontWeight: "900", color: COLORS.primary },

  // ── List ─────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 110,
    flexGrow: 1,
  },

  // ── Shortage Card ─────────────────────────────────────────────────────────
  card: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  cardOut:      { borderColor: COLORS.softDanger, backgroundColor: "#FFFBFA" },
  cardOrdered:  { borderColor: COLORS.softWarning, backgroundColor: "#FFFCFA" },
  cardReceived: { borderColor: COLORS.mint, backgroundColor: "#FAFDFB" },

  cardBar: { width: 4 },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 11 },

  cardTopRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.ink,
    textAlign: "right",
    lineHeight: 21,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusPillText: { fontSize: 10, fontWeight: "900" },

  cardMeta:     { fontSize: 11, color: COLORS.muted, textAlign: "right", marginTop: 3 },

  cardCustomerTag: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    backgroundColor: COLORS.softBlue,
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cardCustomerTagText: { fontSize: 11, fontWeight: "800", color: COLORS.primary },

  cardNotes: { fontSize: 11, color: COLORS.muted, textAlign: "right", marginTop: 4 },

  cardCaption: { color: COLORS.muted, fontSize: 10, textAlign: "right", flex: 1, marginTop: 7 },
  cardInfoRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", flexWrap: "wrap", gap: 6, marginTop: 5 },
  cardStockLine: { color: COLORS.muted, fontSize: 10.5, textAlign: "right" },
  cardInlineTag: { color: COLORS.primary, backgroundColor: COLORS.mint, fontSize: 10, fontWeight: "800", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, maxWidth: "60%" },
  cardInlineNote: { color: UNAVAILABLE_TAG_TEXT, backgroundColor: "#FDF0E9", fontSize: 10, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, maxWidth: "75%" },
  cardQtyBox: { minWidth: 48, alignItems: "center", backgroundColor: COLORS.mint, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, marginTop: 4 },
  cardQty: { color: COLORS.primary, fontSize: 18, fontWeight: "900" },
  cardQtyUnit: { color: "#9AA29E", fontSize: 10.5, marginTop: 1 },
  headerActions: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  addBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sectionBar: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 10 },
  sectionBarFill: { width: 4, height: 16, borderRadius: 2 },
  sectionBarText: { color: COLORS.ink, fontSize: 13, fontWeight: "900" },
  sectionBarCount: { color: COLORS.muted, fontSize: 11, fontWeight: "800" },
  orderBar: { position: "absolute", left: 16, right: 16, bottom: 92, minHeight: 54, borderRadius: 18, backgroundColor: COLORS.deep, flexDirection: "row-reverse", alignItems: "center", gap: 9, paddingHorizontal: 16 },
  orderBarText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", flex: 1, textAlign: "right" },
  orderBarCount: { color: "#82E3C0", fontSize: 13, fontWeight: "900" },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },

  cardBottomRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardMetrics: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  metricValue: { fontSize: 16, fontWeight: "900", color: COLORS.ink, textAlign: "center" },
  metricLabel: { fontSize: 10, color: COLORS.muted, textAlign: "center" },
  metricSep:   { width: 1, height: 20, backgroundColor: COLORS.border },

  cardActionBtn: {
    backgroundColor: COLORS.deep,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  cardActionBtnOrdered: { backgroundColor: COLORS.success },
  cardActionBtnText: { fontSize: 12, fontWeight: "900", color: "#FFFFFF" },

  cardReceivedBadge: {
    backgroundColor: COLORS.mint,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  cardReceivedBadgeText: { fontSize: 12, fontWeight: "900", color: COLORS.success },

  // ── Bulk Button ───────────────────────────────────────────────────────────
  bulkBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    backgroundColor: COLORS.deep,
    borderRadius: 20,
    paddingVertical: 15,
  },
  bulkBtnText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },

  // ── Empty State ───────────────────────────────────────────────────────────
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 46, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: COLORS.ink, textAlign: "center", marginTop: 12 },
  emptySub:   { fontSize: 12, color: COLORS.muted, textAlign: "center", marginTop: 5, lineHeight: 19 },
  emptyAction: {
    minHeight: 44,
    marginTop: 18,
    paddingHorizontal: 20,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyActionText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },

  // ── Add button ───────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 20,
    left: 20,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },

  // ── Modal / Sheet Base ────────────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 30,
    maxHeight: "88%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  quickHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 9, marginBottom: 12 },
  quickIconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F2F1EE", alignItems: "center", justifyContent: "center" },
  quickSku: { fontSize: 10, color: COLORS.muted, textAlign: "right", marginTop: 3 },
  quickStatusRow: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 13 },
  quickStock: { color: COLORS.muted, fontSize: 11, fontWeight: "700", marginRight: "auto" },
  quickScroll: { flexGrow: 0, maxHeight: 300 },
  quickEditCard: { backgroundColor: "#F6F7F5", borderRadius: 18, padding: 12, gap: 12 },
  quickField: { gap: 2 },
  quickExistingInfo: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: COLORS.mint, borderRadius: 14, padding: 11, marginTop: 10 },
  quickInfoTitle: { color: COLORS.deep, fontSize: 12, fontWeight: "900", textAlign: "right" },
  quickInfoSub: { color: COLORS.primary, fontSize: 11, textAlign: "right", marginTop: 3 },
  quickNote: { backgroundColor: "#FFF7E9", borderRadius: 13, padding: 11, marginTop: 8, gap: 4 },
  quickSecondaryAction: { flexDirection: "row-reverse", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: "#F2F1EE", marginTop: 10 },
  quickSecondaryText: { flex: 1, color: COLORS.deep, fontSize: 12, fontWeight: "800", textAlign: "right" },
  quickDemandCount: { minWidth: 25, height: 25, borderRadius: 8, backgroundColor: COLORS.mint, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  quickDemandCountText: { color: COLORS.primary, fontSize: 11, fontWeight: "900" },
  quickFooter: { flexDirection: "row-reverse", gap: 10, marginTop: 13 },
  sheetTitle:     { fontSize: 18, fontWeight: "900", color: COLORS.ink, textAlign: "right" },
  sheetSub:       { fontSize: 11, color: COLORS.muted, textAlign: "right", marginTop: 4, lineHeight: 17 },
  sheetDeleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.softDanger,
    alignItems: "center",
    justifyContent: "center",
  },

  // Status chips
  sheetStatusRow:  { flexDirection: "row-reverse", gap: 6, marginBottom: 12, flexWrap: "wrap" },
  statusChip:      { flexDirection: "row-reverse", alignItems: "center", gap: 4, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4 },
  statusChipText:  { fontSize: 11, fontWeight: "900" },

  // Info Grid
  sheetInfoGrid: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#F2F1EE",
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 12,
  },
  infoBox:      { flex: 1, alignItems: "center" },
  infoBoxValueRow: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  infoBoxValue: { fontSize: 18, fontWeight: "900", color: COLORS.ink },
  infoBoxLabel: { fontSize: 10, color: COLORS.muted, marginTop: 3, textAlign: "center" },
  infoSep:      { width: 1, height: 26, backgroundColor: COLORS.border },

  // Customer row in detail
  customerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.mint,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  customerName:  { fontSize: 14, fontWeight: "900", color: COLORS.deep },
  customerPhone: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  callBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callBtnText: { fontSize: 12, fontWeight: "900", color: "#FFFFFF" },

  // Fields
  sheetFields:    { gap: 10 },
  sheetFieldRow:  { flexDirection: "row-reverse", gap: 10 },
  fieldLabel:     { fontSize: 11, fontWeight: "900", color: COLORS.muted, textAlign: "right", marginBottom: 6 },
  fieldInput: {
    backgroundColor: "#F2F1EE",
    borderWidth: 1,
    borderColor: "#F2F1EE",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: COLORS.ink,
    textAlign: "right",
    writingDirection: "rtl",
  },
  fieldInputError: { borderColor: COLORS.danger, backgroundColor: COLORS.softDanger },
  fieldErrorText: { fontSize: 11, fontWeight: "800", color: COLORS.danger, textAlign: "right", marginTop: 6 },

  // Qty Stepper
  qtyRow:    { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  qtyBtn:    { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F2F1EE", alignItems: "center", justifyContent: "center" },
  qtyBtnText:{ fontSize: 18, fontWeight: "900", color: COLORS.ink },
  qtyInput:  { flex: 1, height: 38, borderRadius: 12, backgroundColor: "#F2F1EE", fontSize: 15, fontWeight: "900", color: COLORS.ink, textAlign: "center" },
  qtyInputError: { borderWidth: 1, borderColor: COLORS.danger, backgroundColor: COLORS.softDanger },

  // Demand + Alt buttons
  demandBtn: {
    backgroundColor: "#F2F1EE",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  demandBtnText: { fontSize: 12, fontWeight: "800", color: COLORS.deep },
  altBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: COLORS.mint,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  altBtnText: { fontSize: 12, fontWeight: "800", color: COLORS.primary },

  // Sheet Actions
  sheetActions: { flexDirection: "row-reverse", gap: 10, marginTop: 16 },
  sheetSaveBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#F2F1EE",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSaveBtnText: { fontSize: 13, fontWeight: "900", color: COLORS.ink },
  sheetOrderBtn: {
    flex: 1.5,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  sheetOrderBtnText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },

  // Close button (generic)
  closeSheetBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#F2F1EE",
    alignItems: "center",
    justifyContent: "center",
  },
  closeSheetBtnText: { fontSize: 13, fontWeight: "800", color: COLORS.muted },

  // ── Add Modal ─────────────────────────────────────────────────────────────
  addTabs: {
    flexDirection: "row-reverse",
    backgroundColor: "#F2F1EE",
    borderRadius: 16,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  addTab:           { flex: 1, paddingVertical: 11, borderRadius: 13, alignItems: "center" },
  addTabActive:     { backgroundColor: COLORS.surface },
  addTabText:       { fontSize: 12, fontWeight: "900", color: COLORS.muted },
  addTabInner:      { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6 },
  emptyIconGlyph:   { transform: [{ scaleX: -1 }] },
  confirmBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(13, 36, 32, 0.45)" },
  confirmWrap:      { flex: 1, alignItems: "center", justifyContent: "center", padding: 26 },
  confirmSheet:     { width: "100%", maxWidth: 380, backgroundColor: COLORS.surface, borderRadius: 24, padding: 20 },
  confirmTitle:     { fontSize: 15, fontWeight: "900", color: COLORS.ink, textAlign: "right" },
  confirmBody:      { fontSize: 12, lineHeight: 20, color: COLORS.muted, textAlign: "right", marginTop: 8 },
  confirmActions:   { gap: 8, marginTop: 18 },
  confirmBtn:       { minHeight: 46, borderRadius: 14, backgroundColor: "#F2F1EE", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  confirmBtnDanger: { backgroundColor: COLORS.softDanger },
  confirmBtnPrimary:{ backgroundColor: COLORS.primary },
  confirmBtnSuccess:{ backgroundColor: COLORS.success },
  confirmBtnText:       { fontSize: 13, fontWeight: "900", color: COLORS.ink },
  confirmBtnTextDanger: { color: COLORS.danger },
  confirmBtnTextLight:  { color: "#FFFFFF" },
  addTabTextActive: { color: COLORS.ink },
  addSectionTitle:  { fontSize: 14, fontWeight: "900", color: COLORS.ink, textAlign: "right", marginBottom: 12 },

  customerBox: {
    backgroundColor: "#F2F1EE",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  customerBoxTitle: { fontSize: 12, fontWeight: "900", color: COLORS.deep, textAlign: "right", marginBottom: 8 },

  qtyPickRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  qtyPick: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: "#F2F1EE", borderWidth: 1, borderColor: "#F2F1EE", alignItems: "center", justifyContent: "center" },
  qtyPickOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  qtyPickText: { color: COLORS.ink, fontSize: 15, fontWeight: "800" },
  qtyPickTextOn: { color: "#FFFFFF" },
  toggleRow: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  toggleChip: { minHeight: 42, borderRadius: 13, backgroundColor: "#F2F1EE", paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  toggleChipOn: { backgroundColor: COLORS.deep },
  toggleChipUrgent: { backgroundColor: COLORS.danger },
  toggleChipText: { color: COLORS.ink, fontSize: 12, fontWeight: "800" },
  toggleChipTextOn: { color: "#FFFFFF" },
  tagRow: { flexDirection: "row-reverse", gap: 8, marginTop: 8 },
  tagChip: { minHeight: 34, borderRadius: 11, backgroundColor: COLORS.softWarning, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" },
  tagChipText: { color: UNAVAILABLE_TAG_TEXT, fontSize: 11, fontWeight: "800" },
  urgencyRow:         { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  urgencyChip:        { flex: 1, height: 40, borderRadius: 13, backgroundColor: "#F2F1EE", borderWidth: 1, borderColor: "#F2F1EE", alignItems: "center", justifyContent: "center" },
  urgencyChipText:    { fontSize: 12, fontWeight: "900", color: COLORS.muted },

  addSubmitBtn: {
    marginTop: 4,
    height: 52,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  addSubmitBtnText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },

  // Catalog
  catalogRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  catalogText: { flex: 1, alignItems: "flex-end" },
  catalogName:  { fontSize: 13, fontWeight: "900", color: COLORS.ink, textAlign: "right" },
  catalogMeta:  { fontSize: 10, color: COLORS.muted, textAlign: "right", marginTop: 3 },
  catalogPrice: { fontSize: 11, fontWeight: "800", color: COLORS.deep, textAlign: "right", marginTop: 3 },
  catalogStock: { fontSize: 10, fontWeight: "700", textAlign: "right", marginTop: 3 },
  catalogAddBtn: {
    minWidth: 54,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  catalogAddBtnDone: { backgroundColor: COLORS.mint },
  catalogAddBtnText: { fontSize: 12, fontWeight: "900", color: "#FFFFFF" },

  noResults:   { textAlign: "center", color: COLORS.muted, paddingVertical: 26, fontSize: 12, lineHeight: 20 },
  addedNotice: { backgroundColor: COLORS.mint, borderRadius: 14, padding: 12, marginTop: 10, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  addedNoticeText: { flex: 1, fontSize: 12, fontWeight: "800", color: COLORS.primary, textAlign: "right" },

  // ── WhatsApp Modal ────────────────────────────────────────────────────────
  supplierChips: { flexDirection: "row-reverse", gap: 8, paddingVertical: 8 },
  supplierChip:  { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 20, backgroundColor: "#F2F1EE", borderWidth: 1, borderColor: "#F2F1EE" },
  supplierChipActive: { backgroundColor: COLORS.deep, borderColor: COLORS.deep },
  supplierChipText:       { fontSize: 12, fontWeight: "800", color: COLORS.muted },
  supplierChipTextActive: { color: "#FFFFFF" },

  previewBox: {
    backgroundColor: "#F2F1EE",
    borderRadius: 18,
    padding: 14,
    marginVertical: 10,
  },
  previewText: { fontSize: 12, lineHeight: 19, color: COLORS.ink, textAlign: "right" },

  waBtn: {
    height: 52,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  waBtnText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
  actionDisabled: { opacity: 0.5 },

  copyBtn: {
    height: 46,
    borderRadius: 15,
    backgroundColor: "#F2F1EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  copyBtnText: { fontSize: 13, fontWeight: "800", color: COLORS.ink },

  // ── Alternatives Modal ─────────────────────────────────────────────────────
  altRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  altName:  { fontSize: 14, fontWeight: "900", color: COLORS.ink, textAlign: "right" },
  altMeta:  { fontSize: 11, color: COLORS.muted, textAlign: "right", marginTop: 2 },
  altPrice: { fontSize: 13, fontWeight: "900", color: COLORS.primary },
});
