import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { memo, ReactNode, useCallback, useMemo, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Badge, Card, COLORS, PageHeader, RoundIcon, SectionTitle, commonStyles } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatCurrency, formatShortDate, IncomingOrder, Supplier, usePharmacy } from "@/lib/pharmacy-context";
import { ScreenContainer } from "@/components/screen-container";

type SourceType = IncomingOrder["sourceType"];
type DraftOrder = { supplierName: string; sourceType: SourceType; referenceNumber: string; total: string; notes: string; invoiceUri?: string };

const initialDraft = (): DraftOrder => ({ supplierName: "", sourceType: "شركة", referenceNumber: "", total: "", notes: "" });
const sourceOptions: SourceType[] = ["شركة", "مكتب", "مورد آخر"];

async function keepInvoiceImage(sourceUri: string) {
  if (!FileSystem.documentDirectory) return sourceUri;
  const folder = `${FileSystem.documentDirectory}invoices/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const extension = sourceUri.split("?")[0].split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  const destination = `${folder}invoice-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

function parseTotal(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed.replace(/,/g, "")) : undefined;
}

function totalErrorOf(value: string) {
  const parsed = parseTotal(value);
  if (parsed === undefined) return undefined;
  return Number.isFinite(parsed) && parsed >= 0 ? undefined : "اكتب إجماليًا رقميًا صحيحًا أو اتركه فارغًا.";
}

function supplierLabel(supplier: Supplier) {
  return supplier.company.trim() || supplier.name.trim();
}

function matchesSupplier(supplier: Supplier, term: string) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return false;
  return [supplier.company, supplier.name].some((value) => value.toLowerCase().includes(normalized));
}

