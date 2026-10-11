import { router } from "expo-router";
import { memo, useDeferredValue, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Badge, COLORS, PageHeader, RoundIcon } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useCatalogSearch } from "@/hooks/use-catalog-search";
import { useLatestPriceFeed } from "@/hooks/use-latest-price-feed";
import { listOfflineCatalog, offlineCatalogSize } from "@/lib/offline-catalog";

type CatalogProduct = {
  externalId: string;
  name: string;
  arabicName: string;
  currentPrice: string | number;
  previousPrice: string | number | null;
  soldTimes: number;
  activeIngredient: string | null;
  category: string | null;
  company: string | null;
  barcode: string | null;
  sourceUpdatedAt: number;
};

const PAGE_SIZE = 100;
const priceFormatter = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 });
const updateFormatter = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const formatPrice = (value: string | number) => `${priceFormatter.format(Number(value))} ج.م`;
const formatUpdate = (value: number) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? updateFormatter.format(new Date(timestamp)) : "غير محدد";
};

export default function CatalogScreen() {
  const [search, setSearch] = useState("");
  const [refreshError, setRefreshError] = useState<string>();
  const [page, setPage] = useState(0);
  const query = useDeferredValue(search.trim());
  const canSearch = query.length >= 2;
  const offset = page * PAGE_SIZE;
  const [offlineTotal, setOfflineTotal] = useState(0);
  const [offlinePage, setOfflinePage] = useState<CatalogProduct[]>([]);
  const latestFeed = useLatestPriceFeed(page, !canSearch);
  const catalogQuery = useCatalogSearch(query, { limit: PAGE_SIZE, offset, enabled: canSearch });
  const usingServerFeed = !canSearch && latestFeed.items.length > 0;

  const products = (canSearch ? (catalogQuery.data?.items ?? []) : usingServerFeed ? latestFeed.items : offlinePage) as CatalogProduct[];
  const total = canSearch ? (catalogQuery.data?.total ?? 0) : usingServerFeed ? latestFeed.cacheCount : offlineTotal;
  const pageCount = canSearch ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : usingServerFeed ? Math.max(1, Math.ceil(Math.max(latestFeed.cacheCount, 1) / PAGE_SIZE)) : Math.max(1, Math.ceil(Math.max(offlineTotal, 1) / PAGE_SIZE));
  const busy = canSearch ? catalogQuery.isFetching : usingServerFeed ? latestFeed.isFetching : offlinePage.length === 0;
  const hasNext = canSearch ? page < pageCount - 1 : usingServerFeed ? latestFeed.hasNext : offset + PAGE_SIZE < offlineTotal;

  useEffect(() => { void offlineCatalogSize().then(setOfflineTotal); }, []);

  // الدليل المشحون داخل التطبيق يغني الصفحة عن السيرفر والشبكة.
  useEffect(() => {
    if (canSearch || usingServerFeed) return;
    let cancelled = false;
    void listOfflineCatalog(PAGE_SIZE, offset).then((items) => { if (!cancelled) setOfflinePage(items as unknown as CatalogProduct[]); });
    return () => { cancelled = true; };
  }, [canSearch, usingServerFeed, offset]);

  useEffect(() => { setPage(0); }, [query]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const refreshLatest = async () => {
    setRefreshError(undefined);
    try {
      await latestFeed.refresh();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "تعذر تحديث الأسعار؛ تحقق من الاتصال ثم حاول مرة أخرى.");
    }
  };

  const caption = canSearch ? `نتائج البحث عن «${query}»` : usingServerFeed ? "من المصدر مباشرة: الأحدث أولًا" : "الدليل المحفوظ داخل التطبيق: الأحدث أولًا";
  return <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1"><FlatList data={products} keyExtractor={(item) => item.externalId} renderItem={({ item, index }) => <ProductCard product={item} rank={offset + index + 1} />} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" initialNumToRender={8} maxToRenderPerBatch={8} updateCellsBatchingPeriod={24} windowSize={7} contentContainerStyle={styles.content} ItemSeparatorComponent={() => <View style={styles.separator} />} ListHeaderComponent={<View><TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.75}><IconSymbol name="chevron.right" size={20} color={COLORS.ink} /><Text style={styles.backText}>رجوع</Text></TouchableOpacity><PageHeader title="أحدث الأسعار" subtitle="دليل الأدوية والأسعار المتجددة" /><View style={styles.hero}><View style={styles.heroTop}><RoundIcon name="chart.line.uptrend.xyaxis" color="#82E3C0" background="#1E3A34" /><View style={styles.heroText}><Text style={styles.heroEyebrow}>مراقبة السوق الدوائي</Text><Text style={styles.heroTitle}>أسعار مرتبة ودليل شامل</Text><Text style={styles.heroSub}>{offlineTotal ? offlineTotal.toLocaleString("ar-EG") : "—"} صنف متاح للبحث داخل الجهاز</Text></View></View><View style={styles.heroStats}><HeroStat label="محفوظ محليًا" value={total.toLocaleString("ar-EG")} /><HeroStat label="الصفحة" value={String(page + 1)} /><HeroStat label="المعروض" value={products.length.toLocaleString("ar-EG")} /></View></View><View style={styles.searchBox}><IconSymbol name="magnifyingglass" size={20} color={COLORS.muted} /><TextInput value={search} onChangeText={handleSearch} placeholder="ابحث بالاسم أو المادة الفعالة أو الشركة أو الباركود" placeholderTextColor="#96A5A2" style={styles.searchInput} returnKeyType="search" />{search ? <TouchableOpacity onPress={() => handleSearch("")} hitSlop={10} style={styles.clearButton} activeOpacity={0.75} accessibilityLabel="مسح البحث"><IconSymbol name="xmark" size={15} color="#FFFFFF" /></TouchableOpacity> : null}</View><View style={styles.sectionHeader}><TouchableOpacity onPress={refreshLatest} disabled={!latestFeed.isReady} style={styles.refresh} activeOpacity={0.75}>{busy && !canSearch ? <ActivityIndicator size="small" color={COLORS.primary} /> : <IconSymbol name="arrow.clockwise" size={17} color={COLORS.primary} />}<Text style={styles.refreshText}>تحديث</Text></TouchableOpacity><Text style={styles.sectionTitle}>ترتيب المصدر: الأحدث أولًا</Text></View>{refreshError ? <View style={styles.refreshError}><IconSymbol name="exclamationmark.triangle.fill" size={17} color={COLORS.danger} /><Text style={styles.refreshErrorText}>{refreshError}</Text><TouchableOpacity onPress={() => setRefreshError(undefined)} hitSlop={8} style={styles.refreshErrorClose} activeOpacity={0.75}><IconSymbol name="xmark" size={13} color={COLORS.danger} /></TouchableOpacity></View> : null}<View style={styles.resultRow}><Text style={styles.resultLabel}>{busy ? "جارٍ جلب النتائج..." : !canSearch && search.trim() ? "اكتب حرفين على الأقل للبحث في الدليل، وتعرض القائمة الحالية أحدث الأسعار." : !canSearch && latestFeed.isUpdatingInBackground ? "تُجهّز بقية القائمة في الخلفية" : caption}</Text><Text style={styles.resultCount}>{total.toLocaleString("ar-EG")} صنف</Text></View></View>} ListEmptyComponent={<CatalogEmpty loading={busy} isSearching={canSearch} />} ListFooterComponent={products.length ? <Pagination page={page} pages={pageCount} hasNext={hasNext} showTotal={canSearch} onPrevious={() => setPage((current) => Math.max(0, current - 1))} onNext={() => setPage((current) => hasNext ? current + 1 : current)} /> : null} /></ScreenContainer>;
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.heroStat}><Text style={styles.heroStatValue}>{value}</Text><Text style={styles.heroStatLabel}>{label}</Text></View>;
}

