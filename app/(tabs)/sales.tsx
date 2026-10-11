import { router } from "expo-router";
import { useDeferredValue, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useCatalogSearch } from "@/hooks/use-catalog-search";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { COLORS, RoundIcon, commonStyles } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CartItem, calculateCashChange, formatCurrency, getUnitPrice, usePharmacy } from "@/lib/pharmacy-context";
import { ScreenContainer } from "@/components/screen-container";
import { useLatestPriceFeed } from "@/hooks/use-latest-price-feed";
import { useStaffAudit } from "@/hooks/use-staff-audit";
import { isUsbPrintingAvailable, printReceiptUsb } from "@/lib/printer-service";
import { trpc } from "@/lib/trpc";

type CatalogProduct = { externalId: string; arabicName: string; name: string; barcode: string | null; company: string | null; currentPrice: string | number; unitsPerPackage: number };
type PaymentMethod = "نقدي" | "فودافون كاش";
type Notice = { tone: "error" | "success"; text: string };
type Receipt = { number: string; items: number; total: number; change: number; method: PaymentMethod; printed: boolean; printError?: string };

export default function SalesScreen() {
  const { medications, completeSale, settings, activeShift } = usePharmacy();
  const audit = useStaffAudit();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("نقدي");
  const [cashReceived, setCashReceived] = useState("");
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showAllStock, setShowAllStock] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [receipt, setReceipt] = useState<Receipt>();
  const [cashError, setCashError] = useState<string>();
  const deferredSearch = useDeferredValue(search.trim());
  const catalogQuery = useCatalogSearch(deferredSearch, { limit: 20 });
  // بحث احتياطي في آخر 1000 صنف مخزّنين محليًا عندما يكون دليل MySQL غير متاح.
  const catalogFeed = useLatestPriceFeed(0, deferredSearch.length >= 2);
  const localMatches = useMemo(() => medications.filter((item) => item.quantity > 0 && (!deferredSearch || [item.name, item.category, item.sku, item.barcode ?? ""].some((value) => value.toLowerCase().includes(deferredSearch.toLowerCase())))), [deferredSearch, medications]);
  const visibleLocalMatches = showAllStock ? localMatches : localMatches.slice(0, 4);
  const feedMatches = useMemo(() => {
    const term = deferredSearch.toLowerCase();
    return (catalogFeed.items as unknown as CatalogProduct[]).filter((product) => [product.arabicName, product.name, product.company, product.barcode ?? ""].some((value) => (value ?? "").toLowerCase().includes(term))).slice(0, 20);
  }, [catalogFeed.items, deferredSearch]);
  const catalogMatches = (catalogQuery.data?.items?.length ? catalogQuery.data.items : feedMatches) as CatalogProduct[];
  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const enteredCash = Number(cashReceived.replace(/,/g, "")) || 0;
  const change = calculateCashChange(total, enteredCash);
  const findLocal = (product: CatalogProduct) => medications.find((item) => item.catalogId === product.externalId || (product.barcode && item.barcode === product.barcode) || item.sku === product.externalId);

  const addToCart = (id: string) => {
    const product = medications.find((item) => item.id === id);
    if (!product || product.quantity === 0) return setNotice({ tone: "error", text: "لا توجد وحدات بيع متاحة لهذا الصنف حاليًا." });
    const currentQuantity = cart.find((item) => item.medicationId === id)?.quantity ?? 0;
    if (currentQuantity >= product.quantity) return setNotice({ tone: "error", text: `المتاح من «${product.name}» ${product.quantity.toLocaleString("ar-EG")} وحدة فقط، وهي مضافة بالفعل.` });
    const unitPrice = getUnitPrice(product);
    setNotice(undefined);
    setCart((current) => current.some((item) => item.medicationId === id) ? current.map((item) => item.medicationId === id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { medicationId: product.id, name: product.name, unitPrice, quantity: 1, unitLabel: "وحدة" }]);
  };

  const changeQuantity = (id: string, delta: number) => setCart((current) => current.flatMap((item) => { const available = medications.find((product) => product.id === id)?.quantity ?? 0; const next = Math.min(available, item.quantity + delta); return item.medicationId !== id ? [item] : next > 0 ? [{ ...item, quantity: next }] : []; }));
  const finishSale = async (received?: number) => {
    if (!activeShift) { setPaymentVisible(false); return setNotice({ tone: "error", text: "لا يوجد شيفت مفتوح؛ ابدأ شيفتًا من صفحة الخزينة قبل حفظ الفاتورة." }); }
    const shortItem = cart.find((item) => (medications.find((product) => product.id === item.medicationId)?.quantity ?? 0) < item.quantity);
    if (shortItem) { setPaymentVisible(false); return setNotice({ tone: "error", text: `المتاح في المخزون من «${shortItem.name}» أقل من الكمية المطلوبة في الفاتورة.` }); }
    const items = cart.map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice }));
    const succeeded = completeSale(cart, paymentMethod, paymentMethod === "نقدي" ? { cashReceived: received, change: calculateCashChange(total, received ?? 0) } : undefined);
    if (!succeeded) { setPaymentVisible(false); return setNotice({ tone: "error", text: "تعذّر إتمام البيع. راجع الوحدات المتاحة والمبلغ المدفوع." }); }
    const paidChange = calculateCashChange(total, received ?? 0);
    const receiptNumber = `S-${Date.now().toString().slice(-6)}`;
    audit({ action: "sale.completed", entityType: "sale", entityId: receiptNumber, detail: `تم تسجيل فاتورة بيع بقيمة ${total.toFixed(2)} ج.م.`, metadata: { paymentMethod, itemCount: cart.length, total } });
    let printed = false;
    let printError: string | undefined;
    if (isUsbPrintingAvailable && settings.printer.savedPrinter) {
      try { await printReceiptUsb(settings.printer.savedPrinter, { receiptNumber, createdAt: new Date().toISOString(), items, total, paymentMethod, cashReceived: received, change: paidChange }, settings.printer.baudRate); printed = true; }
      catch (error) { printError = error instanceof Error ? error.message : "تحقق من كابل USB والطابعة."; }
    }
    setCart([]); setPaymentVisible(false); setCashReceived(""); setCashError(undefined); setNotice(undefined);
    setReceipt({ number: receiptNumber, items: items.length, total, change: paidChange, method: paymentMethod, printed, printError });
  };
  const handleCheckout = () => { if (!cart.length) return; setNotice(undefined); if (!activeShift) { setNotice({ tone: "error", text: "لا يوجد شيفت مفتوح؛ ابدأ شيفتًا من صفحة الخزينة قبل حفظ الفاتورة." }); return; } setCashError(undefined); if (paymentMethod === "نقدي") setCashReceived(String(total)); setPaymentVisible(true); };
  const confirmCash = () => { if (enteredCash < total) return setCashError(`المبلغ غير كافٍ. المطلوب ${formatCurrency(total)} والمستلم ${formatCurrency(enteredCash)}.`); void finishSale(enteredCash); };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="flex-1">
    <View style={styles.screen}>
      <View style={styles.fixedHeader}>
        <View style={styles.topBar}><TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.75}><IconSymbol name="chevron.right" size={21} color={COLORS.ink} /></TouchableOpacity><View style={styles.cashierHeading}><Text style={styles.eyebrow}>نقطة البيع · فاتورة جديدة</Text><Text style={styles.cashierTitle}>الكاشير</Text></View><TouchableOpacity onPress={() => setScannerOpen(true)} style={styles.headerScanner} activeOpacity={0.8}><IconSymbol name="barcode.viewfinder" size={22} color="#83E4C3" /></TouchableOpacity></View>
        {activeShift ? null : <View style={styles.shiftBar}><IconSymbol name="clock.fill" size={16} color={COLORS.warning} /><Text style={styles.shiftBarText}>لا يوجد شيفت مفتوح؛ ابدأ شيفتًا لتتمكن من حفظ الفواتير.</Text><TouchableOpacity onPress={() => router.push("/shifts")} style={styles.shiftBarAction} activeOpacity={0.8}><Text style={styles.shiftBarActionText}>بدء شيفت</Text></TouchableOpacity></View>}
        {notice ? <View style={[styles.notice, notice.tone === "error" ? styles.noticeError : styles.noticeSuccess]}><IconSymbol name={notice.tone === "error" ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"} size={17} color={notice.tone === "error" ? COLORS.danger : COLORS.primary} /><Text style={[styles.noticeText, notice.tone === "error" ? styles.noticeTextError : styles.noticeTextSuccess]}>{notice.text}</Text><TouchableOpacity onPress={() => setNotice(undefined)} style={styles.noticeClose} activeOpacity={0.7}><IconSymbol name="xmark" size={14} color={COLORS.muted} /></TouchableOpacity></View> : null}
        <View style={styles.searchBox}><TouchableOpacity onPress={() => setScannerOpen(true)} style={styles.scanButton} activeOpacity={0.8}><IconSymbol name="barcode.viewfinder" size={20} color={COLORS.primary} /></TouchableOpacity><IconSymbol name="magnifyingglass" size={20} color="#969C99" /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم الدواء أو الباركود" placeholderTextColor="#969C99" style={styles.searchInput} returnKeyType="search" /></View>
      </View>
      <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {deferredSearch.length >= 2 ? <><Text style={styles.sectionTitle}>نتائج البحث <Text style={styles.sectionCount}>{catalogMatches.length.toLocaleString("ar-EG")}</Text></Text><View style={styles.productsCard}>{catalogQuery.isFetching || (catalogQuery.isError && !catalogMatches.length && catalogFeed.isFetching) ? <Text style={styles.noProducts}>جارٍ البحث في دليل الأدوية...</Text> : catalogMatches.map((product, index) => { const stockItem = findLocal(product); return <View key={product.externalId}><View style={styles.productRow}><TouchableOpacity onPress={() => stockItem ? addToCart(stockItem.id) : router.push({ pathname: "/medicine-form", params: { catalogId: product.externalId } })} style={styles.addButton} activeOpacity={0.75}><IconSymbol name={stockItem ? "plus.circle.fill" : "shippingbox.fill"} size={23} color={COLORS.primary} /></TouchableOpacity><View style={styles.productText}><Text style={styles.productName}>{product.arabicName}</Text><Text style={styles.productMeta}>{product.company || "دليل الأدوية"} · {product.unitsPerPackage || 1} وحدة/عبوة · {Number(product.currentPrice).toLocaleString("ar-EG")} ج.م</Text><Text style={styles.stockStatus}>{stockItem ? `متاح للبيع: ${stockItem.quantity.toLocaleString("ar-EG")} وحدة` : "سجّله بالمخزون أولًا للبيع"}</Text></View><RoundIcon name="cross.case.fill" /></View>{index < catalogMatches.length - 1 ? <View style={commonStyles.rowDivider} /> : null}</View>; })}{!catalogMatches.length && !catalogQuery.isFetching ? <Text style={styles.noProducts}>لا توجد نتائج مطابقة في الدليل أو آخر {catalogFeed.cacheCount.toLocaleString("ar-EG")} صنف محليًا.</Text> : null}</View></> : null}
        <View style={styles.quickStockSection}>
          <View style={styles.sectionHeadingRow}>
            <TouchableOpacity onPress={() => setShowAllStock((value) => !value)} style={styles.viewAllButton} activeOpacity={0.75}>
              <Text style={styles.viewAllText}>{showAllStock ? "عرض أقل" : "عرض الكل"}</Text><IconSymbol name={showAllStock ? "chevron.up" : "chevron.left"} size={13} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={styles.stockTitleBlock}><Text style={styles.stockSectionTitle}>{deferredSearch ? "من المخزون" : "أصناف جاهزة للبيع"}</Text><Text style={styles.stockSubtitle}>{deferredSearch ? "نتائج متاحة للبيع" : "إضافة سريعة من الأصناف المتوفرة"}</Text></View>
          </View>
          {!localMatches.length ? <View style={styles.stockEmpty}><IconSymbol name="shippingbox" size={18} color={COLORS.muted} /><Text style={styles.noProducts}>لا توجد أصناف متاحة للبيع هنا.</Text></View> : showAllStock ? <View style={styles.productsCard}>{visibleLocalMatches.map((product, index) => <View key={product.id}><View style={styles.productRow}><TouchableOpacity onPress={() => addToCart(product.id)} style={styles.addButton} activeOpacity={0.75}><IconSymbol name="plus.circle.fill" size={23} color={COLORS.primary} /></TouchableOpacity><View style={styles.productText}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productMeta}>{formatCurrency(getUnitPrice(product))} · متاح {product.quantity.toLocaleString("ar-EG")} وحدة</Text></View><RoundIcon name="cross.case.fill" /></View>{index < visibleLocalMatches.length - 1 ? <View style={commonStyles.rowDivider} /> : null}</View>)}</View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickStockList}>
            {visibleLocalMatches.map((product) => <TouchableOpacity key={product.id} onPress={() => addToCart(product.id)} activeOpacity={0.78} style={styles.quickStockCard}>
              <View style={styles.quickStockTop}><View style={styles.quickAddIcon}><IconSymbol name="plus" size={15} color="#FFFFFF" /></View><Text style={styles.quickStockPrice}>{formatCurrency(getUnitPrice(product))}</Text></View>
              <Text style={styles.quickStockName} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.quickStockQty}>متاح {product.quantity.toLocaleString("ar-EG")} وحدة</Text>
            </TouchableOpacity>)}
          </ScrollView>}
          {!showAllStock && localMatches.length > 4 ? <Text style={styles.quickStockFootnote}>أول ٤ أصناف · {localMatches.length.toLocaleString("ar-EG")} صنف متاح في المخزون</Text> : null}
        </View>
        <View style={styles.cartSectionHeader}><View style={styles.cartCountPill}><Text style={styles.cartCountText}>{cart.length.toLocaleString("ar-EG")} صنف</Text></View><Text style={styles.sectionTitle}>سلة الفاتورة</Text></View>
        {cart.length ? <View>{cart.map((item) => { const product = medications.find((medication) => medication.id === item.medicationId); const critical = (product?.quantity ?? 0) <= (product?.reorderLevel ?? 0); return <CartRow key={item.medicationId} item={item} critical={critical} onIncrease={() => changeQuantity(item.medicationId, 1)} onDecrease={() => changeQuantity(item.medicationId, -1)} />; })}</View> : <View style={styles.emptyCart}><RoundIcon name="cart.fill" color={COLORS.muted} background="#F2F1EE" /><Text style={styles.emptyCartText}>السلة لسه فاضية</Text><Text style={styles.emptyCartHint}>ابحث عن الدواء واضغط (+) لإضافته للفاتورة</Text></View>}
        <TouchableOpacity onPress={() => setSearch("")} style={styles.addAnother} activeOpacity={0.75}><View style={styles.addAnotherIcon}><IconSymbol name="plus" size={22} color={COLORS.muted} /></View><Text style={styles.addAnotherText}>بحث عن صنف آخر</Text></TouchableOpacity>
      </ScrollView>
      <View style={styles.checkoutDock}><View style={styles.totalCard}><View style={styles.totalHeader}><View style={styles.totalNumber}><Text style={styles.totalNumberValue}>{cart.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("ar-EG")}</Text><Text style={styles.totalNumberLabel}>وحدة</Text></View><View style={styles.totalLabelBlock}><Text style={styles.totalLabel}>إجمالي الفاتورة</Text><Text style={styles.totalValue}>{formatCurrency(total)}</Text></View></View><View style={styles.checkoutControls}><View style={styles.paymentSelector}>{(["نقدي", "فودافون كاش"] as const).map((method) => <TouchableOpacity key={method} onPress={() => { setPaymentMethod(method); setCashError(undefined); }} style={[styles.payment, paymentMethod === method && styles.paymentActive]} activeOpacity={0.75}><Text style={[styles.paymentText, paymentMethod === method && styles.paymentTextActive]}>{method === "نقدي" ? "نقدي · أساسي" : "فودافون كاش"}</Text></TouchableOpacity>)}</View><TouchableOpacity disabled={!cart.length} onPress={handleCheckout} style={[styles.confirmButton, !cart.length && styles.checkoutDisabled]} activeOpacity={0.82}><Text style={styles.confirmText}>{paymentMethod === "نقدي" ? "تحصيل المبلغ" : "تأكيد استلام التحويل"}</Text><IconSymbol name="arrow.left" size={20} color="#FFFFFF" /></TouchableOpacity></View><Text style={styles.paymentPolicy}>فودافون كاش للحالات الاستثنائية فقط · تأكد من وصول التحويل قبل الحفظ</Text></View></View>
    </View>
    <BarcodeScanner visible={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={setSearch} /><PaymentModal visible={paymentVisible} paymentMethod={paymentMethod} total={total} cashReceived={cashReceived} change={change} error={cashError} onChange={(value) => { setCashReceived(value); setCashError(undefined); }} onClose={() => setPaymentVisible(false)} onConfirm={() => paymentMethod === "نقدي" ? confirmCash() : void finishSale()} /><ReceiptModal receipt={receipt} onClose={() => setReceipt(undefined)} onStartNew={() => { setReceipt(undefined); setSearch(""); setPaymentMethod("نقدي"); setNotice({ tone: "success", text: `فاتورة ${receipt?.number} محفوظة. يمكنك بدء فاتورة جديدة.` }); }} />
  </ScreenContainer>;
}