export default function OrdersScreen() {
  const { incomingOrders, addIncomingOrder, suppliers } = usePharmacy();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [draft, setDraft] = useState<DraftOrder>(initialDraft);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [supplierError, setSupplierError] = useState<string>();
  const [imageError, setImageError] = useState<string>();
  const [savedNotice, setSavedNotice] = useState<string>();
  const [preview, setPreview] = useState<string | undefined>();

  const handlePreview = useCallback((uri?: string) => setPreview(uri), []);
  const renderOrder = useCallback(({ item }: { item: IncomingOrder }) => <OrderCard order={item} onPreview={handlePreview} />, [handlePreview]);

  const resetForm = () => { setDraft(initialDraft()); setDetailsOpen(false); setSupplierError(undefined); setImageError(undefined); setIsSavingImage(false); };
  const closeForm = () => { setIsFormVisible(false); resetForm(); };
  const openForm = () => { setSavedNotice(undefined); resetForm(); setIsFormVisible(true); };
  const updateDraft = <K extends keyof DraftOrder>(key: K, value: DraftOrder[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === "supplierName") setSupplierError(undefined);
    if (key === "invoiceUri") setImageError(undefined);
  };

  const selectInvoice = async (source: "camera" | "library") => {
    setImageError(undefined);
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setImageError(source === "camera" ? "لم يُسمح باستخدام الكاميرا؛ فعّل الإذن من إعدادات النظام، أو اختر الفاتورة من ألبوم الصور." : "لم يُسمح بالوصول إلى الصور؛ فعّل الإذن من إعدادات النظام، أو صوّر الفاتورة بالكاميرا.");
      return;
    }
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7 });
    const asset = !result.canceled ? result.assets[0] : undefined;
    if (!asset?.uri) return;
    try {
      setIsSavingImage(true);
      updateDraft("invoiceUri", await keepInvoiceImage(asset.uri));
    } catch {
      setImageError("تعذر حفظ الصورة على الجهاز؛ اختر صورة أصغر أو صوّر الفاتورة مرة أخرى.");
    } finally {
      setIsSavingImage(false);
    }
  };

  const saveOrder = () => {
    const supplierName = draft.supplierName.trim();
    if (!supplierName) { setSupplierError("حدّد جهة التوريد أولًا: اختر من القائمة أو اكتب اسمها."); return; }
    if (totalErrorOf(draft.total)) { setDetailsOpen(true); return; }
    addIncomingOrder({ supplierName, sourceType: draft.sourceType, referenceNumber: draft.referenceNumber.trim() || undefined, total: parseTotal(draft.total), notes: draft.notes.trim() || undefined, invoiceUri: draft.invoiceUri });
    setIsFormVisible(false);
    resetForm();
    setSavedNotice(supplierName);
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1"><FlatList data={incomingOrders} keyExtractor={(item) => item.id} renderItem={renderOrder} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" initialNumToRender={6} maxToRenderPerBatch={6} updateCellsBatchingPeriod={24} windowSize={5} contentContainerStyle={commonStyles.content} ItemSeparatorComponent={() => <View style={styles.listSeparator} />} ListHeaderComponent={<><TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.75}><IconSymbol name="chevron.right" size={20} color={COLORS.ink} /><Text style={styles.backText}>رجوع</Text></TouchableOpacity><PageHeader title="الطلبيات الواردة" subtitle="تسجيل الطلب يتم في ثلاث خطوات مرتبة" /><Card style={styles.stepsCard}><Text style={styles.stepsTitle}>كيف أضيف طلبًا؟</Text><View style={styles.stepsList}><StepRow step="١" text="اختر جهة التوريد من الموردين المحفوظين، أو اكتب اسمها." /><StepRow step="٢" text="صوّر الفاتورة بالكاميرا أو اخترها من ألبوم الصور." /><StepRow step="٣" text="أضف رقم الفاتورة والإجمالي من التفاصيل الإضافية ثم احفظ." /></View></Card><TouchableOpacity onPress={openForm} style={commonStyles.primaryButton} activeOpacity={0.85}><IconSymbol name="plus.circle.fill" size={19} color="#FFFFFF" /><Text style={commonStyles.primaryButtonText}>تسجيل طلب جديد</Text></TouchableOpacity>{savedNotice ? <TouchableOpacity onPress={() => setSavedNotice(undefined)} style={styles.savedBanner} activeOpacity={0.85}><View style={styles.savedText}><Text style={styles.savedTitle}>تم حفظ طلب «{savedNotice}»</Text><Text style={styles.savedSubtitle}>ظهر في أعلى قائمة الطلبات، واضغط هنا للإخفاء.</Text></View><IconSymbol name="checkmark.circle.fill" size={21} color={COLORS.primary} /></TouchableOpacity> : null}<SectionTitle title={`الطلبات المحفوظة (${incomingOrders.length.toLocaleString("ar-EG")})`} /></>} ListEmptyComponent={<Card style={styles.emptyCard}><RoundIcon name="doc.text.fill" color={COLORS.muted} background="#EEF3F1" /><Text style={styles.emptyTitle}>لا توجد طلبيات محفوظة بعد</Text><Text style={styles.emptySubtitle}>ابدأ بتسجيل أول طلب: جهة التوريد وصورة الفاتورة يكفيان.</Text><TouchableOpacity onPress={openForm} style={[commonStyles.secondaryButton, styles.emptyButton]} activeOpacity={0.85}><IconSymbol name="plus.circle.fill" size={19} color={COLORS.primary} /><Text style={commonStyles.secondaryButtonText}>تسجيل أول طلب</Text></TouchableOpacity></Card>} />
  <OrderForm visible={isFormVisible} draft={draft} suppliers={suppliers} isSavingImage={isSavingImage} detailsOpen={detailsOpen} supplierError={supplierError} imageError={imageError} totalError={totalErrorOf(draft.total)} onToggleDetails={() => setDetailsOpen((open) => !open)} onClose={closeForm} onChange={updateDraft} onCapture={() => selectInvoice("camera")} onChoose={() => selectInvoice("library")} onSave={saveOrder} />
  <InvoicePreview uri={preview} onClose={() => setPreview(undefined)} />
  </ScreenContainer>;
}

function StepRow({ step, text }: { step: string; text: string }) {
  return <View style={styles.stepRow}><View style={styles.stepBadge}><Text style={styles.stepText}>{step}</Text></View><Text style={styles.stepRowText}>{text}</Text></View>;
}