const ProductCard = memo(function ProductCard({ product, rank }: { product: CatalogProduct; rank: number }) {
  const hasPriceChange = product.previousPrice !== null && Number(product.previousPrice) !== Number(product.currentPrice);
  const difference = hasPriceChange ? Number(product.currentPrice) - Number(product.previousPrice) : 0;
  const direction = difference > 0 ? "زيادة" : difference < 0 ? "انخفاض" : "ثابت";
  const badgeTone = difference > 0 ? "warning" : difference < 0 ? "success" : "neutral";
  return <View style={styles.productCard}><View style={styles.productTop}><View style={styles.rank}><Text style={styles.rankText}>{rank.toLocaleString("ar-EG")}</Text></View><View style={styles.productText}><View style={styles.productTitleRow}><Text style={styles.productArabic} numberOfLines={2}>{product.arabicName}</Text>{hasPriceChange ? <Badge label={direction} tone={badgeTone} /> : null}</View><Text style={styles.productEnglish} numberOfLines={1}>{product.name}</Text>{product.company || product.category ? <Text style={styles.productDetail} numberOfLines={1}>{[product.company, product.category].filter(Boolean).join(" · ")}</Text> : null}</View></View><View style={styles.priceStrip}><View style={styles.priceBlock}><Text style={styles.priceLabel}>السعر الحالي</Text><Text style={styles.currentPrice}>{formatPrice(product.currentPrice)}</Text></View>{hasPriceChange ? <View style={styles.priceBlock}><Text style={styles.priceLabel}>السعر السابق</Text><Text style={styles.previousPrice}>{formatPrice(product.previousPrice as string | number)}</Text></View> : null}<View style={styles.priceBlock}><Text style={styles.priceLabel}>فرق السعر</Text><Text style={[styles.difference, difference > 0 ? styles.differenceUp : difference < 0 ? styles.differenceDown : null]}>{hasPriceChange ? `${difference > 0 ? "+" : ""}${formatPrice(difference)}` : "—"}</Text></View></View><View style={styles.productFooter}><Text style={styles.externalId}>{product.barcode ? `باركود ${product.barcode}` : `كود ${product.externalId}`}</Text><Text style={styles.updatedAt}>تحديث {formatUpdate(product.sourceUpdatedAt)}</Text></View></View>;
});

