import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { AdminButton, AdminCard, AdminField, AdminShell, adminStyles } from "@/components/local-admin-ui";
import { COLORS } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useStaffAudit } from "@/hooks/use-staff-audit";
import { calculateExpectedShiftCash, formatCurrency, usePharmacy } from "@/lib/pharmacy-context";
import { SHIFT_WINDOWS, canStartShift, formatClock, shiftClock } from "@/lib/shift-schedule";

export default function ShiftsScreen() {
  const { shifts, sales, expenses, activeShift, startShift, closeShift, addExpense } = usePharmacy();
  const audit = useStaffAudit();
  const [pharmacistName, setPharmacistName] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [actualCash, setActualCash] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<"تشغيل" | "توريد" | "أخرى">("تشغيل");
  const [expenseErrors, setExpenseErrors] = useState<{ title?: string; amount?: string }>({});
  const [note, setNote] = useState("");
  const [isCloseSheetOpen, setIsCloseSheetOpen] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [selectedShiftId, setSelectedShiftId] = useState<string>();
  const [historySearch, setHistorySearch] = useState("");
  const [now, setNow] = useState(() => new Date());

  // عدّاد حالة الشيفت؛ يكفي تحديث نصف دقيقة لأن كل المواعيد بالدقائق.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const shiftSales = useMemo(() => activeShift ? sales.filter((sale) => sale.shiftId === activeShift.id) : [], [activeShift, sales]);
  const shiftExpenses = useMemo(() => activeShift ? expenses.filter((expense) => expense.shiftId === activeShift.id) : [], [activeShift, expenses]);
  const cashSales = shiftSales.filter((sale) => sale.paymentMethod === "نقدي").reduce((sum, sale) => sum + sale.total, 0);
  const vodafoneCashSales = shiftSales.filter((sale) => sale.paymentMethod === "فودافون كاش").reduce((sum, sale) => sum + sale.total, 0);
  const cardSales = shiftSales.filter((sale) => sale.paymentMethod === "بطاقة").reduce((sum, sale) => sum + sale.total, 0);
  const walletSales = shiftSales.filter((sale) => sale.paymentMethod === "محفظة").reduce((sum, sale) => sum + sale.total, 0);
  const expenseTotal = shiftExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expectedCash = activeShift ? calculateExpectedShiftCash(activeShift.openingCash, cashSales, expenseTotal) : 0;
  const actualCashValue = Number(actualCash);
  const hasActualCash = actualCash.trim().length > 0 && Number.isFinite(actualCashValue) && actualCashValue >= 0;
  const difference = hasActualCash ? actualCashValue - expectedCash : null;
  const closedShifts = useMemo(() => shifts.filter((shift) => Boolean(shift.closedAt)), [shifts]);
  const filteredClosedShifts = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase("ar-EG");
    return closedShifts.filter((shift) => !query || shift.pharmacistName.toLocaleLowerCase("ar-EG").includes(query) || new Date(shift.startedAt).toLocaleDateString("ar-EG").includes(query));
  }, [closedShifts, historySearch]);
  const selectedShift = closedShifts.find((shift) => shift.id === selectedShiftId);
  const selectedShiftSales = useMemo(() => selectedShift ? sales.filter((sale) => sale.shiftId === selectedShift.id) : [], [sales, selectedShift]);
  const selectedShiftExpenses = useMemo(() => selectedShift ? expenses.filter((expense) => expense.shiftId === selectedShift.id) : [], [expenses, selectedShift]);
  const selectedCashSales = selectedShiftSales.filter((sale) => sale.paymentMethod === "نقدي").reduce((sum, sale) => sum + sale.total, 0);
  const selectedVodafoneCashSales = selectedShiftSales.filter((sale) => sale.paymentMethod === "فودافون كاش").reduce((sum, sale) => sum + sale.total, 0);
  const selectedCardSales = selectedShiftSales.filter((sale) => sale.paymentMethod === "بطاقة").reduce((sum, sale) => sum + sale.total, 0);
  const selectedWalletSales = selectedShiftSales.filter((sale) => sale.paymentMethod === "محفظة").reduce((sum, sale) => sum + sale.total, 0);
  const selectedSalesTotal = selectedShiftSales.reduce((sum, sale) => sum + sale.total, 0);
  const selectedExpenseTotal = selectedShiftExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const selectedExpectedCash = selectedShift ? calculateExpectedShiftCash(selectedShift.openingCash, selectedCashSales, selectedExpenseTotal) : 0;

  const clock = useMemo(() => (activeShift ? shiftClock(activeShift, now) : null), [activeShift, now]);
  const startPermission = useMemo(() => canStartShift(shifts, now), [shifts, now]);
  const overdue = clock?.status === "overdue";
  const closingSoon = clock?.status === "closing_soon";

  const handleAddExpense = () => {
    const value = Number(expenseAmount);
    const nextErrors: typeof expenseErrors = {};
    if (!expenseTitle.trim()) nextErrors.title = "اكتب وصف المصروف.";
    if (!expenseAmount.trim() || !Number.isFinite(value) || value <= 0) nextErrors.amount = "اكتب قيمة المصروف رقمًا أكبر من صفر.";
    if (Object.keys(nextErrors).length) { setExpenseErrors(nextErrors); return; }
    if (!activeShift) { setNotice("لا يمكن تسجيل مصروف بدون شيفت مفتوح؛ المصروف يُخصم من درج الشيفت نفسه."); return; }
    addExpense({ title: expenseTitle.trim(), amount: value, category: expenseCategory, paidAmount: value, shiftId: activeShift.id });
    audit({ action: "expense.created", entityType: "expense", detail: `تم تسجيل مصروف ${expenseTitle.trim()} بقيمة ${value.toFixed(2)} ج.م على شيفت ${activeShift.pharmacistName}.`, metadata: { category: expenseCategory, amount: value, shiftId: activeShift.id } });
    setExpenseTitle("");
    setExpenseAmount("");
    setExpenseErrors({});
    setShowExpenseForm(false);
    setNotice(`خُصم «${expenseTitle.trim()}» (${formatCurrency(value)}) من درج هذا الشيفت مباشرة.`);
  };

  const handleStart = () => {
    if (!pharmacistName.trim()) return setNameError("اكتب اسم الصيدلي قبل بدء الشيفت.");
    const openingValue = Number(openingCash);
    if (!openingCash.trim() || !Number.isFinite(openingValue) || openingValue < 0) return setNameError("اكتب رصيدًا افتتاحيًا صحيحًا لا يقل عن صفر.");
    const ok = startShift(pharmacistName, openingValue);
    if (!ok) return setNameError(startPermission.reason ?? "لا يمكن بدء شيفت جديد الآن.");
    setNameError(undefined);
    audit({ action: "shift.started", entityType: "shift", detail: `تم بدء شيفت باسم ${pharmacistName.trim()}.`, metadata: { openingCash: Number(openingCash) || 0 } });
    setNotice(`بدأ شيفت «${pharmacistName.trim()}» برصيد افتتاحي ${formatCurrency(openingValue)}.`);
    setPharmacistName("");
    setOpeningCash("0");
  };
  const openCloseSheet = () => {
    setActualCash("");
    setNote("");
    setNotice(undefined);
    setIsCloseSheetOpen(true);
  };
  const handleClose = () => {
    if (!activeShift || !hasActualCash) return;
    if (difference !== null && difference !== 0 && !note.trim()) {
      setNotice("اكتب سبب العجز أو الزيادة قبل تقفيل الشيفت.");
      return;
    }
    const pharmacistName = activeShift.pharmacistName;
    closeShift(activeShift.id, actualCashValue, note.trim() || undefined);
    audit({ action: "shift.closed", entityType: "shift", entityId: activeShift.id, detail: `تم تقفيل شيفت ${pharmacistName} بفرق ${difference?.toFixed(2) ?? "0.00"} ج.م.`, metadata: { expectedCash, actualCash: actualCashValue, difference } });
    setIsCloseSheetOpen(false);
    setActualCash("");
    setNote("");
    setNotice(`تم تقفيل شيفت «${pharmacistName}». فرق الخزينة ${formatCurrency(actualCashValue - expectedCash)}.`);
  };

  return (
    <AdminShell title="إدارة الخزينة" subtitle="درج الشيفت الحالي ومصروفاته ومواعيد الورديات في مكان واحد">
      {notice ? <AdminCard style={styles.noticeCard}><IconSymbol name="checkmark.circle.fill" size={17} color={COLORS.primary} /><Text style={styles.noticeText}>{notice}</Text><TouchableOpacity onPress={() => setNotice(undefined)} style={styles.noticeClose} activeOpacity={0.7}><IconSymbol name="xmark" size={13} color={COLORS.muted} /></TouchableOpacity></AdminCard> : null}

      {/* ── شريط المواعيد ──────────────────────────────────────────────── */}
      <View style={styles.timeline}>
        {SHIFT_WINDOWS.map((item) => {
          const active = (activeShift ? clock?.window.kind : startPermission.window?.kind) === item.kind;
          return (
            <View key={item.kind} style={[styles.timelineSeg, active && styles.timelineSegActive]}>
              <Text style={[styles.timelineName, active && styles.timelineNameActive]}>{item.label}</Text>
              <Text style={[styles.timelineHours, active && styles.timelineHoursActive]}>{formatClock(item.startMinutes)} – {formatClock(item.endMinutes)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.timelineRule}>لا يُفتح شيفت قبل قفل السابق عليه · التذكير يبدأ قبل القفل بنصف ساعة</Text>

      {/* ── الدرج ──────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          {activeShift && clock ? (
            <View style={styles.heroPill}><View style={styles.heroDot} /><Text style={styles.heroPillText}>{clock.window.label}</Text></View>
          ) : (
            <View style={[styles.heroPill, styles.heroPillIdle]}><Text style={styles.heroPillText}>لا يوجد شيفت مفتوح</Text></View>
          )}
          <Text style={styles.heroMeta}>
            {activeShift
              ? `بدأ ${new Date(activeShift.startedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })} · ${activeShift.pharmacistName}`
              : (startPermission.window ? `${startPermission.window.label} — القفل ${formatClock(startPermission.window.endMinutes)}` : "خارج مواعيد الورديات")}
          </Text>
        </View>

        <Text style={styles.heroLabel}>{activeShift ? "المتوقع في الدرج الآن" : "حالة الدرج"}</Text>
        <Text style={styles.heroValue}>{activeShift ? formatCurrency(expectedCash) : "—"}</Text>

        {activeShift && clock ? (
          <View style={styles.heroClockRow}>
            <IconSymbol name={overdue ? "exclamationmark.triangle.fill" : "clock.fill"} size={14} color={overdue ? "#FFB3A2" : closingSoon ? "#FFC7AB" : "#82E3C0"} />
            <Text style={[styles.heroClockText, overdue && styles.heroClockTextAlert]}>{clock.detail}</Text>
          </View>
        ) : (
          <Text style={styles.heroIdleNote}>{startPermission.ok ? "سجّل اسم الصيدلي والرصيد الافتتاحي؛ كل فاتورة ومصروف هتتسجّل على الشيفت ده مباشرة." : startPermission.reason}</Text>
        )}

        {activeShift ? (
          <>
            <View style={styles.heroDivider} />
            <View style={styles.heroStats}>
              <HeroStat label="الرصيد الافتتاحي" value={formatCurrency(activeShift.openingCash)} />
              <View style={styles.heroStatDivider} />
              <HeroStat label="نقدية المبيعات" value={formatCurrency(cashSales)} />
              <View style={styles.heroStatDivider} />
              <HeroStat label="مصروفات الشيفت" value={formatCurrency(expenseTotal)} tone="#FFC7AB" />
            </View>
            <View style={styles.paymentBreakdown}>
              <PaymentStat label="بطاقة (قديم)" value={formatCurrency(cardSales)} />
              <PaymentStat label="فودافون كاش" value={formatCurrency(vodafoneCashSales)} />
              <PaymentStat label="إجمالي المبيعات" value={formatCurrency(shiftSales.reduce((sum, sale) => sum + sale.total, 0))} />
            </View>
            <TouchableOpacity onPress={openCloseSheet} style={[styles.heroButton, overdue && styles.heroButtonAlert]} activeOpacity={0.86}>
              <IconSymbol name="lock.fill" size={16} color={overdue ? "#FFFFFF" : COLORS.deep} />
              <Text style={[styles.heroButtonText, overdue && styles.heroButtonTextLight]}>{overdue ? "تجاوزت الموعد — اقفل الشيفت الآن" : "تقفيل الشيفت ومطابقة الدرج"}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {/* ── بدء شيفت ───────────────────────────────────────────────────── */}
      {!activeShift ? (
        <AdminCard style={styles.card}>
          <SectionHead icon="plus.circle.fill" title="بدء شيفت جديد" detail={startPermission.ok ? `سيبدأ ${startPermission.window?.label} ويقفل الساعة ${formatClock(startPermission.window?.endMinutes ?? 0)}` : "متاح بعد قفل الشيفت الحالي أو داخل موعد الورديات"} />
          <AdminField label="اسم الصيدلي" value={pharmacistName} onChangeText={(value) => { setPharmacistName(value); setNameError(undefined); }} placeholder="مثال: أحمد محمد" error={nameError} />
          <AdminField label="الرصيد الافتتاحي في الدرج" value={openingCash} onChangeText={setOpeningCash} placeholder="2000" keyboardType="decimal-pad" />
          <AdminButton title="بدء الشيفت" onPress={handleStart} disabled={!startPermission.ok} />
        </AdminCard>
      ) : null}

      {/* ── حركة الشيفت من المصروفات ───────────────────────────────────── */}
      {activeShift ? (
        <AdminCard style={styles.card}>
          <View style={styles.expenseHead}>
            <SectionHead icon="arrow.down.circle.fill" title="مصروفات هذا الشيفت" />
            <TouchableOpacity onPress={() => setShowExpenseForm((value) => !value)} activeOpacity={0.8} style={styles.expenseAddChip}>
              <IconSymbol name={showExpenseForm ? "xmark" : "plus"} size={14} color={COLORS.primary} />
              <Text style={styles.expenseAddText}>{showExpenseForm ? "إلغاء" : "تسجيل مصروف"}</Text>
            </TouchableOpacity>
          </View>

          {showExpenseForm ? (
            <View style={styles.expenseForm}>
              <AdminField label="وصف المصروف" value={expenseTitle} onChangeText={(value) => { setExpenseTitle(value); setExpenseErrors((current) => ({ ...current, title: undefined })); }} placeholder="مثال: كهرباء، نقل، صيانة" error={expenseErrors.title} />
              <AdminField label="القيمة" value={expenseAmount} onChangeText={(value) => { setExpenseAmount(value); setExpenseErrors((current) => ({ ...current, amount: undefined })); }} placeholder="0.00" keyboardType="decimal-pad" error={expenseErrors.amount} />
              <Text style={styles.expenseCategoryLabel}>التصنيف</Text>
              <View style={styles.expenseCategories}>
                {(["تشغيل", "توريد", "أخرى"] as const).map((item) => (
                  <TouchableOpacity key={item} onPress={() => setExpenseCategory(item)} style={[styles.expenseCategory, expenseCategory === item && styles.expenseCategoryActive]} activeOpacity={0.8}>
                    <Text style={[styles.expenseCategoryText, expenseCategory === item && styles.expenseCategoryTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <AdminButton title="خصم من الدرج" onPress={handleAddExpense} />
            </View>
          ) : null}

          {shiftExpenses.length ? (
            <View>
              {shiftExpenses.map((expense, index) => (
                <View key={expense.id} style={[styles.expenseRow, index > 0 && styles.expenseDivider]}>
                  <View style={styles.expenseIcon}><IconSymbol name="arrow.down.circle.fill" size={17} color={COLORS.warning} /></View>
                  <View style={styles.expenseRowText}>
                    <Text style={styles.expenseRowTitle}>{expense.title}</Text>
                    <Text style={styles.expenseRowMeta}>{expense.category} · {new Date(expense.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                  <Text style={styles.expenseRowAmount}>{formatCurrency(expense.amount)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowExpenseForm(true)} style={styles.expenseEmptyRow} activeOpacity={0.8}>
              <Text style={styles.expenseEmpty}>لا مصروفات على هذا الشيفت — سجّل أي مصروف في وقته، فكل مصروف خارج الدرج يظهر كعجز عند القفل.</Text>
            </TouchableOpacity>
          )}

          {overdue ? <Text style={styles.overdueLine}>تجاوزت موعد القفل: لا يمكن بدء الشيفت التالي قبل التقفيل{shiftExpenses.length ? `، وإجمالي مصروفات هذا الشيفت ${formatCurrency(expenseTotal)}` : ""}.</Text> : null}
        </AdminCard>
      ) : null}

      <AdminCard style={styles.card}>
        <SectionHead icon="list.bullet.clipboard.fill" title="سجل الشيفتات السابقة" detail={`${closedShifts.length.toLocaleString("ar-EG")} شيفت مغلق`} />
        {closedShifts.length ? <TextInput value={historySearch} onChangeText={setHistorySearch} placeholder="ابحث باسم الصيدلي أو تاريخ الشيفت" placeholderTextColor={COLORS.muted} style={styles.historySearch} textAlign="right" /> : null}
        {filteredClosedShifts.length ? (
          <View>
            {filteredClosedShifts.map((shift, index) => (
              <TouchableOpacity key={shift.id} onPress={() => setSelectedShiftId((current) => current === shift.id ? undefined : shift.id)} activeOpacity={0.72} style={[styles.historyRow, index > 0 && styles.historyDivider]}>
                <View style={styles.historyAmount}><Text style={[styles.historyDifference, { color: (shift.difference ?? 0) < 0 ? COLORS.danger : (shift.difference ?? 0) > 0 ? COLORS.warning : COLORS.primary }]}>{(shift.difference ?? 0) < 0 ? "عجز " : (shift.difference ?? 0) > 0 ? "زيادة " : "مطابق "}{formatCurrency(Math.abs(shift.difference ?? 0))}</Text><Text style={styles.reviewHint}>{selectedShiftId === shift.id ? "إخفاء التقرير" : "عرض التقرير"}</Text></View>
                <View style={styles.historyText}><Text style={styles.historyName}>{shift.pharmacistName}</Text><Text style={styles.historyMeta}>{new Date(shift.startedAt).toLocaleDateString("ar-EG")} · افتتاحي {formatCurrency(shift.openingCash)}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        ) : <Text style={styles.empty}>{closedShifts.length ? "مفيش نتائج مطابقة للبحث." : "لا توجد شيفتات مغلقة بعد."}</Text>}
      </AdminCard>

      {selectedShift ? <View style={styles.card}><ClosedShiftReport shift={selectedShift} expectedCash={selectedExpectedCash} cashSales={selectedCashSales} vodafoneCashSales={selectedVodafoneCashSales} cardSales={selectedCardSales} walletSales={selectedWalletSales} salesTotal={selectedSalesTotal} expenseTotal={selectedExpenseTotal} expenses={selectedShiftExpenses} /></View> : null}

      <CloseShiftSheet visible={isCloseSheetOpen} expectedCash={expectedCash} actualCash={actualCash} note={note} hasActualCash={hasActualCash} difference={difference} onActualCashChange={setActualCash} onNoteChange={setNote} onClose={() => setIsCloseSheetOpen(false)} onConfirm={handleClose} />
    </AdminShell>
  );
}

function HeroStat({ label, value, tone = "#FFFFFF" }: { label: string; value: string; tone?: string }) {
  return <View style={styles.heroStat}><Text style={[styles.heroStatValue, { color: tone }]} numberOfLines={1}>{value}</Text><Text style={styles.heroStatLabel}>{label}</Text></View>;
}

function PaymentStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.paymentStat}><Text style={styles.paymentStatValue} numberOfLines={1}>{value}</Text><Text style={styles.paymentStatLabel}>{label}</Text></View>;
}

function SectionHead({ icon, title, detail }: { icon: Parameters<typeof IconSymbol>[0]["name"]; title: string; detail?: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionIcon}><IconSymbol name={icon} size={16} color={COLORS.primary} /></View>
      <View style={styles.sectionHeadText}>
        <Text style={styles.sectionHeadTitle}>{title}</Text>
        {detail ? <Text style={styles.sectionHeadDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

function CloseShiftSheet({ visible, expectedCash, actualCash, note, hasActualCash, difference, onActualCashChange, onNoteChange, onClose, onConfirm }: { visible: boolean; expectedCash: number; actualCash: string; note: string; hasActualCash: boolean; difference: number | null; onActualCashChange: (value: string) => void; onNoteChange: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  const differenceColor = difference === null ? COLORS.muted : difference < 0 ? COLORS.danger : difference > 0 ? COLORS.primary : COLORS.success;
  const differenceLabel = difference === null ? "أدخل النقدية الفعلية" : difference === 0 ? "مطابقة كاملة" : difference < 0 ? "عجز في الدرج" : "زيادة في الدرج";
  const requiresNote = difference !== null && difference !== 0;
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent><KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}><TouchableOpacity style={styles.sheetBackdrop} onPress={onClose} activeOpacity={1} /><View style={styles.bottomSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeading}><TouchableOpacity onPress={onClose} style={styles.sheetClose} activeOpacity={0.7}><IconSymbol name="xmark" size={17} color={COLORS.muted} /></TouchableOpacity><Text style={styles.sheetTitle}>تقفيل الشيفت</Text></View><View style={styles.expectedRow}><Text style={styles.expectedValue}>{formatCurrency(expectedCash)}</Text><Text style={styles.expectedLabel}>المتوقع في الدرج</Text></View><AdminField label="النقدية الفعلية في الدرج" value={actualCash} onChangeText={onActualCashChange} placeholder="0" keyboardType="decimal-pad" /><View style={[styles.differenceBox, { backgroundColor: difference === null ? "#F2F1EE" : difference < 0 ? "#FFE4D8" : "#DFF5EB" }]}><Text style={[styles.differenceValue, { color: differenceColor }]}>{difference === null ? "—" : formatCurrency(difference)}</Text><Text style={[styles.differenceLabel, { color: differenceColor }]}>{differenceLabel}</Text></View><AdminField label={requiresNote ? "سبب الفرق (مطلوب)" : "ملاحظة (اختياري)"} value={note} onChangeText={onNoteChange} placeholder={requiresNote ? "اكتب سبب العجز أو الزيادة" : "أي ملاحظة على التسليم"} error={requiresNote && !note.trim() ? "لازم تسجل السبب لو النقدية مش مطابقة." : undefined} /><AdminButton title="تأكيد وتقفيل الشيفت" onPress={onConfirm} disabled={!hasActualCash || (requiresNote && !note.trim())} /></View></KeyboardAvoidingView></Modal>;
}

function ClosedShiftReport({ shift, expectedCash, cashSales, vodafoneCashSales, cardSales, walletSales, salesTotal, expenseTotal, expenses }: { shift: { pharmacistName: string; openingCash: number; actualCash?: number; difference?: number; note?: string; closedAt?: string }; expectedCash: number; cashSales: number; vodafoneCashSales: number; cardSales: number; walletSales: number; salesTotal: number; expenseTotal: number; expenses: { id: string; title: string; amount: number }[] }) {
  return <AdminCard style={styles.reportCard}><Text style={styles.reportTitle}>تقرير شيفت {shift.pharmacistName}</Text><Text style={styles.reportDate}>{shift.closedAt ? new Date(shift.closedAt).toLocaleString("ar-EG") : ""}</Text><View style={styles.reportRows}><ReportRow label="إجمالي المبيعات" value={formatCurrency(salesTotal)} /><ReportRow label="نقدي" value={formatCurrency(cashSales)} /><ReportRow label="فودافون كاش" value={formatCurrency(vodafoneCashSales)} /><ReportRow label="بطاقة (فواتير قديمة)" value={formatCurrency(cardSales)} /><ReportRow label="محفظة (فواتير قديمة)" value={formatCurrency(walletSales)} /><ReportRow label="الرصيد الافتتاحي" value={formatCurrency(shift.openingCash)} /><ReportRow label="مصروفات الشيفت" value={formatCurrency(expenseTotal)} /><ReportRow label="المتوقع في الدرج" value={formatCurrency(expectedCash)} /><ReportRow label="الفعلي في الدرج" value={formatCurrency(shift.actualCash ?? expectedCash)} /><ReportRow label="الفرق" value={formatCurrency(shift.difference ?? 0)} /></View>{expenses.length ? <View style={styles.reportExpenses}>{expenses.map((expense) => <View style={styles.reportExpenseRow} key={expense.id}><Text style={styles.reportExpenseAmount}>{formatCurrency(expense.amount)}</Text><Text style={styles.reportExpenseName}>{expense.title}</Text></View>)}</View> : null}{shift.note ? <Text style={styles.reportNote}>ملاحظة: {shift.note}</Text> : null}</AdminCard>;
}

function ReportRow({ label, value }: { label: string; value: string }) { return <View style={styles.reportRow}><Text style={styles.reportRowValue}>{value}</Text><Text style={styles.reportRowLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  expenseHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  expenseAddText: { color: COLORS.primary, fontSize: 12.5, fontWeight: "900" },
  expenseForm: { marginTop: 13 },
  expenseCategoryLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "900", textAlign: "right", marginBottom: 8 },
  expenseCategories: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  expenseCategory: { flex: 1, minHeight: 45, borderRadius: 16, backgroundColor: "#F2F1EE", alignItems: "center", justifyContent: "center" },
  expenseCategoryActive: { backgroundColor: COLORS.primary },
  expenseCategoryText: { color: COLORS.ink, fontSize: 11, fontWeight: "900" },
  expenseCategoryTextActive: { color: "#FFFFFF" },
  expenseRow: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  expenseDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  expenseRowText: { flex: 1, alignItems: "flex-end" },
  expenseRowTitle: { color: COLORS.ink, fontSize: 12.5, fontWeight: "900", textAlign: "right" },
  expenseRowMeta: { color: COLORS.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  expenseRowAmount: { color: COLORS.warning, fontSize: 13.5, fontWeight: "900", minWidth: 70, textAlign: "left" },
  expenseEmpty: { color: COLORS.muted, fontSize: 11.5, textAlign: "right", paddingTop: 12 },
  timeline: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  timelineSeg: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 10 },
  timelineSegActive: { backgroundColor: COLORS.deep, borderColor: COLORS.deep },
  timelineName: { color: COLORS.ink, fontSize: 11.5, fontWeight: "900" },
  timelineNameActive: { color: "#82E3C0" },
  timelineHours: { color: COLORS.muted, fontSize: 11, fontWeight: "800" },
  timelineHoursActive: { color: "#FFFFFF" },
  timelineRule: { color: COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: "right", marginTop: 8, marginBottom: 2 },
  hero: { backgroundColor: COLORS.deep, borderRadius: 28, padding: 20, marginTop: 12 },
  heroTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 10 },
  heroPill: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: "rgba(31,164,122,0.22)", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  heroPillIdle: { backgroundColor: "rgba(255,255,255,0.12)" },
  heroPillText: { color: "#82E3C0", fontSize: 11, fontWeight: "900" },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#82E3C0" },
  heroMeta: { color: "#A9B6B2", fontSize: 10.5, fontWeight: "800", textAlign: "left", flexShrink: 1 },
  heroIdleNote: { color: "#DCE7E3", fontSize: 11.5, lineHeight: 19, textAlign: "right", marginTop: 14 },
  heroLabel: { color: "#A9B6B2", fontSize: 12.5, fontWeight: "800", textAlign: "right", marginTop: 22 },
  heroValue: { color: "#FFFFFF", fontSize: 34, lineHeight: 43, fontWeight: "900", textAlign: "right", marginTop: 4 },
  heroClockRow: { flexDirection: "row-reverse", alignItems: "center", gap: 7, marginTop: 12 },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.16)", marginVertical: 16 },
  expenseEmptyRow: { borderWidth: 1, borderStyle: "dashed", borderColor: "#DCDCD6", borderRadius: 16, padding: 14 },
  overdueLine: { color: COLORS.danger, fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 12 },
  heroClockText: { color: "#82E3C0", fontSize: 11, fontWeight: "900", textAlign: "right", lineHeight: 17 },
  heroClockTextAlert: { color: "#FFD6CB" },
  heroStats: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 12, marginTop: 14 },
  paymentBreakdown: { flexDirection: "row-reverse", gap: 8, marginTop: 9 },
  paymentStat: { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 13, paddingHorizontal: 7, paddingVertical: 10, alignItems: "center" },
  paymentStatValue: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },
  paymentStatLabel: { color: "#A9B6B2", fontSize: 9, fontWeight: "800", marginTop: 4 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatValue: { fontSize: 13, fontWeight: "900", textAlign: "center" },
  heroStatLabel: { color: "#A9B6B2", fontSize: 9.5, fontWeight: "800", textAlign: "center", marginTop: 4 },
  heroStatDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: "rgba(255,255,255,0.18)" },
  heroButton: { minHeight: 54, borderRadius: 18, backgroundColor: "#FFFFFF", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, paddingHorizontal: 16 },
  heroButtonAlert: { backgroundColor: COLORS.danger },
  heroButtonText: { color: COLORS.deep, fontSize: 13, fontWeight: "900" },
  heroButtonTextLight: { color: "#FFFFFF" },
  card: { marginTop: 14 },
  sectionHead: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 12 },
  sectionIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.mint, alignItems: "center", justifyContent: "center" },
  sectionHeadText: { flex: 1, alignItems: "flex-end" },
  sectionHeadTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900", textAlign: "right" },
  sectionHeadDetail: { color: COLORS.muted, fontSize: 10.5, textAlign: "right", marginTop: 3 },
  expenseAddChip: { flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: COLORS.mint, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  expenseIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.softWarning, alignItems: "center", justifyContent: "center" },
  historyRow: { minHeight: 74, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  historySearch: { minHeight: 45, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#FAFAF8", paddingHorizontal: 13, color: COLORS.ink, fontSize: 12, marginBottom: 5 },
  historyDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  historyText: { flex: 1, alignItems: "flex-end" },
  historyName: { color: COLORS.ink, fontSize: 13, fontWeight: "900" },
  historyMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  historyAmount: { minWidth: 79, alignItems: "flex-start" },
  historyDifference: { fontSize: 11, fontWeight: "900" },
  reviewHint: { color: COLORS.muted, fontSize: 9, marginTop: 4 },
  empty: { color: COLORS.muted, fontSize: 12, textAlign: "right" },
  reportCard: { marginTop: 12 },
  reportTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right" },
  reportDate: { color: COLORS.muted, fontSize: 10, textAlign: "right", marginTop: 4 },
  reportRows: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  reportRow: { minHeight: 39, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  reportRowLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "700" },
  reportRowValue: { color: COLORS.ink, fontSize: 12, fontWeight: "900" },
  reportExpenses: { marginTop: 11 },
  reportExpenseRow: { minHeight: 30, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  reportExpenseName: { color: COLORS.muted, fontSize: 10, fontWeight: "800" },
  reportExpenseAmount: { color: COLORS.warning, fontSize: 10, fontWeight: "900" },
  reportNote: { color: COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 10 },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(13, 36, 32, 0.46)", justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject },
  bottomSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 28 },
  sheetHandle: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#D9DEDB", alignSelf: "center", marginBottom: 14 },
  sheetHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  sheetTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "900" },
  sheetClose: { width: 37, height: 37, borderRadius: 12, backgroundColor: "#F2F1EE", alignItems: "center", justifyContent: "center" },
  noticeCard: { flexDirection: "row-reverse", alignItems: "center", gap: 9, padding: 14, backgroundColor: COLORS.mint, borderColor: "#C9EBDD" },
  noticeText: { flex: 1, color: COLORS.primary, fontSize: 11, fontWeight: "900", textAlign: "right", lineHeight: 18 },
  noticeClose: { width: 26, height: 26, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  expectedRow: { backgroundColor: "#F2F1EE", borderRadius: 18, paddingHorizontal: 15, minHeight: 62, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  expectedValue: { color: COLORS.ink, fontSize: 17, fontWeight: "900" },
  expectedLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "800" },
  differenceBox: { minHeight: 63, borderRadius: 18, paddingHorizontal: 15, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  differenceLabel: { fontSize: 12, fontWeight: "900" },
  differenceValue: { fontSize: 18, fontWeight: "900" },
});