const OrderCard = memo(function OrderCard({ order, onPreview }: { order: IncomingOrder; onPreview: (uri?: string) => void }) {
  return <Card style={styles.orderCard}><View style={styles.orderTop}><View style={styles.orderText}><Text style={styles.orderName}>{order.supplierName}</Text><Text style={styles.orderDate}>{formatShortDate(order.createdAt)} · {new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit" }).format(new Date(order.createdAt))}</Text></View><RoundIcon name="doc.text.fill" color={COLORS.primary} background={COLORS.mint} /></View><View style={styles.metaRow}><Badge label={order.sourceType} tone="neutral" />{order.referenceNumber ? <Text style={styles.reference}>رقم: {order.referenceNumber}</Text> : null}{typeof order.total === "number" ? <Text style={styles.total}>{formatCurrency(order.total)}</Text> : null}</View>{order.notes ? <Text style={styles.notes}>{order.notes}</Text> : null}{order.invoiceUri ? <TouchableOpacity onPress={() => onPreview(order.invoiceUri)} style={styles.invoiceButton} activeOpacity={0.8}><Image source={{ uri: order.invoiceUri }} style={styles.invoiceThumb} /><View style={styles.invoiceText}><Text style={styles.invoiceTitle}>صورة الفاتورة محفوظة</Text><Text style={styles.invoiceSubtitle}>اضغط لعرضها بالحجم الكامل</Text></View><IconSymbol name="eye.fill" size={19} color={COLORS.primary} /></TouchableOpacity> : <View style={styles.noInvoice}><IconSymbol name="photo.on.rectangle.angled" size={17} color={COLORS.muted} /><Text style={styles.noInvoiceText}>لم تُرفق صورة فاتورة بهذا الطلب</Text></View>}</Card>;
});

type OrderFormProps = {
  visible: boolean;
  draft: DraftOrder;
  suppliers: Supplier[];
  isSavingImage: boolean;
  detailsOpen: boolean;
  supplierError?: string;
  imageError?: string;
  totalError?: string;
  onToggleDetails: () => void;
  onClose: () => void;
  onChange: <K extends keyof DraftOrder>(key: K, value: DraftOrder[K]) => void;
  onCapture: () => void;
  onChoose: () => void;
  onSave: () => void;
};

function OrderForm({ visible, draft, suppliers, isSavingImage, detailsOpen, supplierError, imageError, totalError, onToggleDetails, onClose, onChange, onCapture, onChoose, onSave }: OrderFormProps) {
  const term = draft.supplierName.trim();
  const options = useMemo(() => {
    const unique = new Map<string, Supplier>();
    for (const supplier of suppliers) {
      const label = supplierLabel(supplier);
      if (label) unique.set(label, supplier);
    }
    const all = [...unique.values()];
    const matching = term ? all.filter((supplier) => matchesSupplier(supplier, term)) : [];
    return { list: (term ? matching : all).slice(0, 4), hasExact: all.some((supplier) => supplierLabel(supplier) === term) };
  }, [suppliers, term]);

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1"><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.formBody}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
      <View style={styles.modalHeader}><TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.75}><IconSymbol name="xmark" size={21} color={COLORS.ink} /></TouchableOpacity><View style={styles.modalHeaderText}><Text style={styles.modalTitle}>تسجيل طلب وارد</Text><Text style={styles.modalSubtitle}>خطوتان أساسيتان ثم التفاصيل الاختيارية</Text></View></View>

      <FormSection step="١" title="جهة التوريد" hint="اختر من الموردين المحفوظين، أو اكتب اسم جهة جديدة.">
        <View style={[styles.fieldBox, supplierError && styles.fieldBoxError]}>
          <TextInput value={draft.supplierName} onChangeText={(value) => onChange("supplierName", value)} placeholder="ابحث بالاسم: المتحدة للأدوية" placeholderTextColor="#99A5A3" style={styles.searchInput} textAlign="right" returnKeyType="search" />
          <IconSymbol name="magnifyingglass" size={19} color={COLORS.muted} style={styles.searchIcon} />
        </View>
        {supplierError ? <Text style={styles.inlineError}>{supplierError}</Text> : null}
        {options.list.length ? <View style={styles.optionList}>{options.list.map((supplier) => { const label = supplierLabel(supplier); const selected = label === term; return (
          <TouchableOpacity key={supplier.id} onPress={() => onChange("supplierName", label)} style={[styles.optionRow, selected && styles.optionRowActive]} activeOpacity={0.8}>
            <View style={styles.optionText}><Text style={styles.optionTitle}>{label}</Text><Text style={styles.optionSubtitle}>{[supplier.name, supplier.phone].filter(Boolean).join(" · ")}</Text></View>
            <IconSymbol name={selected ? "checkmark.circle.fill" : "person.crop.circle.fill"} size={20} color={selected ? COLORS.primary : COLORS.muted} />
          </TouchableOpacity>
        ); })}</View> : null}
        {term && !options.hasExact ? <TouchableOpacity onPress={() => onChange("supplierName", term)} style={styles.newEntity} activeOpacity={0.8}><IconSymbol name="plus.circle.fill" size={19} color={COLORS.primary} /><Text style={styles.newEntityText}>تسجيل «{term}» كجهة جديدة</Text></TouchableOpacity> : null}
        {!options.list.length && !term ? <Text style={styles.optionsHint}>ابدأ الكتابة للبحث في الموردين المحفوظين.</Text> : null}
      </FormSection>

      <FormSection step="٢" title="صورة الفاتورة" hint="يمكنك الحفظ بدونها وإضافتها لاحقًا من قائمة الطلبات.">
        <View style={styles.imageActions}><TouchableOpacity onPress={onCapture} disabled={isSavingImage} style={[styles.imageAction, styles.cameraAction]} activeOpacity={0.8}><IconSymbol name="camera.fill" size={21} color="#FFFFFF" /><Text style={styles.cameraActionText}>تصوير الفاتورة</Text></TouchableOpacity><TouchableOpacity onPress={onChoose} disabled={isSavingImage} style={styles.imageAction} activeOpacity={0.8}><IconSymbol name="photo.on.rectangle.angled" size={21} color={COLORS.primary} /><Text style={styles.imageActionText}>اختيار من الصور</Text></TouchableOpacity></View>
        {draft.invoiceUri ? <View style={styles.selectedInvoice}><Image source={{ uri: draft.invoiceUri }} style={styles.selectedImage} /><View style={styles.selectedText}><Text style={styles.selectedTitle}>تم إرفاق صورة الفاتورة</Text><Text style={styles.selectedSubtitle}>ستُحفظ مع الطلب للرجوع إليها لاحقًا.</Text><TouchableOpacity onPress={() => onChange("invoiceUri", undefined)} activeOpacity={0.7}><Text style={styles.removeImage}>إزالة الصورة</Text></TouchableOpacity></View></View> : <Text style={styles.imageHint}>{isSavingImage ? "جارٍ حفظ الصورة..." : "الفاتورة المصورة تساعدك على مراجعة الطلب بعد استلامه."}</Text>}{imageError ? <View style={styles.imageErrorWrap}><IconSymbol name="exclamationmark.triangle.fill" size={16} color={COLORS.danger} /><Text style={styles.imageErrorText}>{imageError}</Text></View> : null}
      </FormSection>

      <TouchableOpacity onPress={onToggleDetails} style={styles.detailsToggle} activeOpacity={0.8}><View style={styles.detailsLabel}><IconSymbol name="list.bullet.clipboard.fill" size={18} color={COLORS.primary} /><Text style={styles.detailsTitle}>تفاصيل إضافية (اختيارية)</Text></View><IconSymbol name={detailsOpen ? "chevron.down" : "chevron.left"} size={18} color={COLORS.muted} /></TouchableOpacity>
      {detailsOpen ? <View style={styles.detailsBody}>
        <Text style={commonStyles.inputLabel}>نوع جهة التوريد</Text><View style={styles.sourceChoices}>{sourceOptions.map((source) => <TouchableOpacity key={source} onPress={() => onChange("sourceType", source)} style={[styles.sourceChoice, draft.sourceType === source && styles.sourceChoiceActive]} activeOpacity={0.8}><Text style={[styles.sourceChoiceText, draft.sourceType === source && styles.sourceChoiceTextActive]}>{source}</Text></TouchableOpacity>)}</View>
        <View style={styles.twoColumns}><View style={styles.column}><Field label="رقم الفاتورة أو الطلب" value={draft.referenceNumber} onChangeText={(value) => onChange("referenceNumber", value)} placeholder="اختياري" /></View><View style={styles.column}><Field label="إجمالي الطلب" value={draft.total} onChangeText={(value) => onChange("total", value)} placeholder="اختياري" keyboardType="decimal-pad" /></View></View>
        {totalError ? <Text style={styles.inlineError}>{totalError}</Text> : null}
        <Field label="ملاحظات" value={draft.notes} onChangeText={(value) => onChange("notes", value)} placeholder="أي تفاصيل تساعدك لاحقًا" multiline />
      </View> : null}
    </ScrollView>
    <View style={styles.formFooter}>
      {supplierError ?? (detailsOpen ? undefined : totalError) ? <Text style={styles.footerError}>{supplierError ?? totalError}</Text> : <Text style={styles.footerHint}>الجهة وصورة الفاتورة هما الأساس، وكل شيء يُحفظ على جهازك.</Text>}
      <TouchableOpacity onPress={onSave} disabled={Boolean(totalError)} style={[commonStyles.primaryButton, Boolean(totalError) && styles.saveDisabled]} activeOpacity={0.85}><IconSymbol name="checkmark.circle.fill" size={19} color="#FFFFFF" /><Text style={commonStyles.primaryButtonText}>حفظ الطلب</Text></TouchableOpacity>
    </View>
  </KeyboardAvoidingView></ScreenContainer></Modal>;
}