function CartRow({ item, critical, onIncrease, onDecrease }: { item: CartItem; critical: boolean; onIncrease: () => void; onDecrease: () => void }) {
  return <View style={[styles.cartRow, critical ? styles.cartRowCritical : styles.cartRowAvailable]}><View style={[styles.cartIcon, critical ? styles.cartIconCritical : styles.cartIconAvailable]}><IconSymbol name={critical ? "exclamationmark.triangle.fill" : "cross.case.fill"} size={24} color="#FFFFFF" /></View><View style={styles.cartInfo}><Text style={styles.cartName} numberOfLines={1}>{item.name}</Text><Text style={[styles.cartPrice, critical && styles.cartPriceCritical]}>{formatCurrency(item.unitPrice)} · {item.quantity.toLocaleString("ar-EG")} وحدة</Text></View><View style={styles.quantityControl}><TouchableOpacity onPress={onIncrease} style={[styles.quantityButton, critical && styles.quantityButtonCritical]} activeOpacity={0.7}><Text style={styles.quantityButtonText}>+</Text></TouchableOpacity><Text style={styles.quantityNumber}>{item.quantity.toLocaleString("ar-EG")}</Text><TouchableOpacity onPress={onDecrease} style={styles.quantityButtonMinus} activeOpacity={0.7}><Text style={styles.quantityMinusText}>−</Text></TouchableOpacity></View></View>;
}

