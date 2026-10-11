import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Badge, Card, COLORS, PageHeader, RoundIcon, commonStyles } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatCurrency, formatShortDate, CustomerDebt, usePharmacy } from "@/lib/pharmacy-context";
import { ScreenContainer } from "@/components/screen-container";

type DraftDebt = { customerName: string; phone: string; total: string; note: string };
type DraftErrors = Partial<Record<keyof DraftDebt | "amount", string>>;

const emptyDraft = (): DraftDebt => ({ customerName: "", phone: "", total: "", note: "" });
const num = (value: number) => value.toLocaleString("ar-EG");
const parseAmount = (value: string) => Number(value.replace(/[^0-9.]/g, "")) || 0;
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("");

export default function DebtsScreen() {
  const { debts, addDebt, settleDebt } = usePharmacy();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [draft, setDraft] = useState<DraftDebt>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [notice, setNotice] = useState<{ title: string; subtitle: string }>();
  const [payingDebt, setPayingDebt] = useState<CustomerDebt>();
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState<string>();

  const outstanding = useMemo(() => debts.reduce((sum, debt) => sum + Math.max(0, debt.total - debt.paid), 0), [debts]);
  const settledCount = useMemo(() => debts.filter((debt) => debt.total - debt.paid <= 0).length, [debts]);
  const payBalance = payingDebt ? Math.max(0, payingDebt.total - payingDebt.paid) : 0;

  const updateDraft = <K extends keyof DraftDebt>(key: K, value: DraftDebt[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const closeForm = () => { setIsFormVisible(false); setDraft(emptyDraft()); setErrors({}); };

  const saveDebt = () => {
    const total = parseAmount(draft.total);
    const nextErrors: DraftErrors = {};
    if (!draft.customerName.trim()) nextErrors.customerName = "اكتب اسم العميل.";
    if (!total || total < 0) nextErrors.total = "اكتب قيمة الحساب.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    addDebt({ customerName: draft.customerName.trim(), phone: draft.phone.trim() || undefined, total, paid: 0, note: draft.note.trim() || undefined });
    setNotice({ title: `تم فتح حساب «${draft.customerName.trim()}»`, subtitle: `الرصيد الحالي ${formatCurrency(total)}.` });
    closeForm();
  };

  const openPayment = (debt: CustomerDebt) => {
    setPayingDebt(debt);
    setPayAmount("");
    setPayError(undefined);
  };

  const confirmPayment = () => {
    if (!payingDebt) return;
    const amount = parseAmount(payAmount);
    if (!amount || amount <= 0) { setPayError("اكتب المبلغ المستلم."); return; }
    if (amount > payBalance) { setPayError(`المبلغ أكبر من المتبقي (${formatCurrency(payBalance)}).`); return; }
    settleDebt(payingDebt.id, amount);
    const remaining = Math.max(0, payBalance - amount);
    setNotice({ title: `تم تسجيل سداد ${formatCurrency(amount)}`, subtitle: remaining ? `المتبقي على «${payingDebt.customerName}» ${formatCurrency(remaining)}.` : `حساب «${payingDebt.customerName}» مقفّل بالكامل.` });
    setPayingDebt(undefined);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <PageHeader title="حسابات العملاء" subtitle="الآجل والمدفوع والمتبقي لكل عميل في مكان واحد" />
        <View style={styles.hero}>
          <View style={styles.heroTop}><RoundIcon name="person.crop.circle.fill" color="#82E3C0" background="#163B34" /><View style={styles.heroText}><Text style={styles.heroLabel}>إجمالي المتبقي عند العملاء</Text><Text style={styles.heroValue}>{formatCurrency(outstanding)}</Text></View></View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{num(debts.length)}</Text><Text style={styles.heroStatLabel}>حساب مفتوح</Text></View>
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{num(settledCount)}</Text><Text style={styles.heroStatLabel}>تم سداده</Text></View>
            <View style={[styles.heroStat, styles.heroStatLast]}><Text style={styles.heroStatValue}>{num(debts.length - settledCount)}</Text><Text style={styles.heroStatLabel}>باقٍ له متبقي</Text></View>
          </View>
        </View>
        <TouchableOpacity onPress={() => setIsFormVisible(true)} style={commonStyles.primaryButton} activeOpacity={0.85}>
          <IconSymbol name="plus.circle.fill" size={19} color="#FFFFFF" />
          <Text style={commonStyles.primaryButtonText}>فتح حساب عميل جديد</Text>
        </TouchableOpacity>
        {notice ? <View style={styles.notice}><IconSymbol name="checkmark.circle.fill" size={18} color={COLORS.primary} /><View style={styles.noticeText}><Text style={styles.noticeTitle}>{notice.title}</Text><Text style={styles.noticeSubtitle}>{notice.subtitle}</Text></View><TouchableOpacity onPress={() => setNotice(undefined)} hitSlop={10}><IconSymbol name="xmark" size={16} color={COLORS.muted} /></TouchableOpacity></View> : null}
        {isFormVisible ? (
          <Card style={styles.formCard}>
            <View style={styles.formHeader}>
              <TouchableOpacity onPress={closeForm} style={styles.closeButton} activeOpacity={0.75}><IconSymbol name="xmark" size={18} color={COLORS.ink} /></TouchableOpacity>
              <Text style={styles.formTitle}>بيانات الحساب الآجل</Text>
            </View>
            <Field label="اسم العميل *" value={draft.customerName} onChangeText={(value) => updateDraft("customerName", value)} placeholder="مثال: محمد علي" error={errors.customerName} />
            <Field label="رقم الهاتف (اختياري)" value={draft.phone} onChangeText={(value) => updateDraft("phone", value)} placeholder="01xxxxxxxxx" keyboardType="phone-pad" error={errors.phone} />
            <Field label="قيمة الحساب *" value={draft.total} onChangeText={(value) => updateDraft("total", value)} placeholder="0.00" keyboardType="decimal-pad" error={errors.total} />
            <Field label="ملاحظة (اختياري)" value={draft.note} onChangeText={(value) => updateDraft("note", value)} placeholder="مثال: دفعة على حساب علاج الأسنان" error={errors.note} />
            <TouchableOpacity onPress={saveDebt} style={[commonStyles.primaryButton, styles.formSave]} activeOpacity={0.85}><IconSymbol name="checkmark.circle.fill" size={19} color="#FFFFFF" /><Text style={commonStyles.primaryButtonText}>حفظ الحساب</Text></TouchableOpacity>
          </Card>
        ) : null}
        <Text style={styles.sectionTitle}>{debts.length ? `حسابات العملاء (${num(debts.length)})` : "لا توجد حسابات آجلة"}</Text>
        {debts.length ? debts.map((debt) => {
          const balance = Math.max(0, debt.total - debt.paid);
          const settled = balance <= 0;
          return (
            <Card key={debt.id} style={styles.debtCard}>
              <View style={styles.debtTop}>
                <View style={[styles.initials, settled && styles.initialsSettled]}><Text style={[styles.initialsText, settled && styles.initialsTextSettled]}>{initialsOf(debt.customerName)}</Text></View>
                <View style={styles.debtText}>
                  <Text style={styles.debtName} numberOfLines={1}>{debt.customerName}</Text>
                  <Text style={styles.debtMeta}>{formatShortDate(debt.createdAt)} · {settled ? "مسدّد بالكامل" : `مدفوع ${formatCurrency(debt.paid)} من ${formatCurrency(debt.total)}`}</Text>
                  {debt.note ? <Text style={styles.debtNote} numberOfLines={2}>{debt.note}</Text> : null}
                </View>
                <View style={styles.balanceBlock}>
                  <Text style={[styles.balance, { color: settled ? COLORS.primary : COLORS.danger }]}>{settled ? "تم السداد" : formatCurrency(balance)}</Text>
                  {debt.phone ? <TouchableOpacity onPress={() => void Linking.openURL(`tel:${debt.phone}`)} style={styles.callChip} activeOpacity={0.8}><IconSymbol name="phone.fill" size={13} color={COLORS.primary} /><Text style={styles.callChipText} numberOfLines={1}>{debt.phone}</Text></TouchableOpacity> : null}
                </View>
              </View>
              <View style={styles.debtFooter}>
                <Badge label={settled ? "حساب مقفّل" : debt.paid ? "سداد جزئي" : "لم يُسدد بعد"} tone={settled ? "success" : debt.paid ? "warning" : "danger"} />
                {settled ? null : <TouchableOpacity onPress={() => openPayment(debt)} style={styles.payButton} activeOpacity={0.82}><IconSymbol name="creditcard.fill" size={16} color="#FFFFFF" /><Text style={styles.payButtonText}>تسجيل سداد</Text></TouchableOpacity>}
              </View>
            </Card>
          );
        }) : <Card style={styles.emptyCard}><RoundIcon name="person.crop.circle.fill" color={COLORS.muted} background="#EEF3F1" /><Text style={styles.emptyTitle}>لا توجد حسابات آجلة مسجلة</Text><Text style={styles.emptyText}>عمايلك اللي بيشتروا بالآجل سجّلهم هنا لتتابع المتبقي والمدفوع.</Text></Card>}
      </ScrollView>
      <PaymentSheet debt={payingDebt} balance={payBalance} amount={payAmount} error={payError} onChange={(value) => { setPayAmount(value); setPayError(undefined); }} onClose={() => setPayingDebt(undefined)} onConfirm={confirmPayment} />
    </ScreenContainer>
  );
}

function PaymentSheet({ debt, balance, amount, error, onChange, onClose, onConfirm }: { debt?: CustomerDebt; balance: number; amount: string; error?: string; onChange: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  const quickOptions = [balance, Math.round(balance / 2), 50, 100].filter((value, index, list) => value > 0 && list.indexOf(value) === index);
  return (
    <Modal visible={Boolean(debt)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetFlex}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.75}><IconSymbol name="xmark" size={18} color={COLORS.ink} /></TouchableOpacity>
              <View style={styles.sheetHeaderText}><Text style={styles.sheetTitle}>تسجيل سداد</Text><Text style={styles.sheetSubtitle}>{debt?.customerName ?? ""}</Text></View>
            </View>
            <View style={styles.sheetSummary}>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>إجمالي الحساب</Text><Text style={styles.summaryValue}>{formatCurrency(debt?.total ?? 0)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>المتبقي حاليًا</Text><Text style={[styles.summaryValue, { color: COLORS.danger }]}>{formatCurrency(balance)}</Text></View>
            </View>
            <Field label="المبلغ المستلم *" value={amount} onChangeText={onChange} placeholder="0.00" keyboardType="decimal-pad" error={error} />
            <Text style={commonStyles.inputLabel}>مبالغ سريعة</Text>
            <View style={styles.quickRow}>{quickOptions.map((value) => <TouchableOpacity key={value} onPress={() => onChange(String(value))} style={styles.quickChip} activeOpacity={0.8}><Text style={styles.quickChipText}>{formatCurrency(value)}</Text></TouchableOpacity>)}</View>
            <Text style={styles.sheetHint}>يمكنك تسجيل أكثر من دفعة على نفس الحساب، والمتبقي بيُحسب تلقائيًا.</Text>
          </ScrollView>
          <View style={styles.sheetFooter}>
            <TouchableOpacity onPress={onConfirm} style={commonStyles.primaryButton} activeOpacity={0.85}><IconSymbol name="checkmark.circle.fill" size={19} color="#FFFFFF" /><Text style={commonStyles.primaryButtonText}>حفظ الدفعة</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </Modal>
  );
}

function Field({ label, error, ...props }: { label: string; error?: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={commonStyles.inputGroup}><Text style={commonStyles.inputLabel}>{label}</Text><TextInput {...props} textAlign="right" style={[commonStyles.input, Boolean(error) && styles.inputError]} placeholderTextColor="#99A5A3" />{error ? <Text style={styles.fieldError}>{error}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  hero: { backgroundColor: COLORS.deep, borderRadius: 24, padding: 16, marginBottom: 13 },
  heroTop: { flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  heroText: { flex: 1, alignItems: "flex-end" },
  heroLabel: { color: "#A9B6B2", fontSize: 11, fontWeight: "800", textAlign: "right" },
  heroValue: { color: "#FFFFFF", fontSize: 26, fontWeight: "900", marginTop: 3, textAlign: "right", writingDirection: "ltr" },
  heroStats: { flexDirection: "row-reverse", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.22)", marginTop: 14, paddingTop: 12 },
  heroStat: { flex: 1, alignItems: "flex-end", borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(255,255,255,0.18)", paddingLeft: 8 },
  heroStatLast: { borderLeftWidth: 0, paddingLeft: 0 },
  heroStatValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  heroStatLabel: { color: "#BDE5D4", fontSize: 9, marginTop: 3, textAlign: "right" },
  notice: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: COLORS.mint, borderRadius: 18, borderWidth: 1, borderColor: COLORS.mint, padding: 13, marginTop: 12 },
  noticeText: { flex: 1, alignItems: "flex-end" },
  noticeTitle: { color: COLORS.ink, fontSize: 12.5, fontWeight: "900", textAlign: "right" },
  noticeSubtitle: { color: "#2A5C4C", fontSize: 10.5, marginTop: 3, textAlign: "right" },
  formCard: { marginTop: 13, borderRadius: 24 },
  formHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 16 },
  formTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900", textAlign: "right", flex: 1 },
  closeButton: { width: 36, height: 36, borderRadius: 13, backgroundColor: "#F2F1EE", alignItems: "center", justifyContent: "center" },
  formSave: { marginTop: 4 },
  inputError: { borderColor: COLORS.danger, backgroundColor: "#FFF6F4" },
  fieldError: { color: COLORS.danger, fontSize: 10.5, fontWeight: "800", textAlign: "right", marginTop: 5 },
  sectionTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right", marginTop: 24, marginBottom: 11 },
  debtCard: { marginBottom: 10, borderRadius: 22, backgroundColor: "#FBFAF8", borderColor: COLORS.border },
  debtTop: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 11 },
  initials: { width: 44, height: 44, borderRadius: 15, backgroundColor: COLORS.mint, alignItems: "center", justifyContent: "center" },
  initialsSettled: { backgroundColor: "#E7F5EE" },
  initialsText: { color: COLORS.primary, fontSize: 15, fontWeight: "900" },
  initialsTextSettled: { color: COLORS.primary },
  debtText: { flex: 1, alignItems: "flex-end" },
  debtName: { width: "100%", color: COLORS.ink, fontSize: 14, fontWeight: "900", textAlign: "right" },
  debtMeta: { width: "100%", color: COLORS.muted, fontSize: 10, marginTop: 4, textAlign: "right" },
  debtNote: { width: "100%", color: COLORS.ink, fontSize: 10.5, lineHeight: 16, marginTop: 5, textAlign: "right" },
  balanceBlock: { alignItems: "flex-start", gap: 6, minWidth: 86 },
  balance: { fontSize: 14, fontWeight: "900", writingDirection: "ltr" },
  callChip: { flexDirection: "row-reverse", alignItems: "center", gap: 4, maxWidth: 92, backgroundColor: COLORS.mint, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4 },
  callChipText: { color: COLORS.primary, fontSize: 9.5, fontWeight: "900", writingDirection: "ltr" },
  debtFooter: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, marginTop: 13, paddingTop: 11 },
  payButton: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, borderRadius: 13, paddingHorizontal: 14, minHeight: 38, justifyContent: "center" },
  payButtonText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "900" },
  emptyCard: { alignItems: "center", paddingVertical: 26 },
  emptyTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", marginTop: 12 },
  emptyText: { color: COLORS.muted, fontSize: 11.5, lineHeight: 18, marginTop: 6, textAlign: "center", maxWidth: 260 },
  sheetFlex: { flex: 1 },
  sheetContent: { padding: 20, paddingBottom: 24 },
  sheetHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 11, marginBottom: 20 },
  sheetHeaderText: { flex: 1, alignItems: "flex-end" },
  sheetTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "900", textAlign: "right" },
  sheetSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3, textAlign: "right" },
  sheetSummary: { backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 18 },
  summaryRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingVertical: 7 },
  summaryLabel: { color: COLORS.muted, fontSize: 11.5, fontWeight: "800" },
  summaryValue: { color: COLORS.ink, fontSize: 14, fontWeight: "900", writingDirection: "ltr" },
  quickRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  quickChip: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 13, minHeight: 38, alignItems: "center", justifyContent: "center" },
  quickChipText: { color: COLORS.ink, fontSize: 11.5, fontWeight: "900", writingDirection: "ltr" },
  sheetHint: { color: COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: "right" },
  sheetFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, backgroundColor: COLORS.surface, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22 },
});