function FormSection({ step, title, hint, children }: { step: string; title: string; hint?: string; children: ReactNode }) {
  return <Card style={styles.section}><View style={styles.sectionHead}><View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{step}</Text></View><View style={styles.sectionTitles}><Text style={styles.sectionTitle}>{title}</Text>{hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}</View></View><View style={styles.sectionBody}>{children}</View></Card>;
}

function InvoicePreview({ uri, onClose }: { uri?: string; onClose: () => void }) {
  return <Modal visible={Boolean(uri)} transparent animationType="fade" onRequestClose={onClose}><View style={styles.previewOverlay}><TouchableOpacity onPress={onClose} style={styles.previewClose} activeOpacity={0.8}><IconSymbol name="xmark" size={22} color="#FFFFFF" /></TouchableOpacity>{uri ? <Image source={{ uri }} resizeMode="contain" style={styles.previewImage} /> : null}<Text style={styles.previewCaption}>صورة فاتورة الطلب</Text></View></Modal>;
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return <View style={commonStyles.inputGroup}><Text style={commonStyles.inputLabel}>{label}</Text><TextInput {...props} multiline={multiline} textAlign="right" style={[commonStyles.input, multiline && styles.textArea]} placeholderTextColor="#99A5A3" /></View>;
}

const styles = StyleSheet.create({
  back: { flexDirection: "row-reverse", alignSelf: "flex-end", alignItems: "center", gap: 3, marginBottom: 13, paddingVertical: 4 }, backText: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
  stepsCard: { backgroundColor: COLORS.mint, borderColor: COLORS.mint, borderRadius: 24, marginBottom: 14 }, stepsTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900", textAlign: "right", marginBottom: 12 }, stepsList: { gap: 11 }, stepRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }, stepBadge: { width: 25, height: 25, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" }, stepText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" }, stepRowText: { flex: 1, color: "#2A5C4C", fontSize: 12, lineHeight: 19, textAlign: "right" },
  savedBanner: { flexDirection: "row-reverse", alignItems: "center", gap: 11, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 22, padding: 14, marginTop: 14 }, savedText: { flex: 1, alignItems: "flex-end" }, savedTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right" }, savedSubtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "right" },
  listSeparator: { height: 12 }, orderCard: { padding: 16, backgroundColor: "#F2F1EE", borderColor: "#F2F1EE", borderRadius: 24 }, orderTop: { flexDirection: "row-reverse", alignItems: "center", gap: 11 }, orderText: { flex: 1, alignItems: "flex-end" }, orderName: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right" }, orderDate: { color: COLORS.muted, fontSize: 11, marginTop: 4, textAlign: "right" }, metaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 }, reference: { color: COLORS.muted, fontSize: 11, fontWeight: "700" }, total: { color: COLORS.primary, fontSize: 13, fontWeight: "900", marginRight: "auto", writingDirection: "ltr" }, notes: { color: COLORS.ink, fontSize: 12, lineHeight: 19, marginTop: 12, textAlign: "right", writingDirection: "rtl" }, invoiceButton: { flexDirection: "row-reverse", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, marginTop: 14, paddingTop: 13 }, invoiceThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#EDF2F0" }, invoiceText: { flex: 1, alignItems: "flex-end" }, invoiceTitle: { color: COLORS.ink, fontSize: 12, fontWeight: "800", textAlign: "right" }, invoiceSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 3, textAlign: "right" }, noInvoice: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-end", gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, marginTop: 14, paddingTop: 13 }, noInvoiceText: { color: COLORS.muted, fontSize: 11, textAlign: "right" },
  emptyCard: { alignItems: "center", paddingVertical: 28, marginTop: 12 }, emptyTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", marginTop: 12, textAlign: "center" }, emptySubtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: 18, textAlign: "center" }, emptyButton: { alignSelf: "stretch" },
  formBody: { flex: 1, backgroundColor: COLORS.background }, formContent: { padding: 20, paddingBottom: 26 }, modalHeader: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 12, marginBottom: 20 }, modalHeaderText: { flex: 1, alignItems: "flex-end" }, modalTitle: { color: COLORS.ink, fontSize: 23, fontWeight: "900", textAlign: "right" }, modalSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 4, textAlign: "right" }, closeButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  section: { marginBottom: 14, borderRadius: 24 }, sectionHead: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 11 }, sectionBadge: { width: 27, height: 27, borderRadius: 14, backgroundColor: COLORS.deep, alignItems: "center", justifyContent: "center" }, sectionBadgeText: { color: "#82E3C0", fontSize: 13, fontWeight: "900" }, sectionTitles: { flex: 1, alignItems: "flex-end" }, sectionTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right" }, sectionHint: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 4, textAlign: "right" }, sectionBody: { marginTop: 14 },
  fieldBox: { flexDirection: "row-reverse", alignItems: "center", gap: 9, backgroundColor: "#F2F1EE", borderWidth: 1, borderColor: "#F2F1EE", borderRadius: 21, minHeight: 54, paddingHorizontal: 16, marginBottom: 12 }, fieldBoxError: { borderColor: COLORS.danger, backgroundColor: COLORS.softDanger }, searchInput: { flex: 1, color: COLORS.ink, fontSize: 15, textAlign: "right", writingDirection: "rtl", paddingVertical: 14 }, searchIcon: { transform: [{ scaleX: -1 }] },
  inlineError: { color: COLORS.danger, fontSize: 11, fontWeight: "800", textAlign: "right", marginBottom: 12, marginTop: -6 },
  optionList: { gap: 8, marginTop: 2 }, optionRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, padding: 11 }, optionRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.mint }, optionText: { flex: 1, alignItems: "flex-end" }, optionTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right" }, optionSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 3, textAlign: "right" }, newEntity: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: COLORS.primary, borderStyle: "dashed" }, newEntityText: { flex: 1, color: COLORS.primary, fontSize: 12, fontWeight: "900", textAlign: "right" }, optionsHint: { color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: "right" },
  detailsToggle: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, marginTop: 4 }, detailsLabel: { flexDirection: "row-reverse", alignItems: "center", gap: 9 }, detailsTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900" }, detailsBody: { marginTop: 16 },
  sourceChoices: { flexDirection: "row-reverse", gap: 8, marginBottom: 17 }, sourceChoice: { flex: 1, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 5 }, sourceChoiceActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, sourceChoiceText: { color: COLORS.muted, fontSize: 12, fontWeight: "800" }, sourceChoiceTextActive: { color: "#FFFFFF" }, twoColumns: { flexDirection: "row-reverse", gap: 10 }, column: { flex: 1 }, textArea: { minHeight: 85, paddingTop: 13, textAlignVertical: "top" },
  imageActions: { flexDirection: "row-reverse", gap: 10, marginBottom: 12 }, imageAction: { flex: 1, minHeight: 51, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 7 }, cameraAction: { borderColor: COLORS.primary, backgroundColor: COLORS.primary }, imageActionText: { color: COLORS.primary, fontSize: 13, fontWeight: "900" }, cameraActionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, selectedInvoice: { flexDirection: "row-reverse", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, padding: 11 }, selectedImage: { width: 64, height: 64, borderRadius: 13, backgroundColor: "#EDF2F0" }, selectedText: { flex: 1, alignItems: "flex-end" }, selectedTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900", textAlign: "right" }, selectedSubtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3, textAlign: "right" }, removeImage: { color: COLORS.danger, fontSize: 11, fontWeight: "800", marginTop: 6 }, imageHint: { color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: "right" }, imageErrorWrap: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, backgroundColor: COLORS.softDanger, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 11, marginTop: 4 }, imageErrorText: { flex: 1, color: COLORS.danger, fontSize: 11, fontWeight: "800", lineHeight: 18, textAlign: "right" },
  formFooter: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, backgroundColor: COLORS.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }, footerHint: { color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: "right", marginBottom: 10 }, footerError: { color: COLORS.danger, fontSize: 11, fontWeight: "800", textAlign: "right", marginBottom: 10 }, saveDisabled: { backgroundColor: "#9CC9B7" },
  previewOverlay: { flex: 1, backgroundColor: "rgba(9, 30, 29, 0.95)", alignItems: "center", justifyContent: "center", padding: 22 }, previewImage: { width: "100%", height: "78%" }, previewClose: { position: "absolute", top: 56, right: 22, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", zIndex: 1 }, previewCaption: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", marginTop: 12 },
});