function PaymentModal({ visible, paymentMethod, total, cashReceived, change, error, onChange, onClose, onConfirm }: { visible: boolean; paymentMethod: PaymentMethod; total: number; cashReceived: string; change: number; error?: string; onChange: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  const isCash = paymentMethod === "نقدي";
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.paymentSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.75}><IconSymbol name="xmark" size={18} color={COLORS.ink} /></TouchableOpacity><View style={styles.modalHeaderText}><Text style={styles.modalTitle}>{isCash ? "تأكيد الدفع النقدي" : "تأكيد فودافون كاش"}</Text><Text style={styles.modalSubtitle}>{isCash ? "راجع المبلغ قبل حفظ الفاتورة" : "اختيار استثنائي؛ تأكد من وصول التحويل فعلًا قبل التسجيل"}</Text></View></View><View style={styles.paymentSummary}><Text style={styles.summaryLabel}>المطلوب من العميل</Text><Text style={styles.summaryValue}>{formatCurrency(total)}</Text></View>{isCash ? <><Text style={styles.fieldLabel}>المبلغ المستلم</Text><TextInput value={cashReceived} onChangeText={onChange} keyboardType="decimal-pad" style={[styles.cashInput, error && styles.cashInputError]} selectTextOnFocus placeholder="0.00" placeholderTextColor="#969C99" /><Text style={styles.quickHint}>المبلغ مُعبّأ تلقائيًا بقيمة الفاتورة؛ عدّله لو استلم مبلغًا آخر.</Text><View style={styles.changeRow}><Text style={[styles.changeValue, error && styles.changeValueError]}>{formatCurrency(change)}</Text><Text style={styles.changeLabel}>الباقي للعميل</Text></View>{error ? <View style={styles.inlineError}><IconSymbol name="exclamationmark.triangle.fill" size={15} color={COLORS.danger} /><Text style={styles.inlineErrorText}>{error}</Text></View> : null}</> : <View style={styles.vodafoneNotice}><IconSymbol name="checkmark.shield.fill" size={22} color={COLORS.primary} /><Text style={styles.vodafoneNoticeText}>لا تسجل الفاتورة قبل التأكد من وصول المبلغ إلى محفظة الصيدلية، وليس بمجرد رؤية صورة تحويل.</Text></View>}<TouchableOpacity onPress={onConfirm} style={styles.modalConfirm} activeOpacity={0.82}><Text style={styles.confirmText}>{isCash ? "تأكيد وحفظ البيع" : "تأكيد وصول التحويل وحفظ البيع"}</Text><IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" /></TouchableOpacity></View></View></Modal>;
}