function Pagination({ page, pages, hasNext, showTotal, onPrevious, onNext }: { page: number; pages: number; hasNext: boolean; showTotal: boolean; onPrevious: () => void; onNext: () => void }) {
  if (pages <= 1 && !hasNext) return null;
  return <View style={styles.pagination}><TouchableOpacity onPress={onNext} disabled={!hasNext} style={[styles.pageButton, !hasNext && styles.pageDisabled]} activeOpacity={0.75}><Text style={styles.pageButtonText}>التالي</Text><IconSymbol name="chevron.left" size={18} color={COLORS.primary} /></TouchableOpacity><Text style={styles.pageLabel}>صفحة {page + 1}{showTotal && pages > 1 ? ` من ${pages}` : ""}</Text><TouchableOpacity onPress={onPrevious} disabled={page === 0} style={[styles.pageButton, page === 0 && styles.pageDisabled]} activeOpacity={0.75}><IconSymbol name="chevron.right" size={18} color={COLORS.primary} /><Text style={styles.pageButtonText}>السابق</Text></TouchableOpacity></View>;
}

function CatalogEmpty({ loading, isSearching }: { loading: boolean; isSearching: boolean }) {
  if (loading) return <View style={styles.empty}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.emptyTitle}>جارٍ تحميل البيانات</Text></View>;
  return <View style={styles.empty}><RoundIcon name={isSearching ? "magnifyingglass" : "chart.line.uptrend.xyaxis"} color={COLORS.muted} background="#EEF3F1" /><Text style={styles.emptyTitle}>{isSearching ? "لا توجد نتائج مطابقة" : "لا توجد تغيرات سعرية حديثة"}</Text><Text style={styles.emptyText}>{isSearching ? "جرّب جزءًا آخر من الاسم أو المادة الفعالة أو اسم الشركة." : "اضغط تحديث لجلب أحدث تغيرات الأسعار."}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 112 }, back: { flexDirection: "row-reverse", alignSelf: "flex-end", alignItems: "center", gap: 3, marginBottom: 13, paddingVertical: 4 }, backText: { color: COLORS.ink, fontSize: 13, fontWeight: "800" }, hero: { borderRadius: 24, padding: 17, backgroundColor: COLORS.deep, marginBottom: 16 }, heroTop: { flexDirection: "row-reverse", alignItems: "center", gap: 12 }, heroText: { flex: 1, alignItems: "flex-end" }, heroEyebrow: { color: "#A9B6B2", fontSize: 10, fontWeight: "800" }, heroTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginTop: 3, textAlign: "right" }, heroSub: { color: "#82E3C0", fontSize: 11, marginTop: 4, textAlign: "right" }, heroStats: { flexDirection: "row-reverse", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.25)", marginTop: 15, paddingTop: 12 }, heroStat: { flex: 1, alignItems: "flex-end", borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(255,255,255,0.2)", paddingLeft: 8 }, heroStatValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }, heroStatLabel: { color: "#BDEBE5", fontSize: 9, marginTop: 3 }, searchBox: { height: 54, backgroundColor: "#F2F1EE", borderRadius: 21, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 14, gap: 9 }, searchInput: { flex: 1, fontSize: 13, color: COLORS.ink, textAlign: "right", writingDirection: "rtl" }, clearButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#C2CCC9", alignItems: "center", justifyContent: "center" }, refreshError: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, backgroundColor: COLORS.softDanger, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, marginTop: 12 }, refreshErrorText: { flex: 1, color: COLORS.danger, fontSize: 11, fontWeight: "800", lineHeight: 18, textAlign: "right" }, refreshErrorClose: { width: 24, height: 24, alignItems: "center", justifyContent: "center" }, sectionHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 18 }, sectionTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900", textAlign: "right" }, refresh: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingVertical: 4 }, refreshText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" }, resultRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 19, marginBottom: 10 }, resultLabel: { color: COLORS.ink, fontSize: 14, fontWeight: "900", textAlign: "right", flex: 1 }, resultCount: { color: COLORS.primary, fontSize: 11, fontWeight: "900", marginRight: 9 }, separator: { height: 10 }, productCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 14 }, productTop: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }, rank: { minWidth: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.mint, alignItems: "center", justifyContent: "center" }, rankText: { color: COLORS.primary, fontSize: 10, fontWeight: "900" }, productText: { flex: 1, alignItems: "flex-end" }, productTitleRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 7, width: "100%" }, productArabic: { flex: 1, color: COLORS.ink, fontSize: 14, fontWeight: "900", lineHeight: 20, textAlign: "right" }, productEnglish: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 3, textAlign: "right", alignSelf: "stretch" }, productDetail: { color: COLORS.muted, fontSize: 10, marginTop: 4, textAlign: "right", alignSelf: "stretch" }, priceStrip: { flexDirection: "row-reverse", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, marginTop: 12, paddingTop: 11 }, priceBlock: { flex: 1, alignItems: "flex-end" }, priceLabel: { color: COLORS.muted, fontSize: 9, textAlign: "right" }, currentPrice: { color: COLORS.primary, fontSize: 13, fontWeight: "900", marginTop: 3, writingDirection: "ltr" }, previousPrice: { color: COLORS.muted, fontSize: 11, fontWeight: "800", marginTop: 4, textDecorationLine: "line-through", writingDirection: "ltr" }, difference: { color: COLORS.muted, fontSize: 11, fontWeight: "900", marginTop: 4, writingDirection: "ltr" }, differenceUp: { color: COLORS.warning }, differenceDown: { color: COLORS.success }, productFooter: { flexDirection: "row-reverse", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, marginTop: 11, paddingTop: 9 }, externalId: { color: COLORS.muted, fontSize: 9, maxWidth: "48%" }, updatedAt: { color: COLORS.muted, fontSize: 9, textAlign: "right" }, pagination: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }, pageButton: { minWidth: 80, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.mint }, pageButtonText: { color: COLORS.primary, fontSize: 11, fontWeight: "900" }, pageDisabled: { opacity: 0.38 }, pageLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "800" }, empty: { alignItems: "center", paddingTop: 58 }, emptyTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900", marginTop: 13, textAlign: "center" }, emptyText: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 5, textAlign: "center" },
});