function ReceiptModal({ receipt, onClose, onStartNew }: { receipt?: Receipt; onClose: () => void; onStartNew: () => void }) {
  return <Modal visible={Boolean(receipt)} animationType="fade" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.receiptSheet}>{receipt ? <>
    <View style={[styles.receiptBadge, receipt.printError ? styles.receiptBadgeWarn : styles.receiptBadgeOk]}><IconSymbol name={receipt.printError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"} size={26} color={receipt.printError ? COLORS.warning : COLORS.primary} /></View>
    <Text style={styles.receiptTitle}>{receipt.printError ? "حُفظت الفاتورة" : "تم تسجيل البيع"}</Text>
    <Text style={styles.receiptSub}>فاتورة رقم {receipt.number} · {receipt.items.toLocaleString("ar-EG")} صنف · {receipt.method}</Text>
    <View style={styles.receiptRows}>
      <View style={styles.receiptRow}><Text style={styles.receiptRowLabel}>الإجمالي المحفوظ</Text><Text style={styles.receiptRowValue}>{formatCurrency(receipt.total)}</Text></View>
      {receipt.method === "نقدي" ? <View style={styles.receiptRow}><Text style={styles.receiptRowLabel}>الباقي للعميل</Text><Text style={[styles.receiptRowValue, styles.receiptRowAccent]}>{formatCurrency(receipt.change)}</Text></View> : null}
      {receipt.printed ? <View style={styles.receiptRow}><Text style={styles.receiptRowLabel}>الإيصال</Text><Text style={[styles.receiptRowValue, styles.receiptRowAccent]}>أُرسل للطابعة</Text></View> : null}
    </View>
    {receipt.printError ? <View style={styles.inlineError}><IconSymbol name="printer" size={15} color={COLORS.danger} /><Text style={styles.inlineErrorText}>تعذرت الطباعة: {receipt.printError}</Text></View> : null}
    <TouchableOpacity onPress={onStartNew} style={styles.modalConfirm} activeOpacity={0.82}><Text style={styles.confirmText}>فاتورة جديدة</Text><IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" /></TouchableOpacity>
    <TouchableOpacity onPress={onClose} style={styles.receiptClose} activeOpacity={0.75}><Text style={styles.receiptCloseText}>البقاء في الفاتورة</Text></TouchableOpacity>
  </> : null}</View></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
  fixedHeader: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, backgroundColor: COLORS.background },
  resultsScroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 2, paddingBottom: 18 },
  checkoutDock: { paddingHorizontal: 14, paddingTop: 9, paddingBottom: 8, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: "#E7EAE5" },
  topBar: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backButton: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#F2F1EE", alignItems: "center", justifyContent: "center" },
  cashierHeading: { flex: 1, alignItems: "flex-end", paddingRight: 13 },
  eyebrow: { color: COLORS.muted, fontSize: 12, fontWeight: "700" },
  cashierTitle: { color: COLORS.ink, fontSize: 29, lineHeight: 36, fontWeight: "900", marginTop: 1 },
  headerScanner: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.deep, alignItems: "center", justifyContent: "center" },
  searchBox: { height: 52, backgroundColor: COLORS.surface, borderRadius: 17, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 10, gap: 9, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.ink, textAlign: "right", writingDirection: "rtl" },
  scanButton: { width: 37, height: 37, borderRadius: 12, backgroundColor: COLORS.mint, justifyContent: "center", alignItems: "center" },
  sectionTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900", textAlign: "right", marginTop: 19, marginBottom: 10 },
  sectionCount: { color: COLORS.primary, fontSize: 14 },
  sectionHeadingRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 0 },
  quickStockSection: { marginTop: 4, marginBottom: 2 },
  stockTitleBlock: { alignItems: "flex-end", flex: 1 },
  stockSectionTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right" },
  stockSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 2, marginBottom: 8, textAlign: "right" },
  viewAllButton: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: COLORS.mint },
  viewAllText: { color: COLORS.primary, fontSize: 11, fontWeight: "900" },
  quickStockList: { flexDirection: "row-reverse", gap: 8, paddingBottom: 4 },
  quickStockCard: { width: 154, minHeight: 104, borderRadius: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, padding: 10, justifyContent: "space-between" },
  quickStockTop: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  quickAddIcon: { width: 25, height: 25, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  quickStockPrice: { color: COLORS.primary, fontSize: 11, fontWeight: "900" },
  quickStockName: { color: COLORS.ink, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "right", minHeight: 32 },
  quickStockQty: { color: COLORS.muted, fontSize: 10, textAlign: "right", marginTop: 6 },
  quickStockFootnote: { color: COLORS.muted, fontSize: 10, textAlign: "right", marginTop: 4 },
  stockEmpty: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 12, borderRadius: 15, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  sectionHint: { color: COLORS.muted, fontSize: 10, marginTop: 19, marginBottom: 10 },
  cartSectionHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  cartCountPill: { backgroundColor: COLORS.mint, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginTop: 18, marginBottom: 10 },
  cartCountText: { color: COLORS.primary, fontSize: 10, fontWeight: "900" },
  productsCard: { backgroundColor: COLORS.surface, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 15, paddingVertical: 11 },
  productRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, minHeight: 63 },
  productText: { flex: 1, alignItems: "flex-end" },
  productName: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right" },
  productMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4, textAlign: "right" },
  stockStatus: { color: COLORS.primary, fontSize: 10, fontWeight: "800", marginTop: 3 },
  addButton: { width: 35, height: 35, alignItems: "center", justifyContent: "center" },
  noProducts: { color: COLORS.muted, textAlign: "right", fontSize: 12, paddingVertical: 8 },
  emptyCart: { minHeight: 112, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 7, padding: 12 },
  emptyCartText: { color: COLORS.muted, fontSize: 12, textAlign: "center" },
  emptyCartHint: { color: COLORS.muted, fontSize: 10, textAlign: "center" },
  cartRow: { minHeight: 96, borderRadius: 26, padding: 13, marginBottom: 10, flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  cartRowAvailable: { backgroundColor: COLORS.mint },
  cartRowCritical: { backgroundColor: COLORS.softWarning },
  cartIcon: { width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  cartIconAvailable: { backgroundColor: COLORS.primary },
  cartIconCritical: { backgroundColor: COLORS.warning },
  cartInfo: { flex: 1, alignItems: "flex-end" },
  cartName: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right" },
  cartPrice: { color: COLORS.muted, fontSize: 11, marginTop: 5, textAlign: "right" },
  cartPriceCritical: { color: "#8E462C" },
  quantityControl: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  quantityButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  quantityButtonCritical: { backgroundColor: COLORS.warning },
  quantityButtonText: { color: "#FFFFFF", fontSize: 24, lineHeight: 27, fontWeight: "500" },
  quantityNumber: { color: COLORS.ink, minWidth: 19, textAlign: "center", fontSize: 18, fontWeight: "900" },
  quantityButtonMinus: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  quantityMinusText: { color: COLORS.ink, fontSize: 23, lineHeight: 25, fontWeight: "500" },
  addAnother: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderStyle: "dashed", borderColor: "#D6D7D2", backgroundColor: "#FAFAF8", marginTop: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  addAnotherIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  addAnotherText: { color: COLORS.muted, fontSize: 13, fontWeight: "800" },
  totalCard: { backgroundColor: COLORS.deep, borderRadius: 23, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 10, marginTop: 0 },
  totalHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  totalNumber: { alignItems: "flex-end" },
  totalNumberValue: { color: "#B6C4BC", fontSize: 17, fontWeight: "500" },
  totalNumberLabel: { color: "#9EAEA7", fontSize: 11, marginTop: 2 },
  totalLabelBlock: { alignItems: "flex-end" },
  totalLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  totalValue: { color: "#80E2BD", fontSize: 25, lineHeight: 31, fontWeight: "900", marginTop: 1 },
  checkoutControls: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  paymentSelector: { flex: 1, flexDirection: "row-reverse", gap: 5, marginBottom: 0 },
  paymentPolicy: { color: "#B9CCC4", fontSize: 9, textAlign: "right", marginTop: 7, lineHeight: 13 },
  payment: { flex: 1, minHeight: 39, borderRadius: 11, borderWidth: 1, borderColor: "#31534A", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  paymentActive: { backgroundColor: "#24574F", borderColor: "#6FCFA8" },
  paymentText: { color: "#A7B9B1", fontSize: 9, fontWeight: "800", textAlign: "center" },
  paymentTextActive: { color: "#FFFFFF" },
  confirmButton: { flex: 1, minHeight: 43, borderRadius: 13, backgroundColor: COLORS.primary, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 8 },
  confirmText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", textAlign: "center" },
  checkoutDisabled: { opacity: 0.42 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(13,36,32,0.48)", justifyContent: "flex-end" },
  paymentSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 31, borderTopRightRadius: 31, padding: 20, paddingBottom: 34, borderWidth: 1, borderColor: COLORS.border },
  modalHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: "#D4D8D4", alignSelf: "center", marginBottom: 19 },
  modalHeader: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  modalClose: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#F2F1EE", alignItems: "center", justifyContent: "center" },
  modalHeaderText: { flex: 1, alignItems: "flex-end" },
  modalTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "900", textAlign: "right" },
  modalSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 4, textAlign: "right" },
  paymentSummary: { backgroundColor: COLORS.mint, borderRadius: 22, padding: 17, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  summaryLabel: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  summaryValue: { color: COLORS.primary, fontSize: 23, fontWeight: "900" },
  fieldLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "900", textAlign: "right", marginBottom: 7 },
  cashInput: { minHeight: 56, borderRadius: 19, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.surface, color: COLORS.ink, paddingHorizontal: 14, fontSize: 22, fontWeight: "900", textAlign: "right" },
  changeRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingVertical: 15 },
  changeLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "800" },
  changeValue: { color: COLORS.primary, fontSize: 19, fontWeight: "900" },
  modalConfirm: { minHeight: 56, borderRadius: 20, backgroundColor: COLORS.primary, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 9 },
  shiftBar: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: COLORS.softWarning, borderRadius: 17, padding: 13, marginBottom: 12 },
  shiftBarText: { flex: 1, color: "#8E462C", fontSize: 11, fontWeight: "800", textAlign: "right", lineHeight: 18 },
  shiftBarAction: { backgroundColor: COLORS.warning, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 },
  shiftBarActionText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  notice: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderRadius: 17, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 12 },  noticeError: { backgroundColor: COLORS.softDanger },
  noticeSuccess: { backgroundColor: COLORS.mint },
  noticeText: { flex: 1, fontSize: 11, fontWeight: "800", textAlign: "right", lineHeight: 18 },
  noticeTextError: { color: COLORS.danger },
  noticeTextSuccess: { color: COLORS.primary },
  noticeClose: { width: 26, height: 26, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  cashInputError: { borderColor: COLORS.danger },
  quickHint: { color: COLORS.muted, fontSize: 10, marginTop: 7, textAlign: "right" },
  vodafoneNotice: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: COLORS.mint, borderRadius: 16, padding: 13, marginBottom: 14 },
  vodafoneNoticeText: { flex: 1, color: COLORS.primary, fontSize: 11, fontWeight: "800", lineHeight: 18, textAlign: "right" },
  changeValueError: { color: COLORS.danger },
  inlineError: { flexDirection: "row-reverse", alignItems: "center", gap: 7, backgroundColor: COLORS.softDanger, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 13 },
  inlineErrorText: { flex: 1, color: COLORS.danger, fontSize: 11, fontWeight: "800", textAlign: "right", lineHeight: 18 },
  receiptSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 31, borderTopRightRadius: 31, padding: 22, paddingBottom: 34, borderWidth: 1, borderColor: COLORS.border },
  receiptBadge: { width: 58, height: 58, borderRadius: 20, alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  receiptBadgeOk: { backgroundColor: COLORS.mint },
  receiptBadgeWarn: { backgroundColor: COLORS.softWarning },
  receiptTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "900", textAlign: "center" },
  receiptSub: { color: COLORS.muted, fontSize: 11, marginTop: 6, textAlign: "center", lineHeight: 18 },
  receiptRows: { backgroundColor: "#F7F7F5", borderRadius: 20, paddingHorizontal: 16, marginTop: 17, marginBottom: 15 },
  receiptRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  receiptRowLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "800" },
  receiptRowValue: { color: COLORS.ink, fontSize: 14, fontWeight: "900" },
  receiptRowAccent: { color: COLORS.primary },
  receiptClose: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 8 },
  receiptCloseText: { color: COLORS.muted, fontSize: 12, fontWeight: "800" },
});
