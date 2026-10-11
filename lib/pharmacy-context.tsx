import AsyncStorage from "@react-native-async-storage/async-storage";
import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createLocalStorage, type LocalStorage } from "./local-storage";
import {
  cloudBackupConfigured,
  deleteBackup,
  downloadBackup,
  listBackups,
  pruneBackups,
  uploadBackup,
} from "./cloud-backup";
import type { BackupSummary } from "./cloud-backup";
import { canStartShift } from "./shift-schedule";
import { clearShortageUnavailable as clearUnavailable, commitSupplierOrder as commitOrder, logShortage, markShortageUnavailable as markUnavailable, receiveShortages } from "./shortage-actions";
import { DEFAULT_PRINTER_SETTINGS, type LabelQueueItem, type PrinterSettings } from "./printer-types";

export type ExpiryBatch = { id: string; expiryDate: string; quantity: number; receivedAt: string };
export type Medication = {
  id: string;
  catalogId?: string;
  name: string;
  category: string;
  sku: string;
  barcode?: string;
  price: number;
  quantity: number;
  unitsPerPackage?: number;
  reorderLevel: number;
  expiryDate: string;
  expiryBatches?: ExpiryBatch[];
};

export type CartItem = { medicationId: string; name: string; unitPrice: number; quantity: number; unitLabel?: string };
// طرق الدفع القديمة محفوظة للتوافق مع الفواتير السابقة فقط؛ المبيعات الجديدة مقيدة بالنقدي وفودافون كاش.
export type Sale = { id: string; createdAt: string; items: CartItem[]; total: number; paymentMethod: "نقدي" | "فودافون كاش" | "بطاقة" | "محفظة"; shiftId?: string; cashReceived?: number; change?: number };
export type NewSalePaymentMethod = "نقدي" | "فودافون كاش";
export type Supplier = { id: string; name: string; company: string; phone: string; lastOrder: string };
export type IncomingOrderItem = { medicationId?: string; catalogId?: string; name: string; quantity: number; unitCost: number; expiryDate?: string };
export type IncomingOrder = { id: string; supplierName: string; sourceType: "شركة" | "مكتب" | "مورد آخر"; referenceNumber?: string; total?: number; notes?: string; invoiceUri?: string; receiptUri?: string; status?: "قيد الانتظار" | "تم الإرسال" | "تم الاستلام"; items?: IncomingOrderItem[]; receivedAt?: string; createdAt: string };
export type Shift = { id: string; pharmacistName: string; openingCash: number; startedAt: string; closedAt?: string; actualCash?: number; difference?: number; note?: string };
export type Expense = { id: string; title: string; amount: number; category: "توريد" | "تشغيل" | "أخرى"; createdAt: string; orderId?: string; paidAmount?: number; shiftId?: string };
export type CustomerDebt = { id: string; customerName: string; phone?: string; total: number; paid: number; createdAt: string; note?: string };
export type PharmacySettings = { imageRetentionDays: number; printer: PrinterSettings; labelQueue: LabelQueueItem[]; autoCloudBackup?: boolean };
export type ReorderRecord = {
  medicationId: string;
  markedAt: string;
  quantityAtMark: number;
  manual?: boolean;
  status?: "needed" | "ordered" | "received";
  desiredQuantity?: number;
  supplierName?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  demandCount?: number;
  urgency?: "critical" | "high" | "normal";
  unit?: "علبة" | "شريط" | "قطعة";
  urgent?: boolean;
  requestedByName?: string;
  orderedAt?: string;
  orderedByName?: string;
  receivedQty?: number;
  receivedAt?: string;
  unavailableSuppliers?: string[];
};
export type ReorderNeed = {
  medication: Medication;
  status: "needed" | "ordered" | "received";
  resumed: boolean;
  orderedAt?: string;
  desiredQuantity: number;
  supplierName?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  demandCount: number;
  urgency: "critical" | "high" | "normal";
  unit?: "علبة" | "شريط" | "قطعة";
  urgent: boolean;
  requestedByName?: string;
  orderedByName?: string;
  receivedQty: number;
  receivedAt?: string;
  unavailableSuppliers: string[];
};
export type PharmacyAlert = { id: string; medicationId: string; title: string; detail: string; severity: "high" | "medium" | "low"; kind: "stock" | "expiry" };
export type PharmacyState = { medications: Medication[]; sales: Sale[]; suppliers: Supplier[]; incomingOrders: IncomingOrder[]; reorderRecords: ReorderRecord[]; shifts: Shift[]; expenses: Expense[]; debts: CustomerDebt[]; settings: PharmacySettings };

type PharmacyContextValue = PharmacyState & {
  isReady: boolean;
  alerts: PharmacyAlert[];
  reorderNeeds: ReorderNeed[];
  addMedication: (medication: Omit<Medication, "id">) => void;
  updateMedication: (id: string, medication: Omit<Medication, "id">) => void;
  deleteMedication: (id: string) => void;
  completeSale: (items: CartItem[], paymentMethod: NewSalePaymentMethod, paymentDetails?: { cashReceived?: number; change?: number }) => boolean;
  addSupplier: (supplier: Omit<Supplier, "id" | "lastOrder">) => void;
  deleteSupplier: (id: string) => void;
  addIncomingOrder: (order: Omit<IncomingOrder, "id" | "createdAt">) => void;
  markReorderOrdered: (medicationId: string) => void;
  markReorderReceived: (medicationId: string, addToStock?: boolean) => void;
  updateReorderNeed: (medicationId: string, updates: Partial<ReorderRecord>) => void;
  incrementReorderDemand: (medicationId: string) => void;
  removeReorderNeed: (medicationId: string) => void;
  logShortageEntry: (entry: { medicationId: string; qty: number; unit?: "علبة" | "شريط" | "قطعة"; urgent?: boolean; note?: string; supplierName?: string; customerName?: string; customerPhone?: string }) => boolean;
  markShortageUnavailable: (medicationId: string, supplierName: string | null) => void;
  clearShortageUnavailable: (medicationId: string, supplierName: string | null) => void;
  commitSupplierOrder: (commit: { supplier: string | null; orderedIds: string[]; unavailableIds: string[]; desiredQuantities?: Record<string, number>; orderedByName?: string }) => number;
  receiveShortagesForDelivery: (delivered: Array<{ medicationId: string; qty: number }>) => { received: number; partial: number };
  restoreReorderRecords: (records: ReorderRecord[]) => void;
  addCustomShortage: (data: {
    name: string;
    category?: string;
    barcode?: string;
    price?: number;
    desiredQuantity?: number;
    supplierName?: string;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    urgent?: boolean;
    unit?: "علبة" | "شريط" | "قطعة";
  }) => void;
  addReorderNeedFromCatalog: (medication: Omit<Medication, "id">) => void;
  startShift: (pharmacistName: string, openingCash: number) => boolean;
  closeShift: (shiftId: string, actualCash: number, note?: string) => void;
  addExpense: (expense: Omit<Expense, "id" | "createdAt">) => void;
  addDebt: (debt: Omit<CustomerDebt, "id" | "createdAt">) => void;
  settleDebt: (debtId: string, amount: number) => void;
  receiveIncomingOrder: (orderId: string, items: IncomingOrderItem[], attachments?: { invoiceUri?: string; receiptUri?: string }) => boolean;
  updateSettings: (settings: Partial<PharmacySettings>) => void;
  cloudBackups: BackupSummary[];
  cloudBackupBusy: boolean;
  cloudBackupError?: string;
  lastCloudBackupAt?: string;
  backupNow: (source?: string) => Promise<string>;
  refreshCloudBackups: () => Promise<void>;
  restoreCloudBackup: (id: number) => Promise<string>;
  deleteCloudBackup: (id: number) => Promise<void>;
  activeShift?: Shift;
};

const PharmacyContext = createContext<PharmacyContextValue | undefined>(undefined);
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const dateFromToday = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
export const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
export const getUnitsPerPackage = (medication: Pick<Medication, "unitsPerPackage">) => Math.max(1, Math.trunc(medication.unitsPerPackage ?? 1));
export const getUnitPrice = (medication: Pick<Medication, "price" | "unitsPerPackage">) => medication.price / getUnitsPerPackage(medication);
export const calculateExpectedShiftCash = (openingCash: number, cashSales: number, shiftExpenses: number) => Math.max(0, openingCash + cashSales - shiftExpenses);

export const getExpiryBatches = (medication: Pick<Medication, "expiryDate" | "quantity" | "expiryBatches">): ExpiryBatch[] => {
  const rawBatches = Array.isArray(medication.expiryBatches) && medication.expiryBatches.length
    ? medication.expiryBatches
    : [{ id: "legacy-batch", expiryDate: medication.expiryDate, quantity: medication.quantity, receivedAt: "" }];
  return rawBatches
    .filter((batch) => /^\d{4}-\d{2}-\d{2}$/.test(batch.expiryDate) && batch.quantity > 0)
    .map((batch) => ({ ...batch, quantity: Math.max(0, Math.trunc(batch.quantity)) }))
    .sort((left, right) => left.expiryDate.localeCompare(right.expiryDate));
};

export const getNearestExpiryDate = (medication: Pick<Medication, "expiryDate" | "quantity" | "expiryBatches">) => getExpiryBatches(medication)[0]?.expiryDate ?? medication.expiryDate;
export const formatExpiryMonthYear = (date: string) => {
  const parsed = new Date(`${date}T12:00:00`);
  return `${parsed.getMonth() + 1}/${parsed.getFullYear()}`;
};

const withExpiryBatches = (medication: Omit<Medication, "id">): Omit<Medication, "id"> => {
  const expiryBatches = getExpiryBatches(medication);
  const expiryDate = expiryBatches[0]?.expiryDate ?? medication.expiryDate;
  return { ...medication, expiryDate, expiryBatches };
};

const addToExpiryBatches = (medication: Medication, quantity: number, expiryDate: string) => {
  const batches = getExpiryBatches(medication);
  const existingIndex = batches.findIndex((batch) => batch.expiryDate === expiryDate);
  const nextBatch: ExpiryBatch = { id: makeId("batch"), expiryDate, quantity: Math.max(0, Math.trunc(quantity)), receivedAt: new Date().toISOString() };
  const nextBatches = existingIndex >= 0
    ? batches.map((batch, index) => index === existingIndex ? { ...batch, quantity: batch.quantity + nextBatch.quantity } : batch)
    : [...batches, nextBatch];
  return getExpiryBatches({ ...medication, expiryBatches: nextBatches, quantity: medication.quantity + nextBatch.quantity });
};

const removeFromExpiryBatches = (medication: Medication, quantity: number) => {
  let remaining = Math.max(0, Math.trunc(quantity));
  return getExpiryBatches(medication).map((batch) => {
    const removed = Math.min(batch.quantity, remaining);
    remaining -= removed;
    return { ...batch, quantity: batch.quantity - removed };
  }).filter((batch) => batch.quantity > 0);
};

const createDemoState = (): PharmacyState => ({
  medications: [
    { id: "med-1", name: "بانادول إكسترا", category: "مسكنات", sku: "PAN-500", price: 72, quantity: 34, reorderLevel: 12, expiryDate: dateFromToday(210) },
    { id: "med-2", name: "أوجمنتين 1 جم", category: "مضادات حيوية", sku: "AUG-1G", price: 165, quantity: 7, reorderLevel: 10, expiryDate: dateFromToday(96) },
    { id: "med-3", name: "كونجستال", category: "برد وحساسية", sku: "CON-20", price: 54, quantity: 18, reorderLevel: 8, expiryDate: dateFromToday(42) },
    { id: "med-4", name: "فيتامين د3", category: "فيتامينات", sku: "D3-1000", price: 115, quantity: 22, reorderLevel: 10, expiryDate: dateFromToday(315) },
    { id: "med-5", name: "بخاخ محلول ملحي", category: "عناية شخصية", sku: "SAL-50", price: 45, quantity: 4, reorderLevel: 8, expiryDate: dateFromToday(178) },
    { id: "med-6", name: "أوميبرازول 20 مجم", category: "جهاز هضمي", sku: "OME-20", price: 88, quantity: 29, reorderLevel: 10, expiryDate: dateFromToday(264) },
  ],
  sales: [
    { id: "sale-1", createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), items: [{ medicationId: "med-1", name: "بانادول إكسترا", unitPrice: 72, quantity: 2 }], total: 144, paymentMethod: "نقدي" },
    { id: "sale-2", createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(), items: [{ medicationId: "med-4", name: "فيتامين د3", unitPrice: 115, quantity: 1 }], total: 115, paymentMethod: "بطاقة" },
    { id: "sale-3", createdAt: new Date(Date.now() - 4.25 * 60 * 60 * 1000).toISOString(), items: [{ medicationId: "med-3", name: "كونجستال", unitPrice: 54, quantity: 1 }, { medicationId: "med-5", name: "بخاخ محلول ملحي", unitPrice: 45, quantity: 1 }], total: 99, paymentMethod: "محفظة" },
  ],
  suppliers: [
    { id: "supplier-1", name: "أحمد السعدني", company: "مخازن النيل", phone: "0100 245 1976", lastOrder: "منذ يومين" },
    { id: "supplier-2", name: "سارة عادل", company: "المتحدة للأدوية", phone: "0122 880 5431", lastOrder: "منذ 5 أيام" },
    { id: "supplier-3", name: "محمود نبيل", company: "ميديكال إمداد", phone: "0111 638 9204", lastOrder: "منذ أسبوع" },
  ],
  incomingOrders: [],
  reorderRecords: [],
  shifts: [],
  expenses: [],
  debts: [],
  settings: { imageRetentionDays: 30, printer: DEFAULT_PRINTER_SETTINGS, labelQueue: [], autoCloudBackup: false },
});

export const normalizePharmacyState = (stored: Partial<PharmacyState>): PharmacyState => {
  const demo = createDemoState();
  return {
    medications: Array.isArray(stored.medications) ? stored.medications.map((medication) => ({ ...withExpiryBatches({ ...medication, unitsPerPackage: getUnitsPerPackage(medication) }), id: medication.id })) : demo.medications,
    sales: Array.isArray(stored.sales) ? stored.sales : demo.sales,
    suppliers: Array.isArray(stored.suppliers) ? stored.suppliers : demo.suppliers,
    incomingOrders: Array.isArray(stored.incomingOrders) ? stored.incomingOrders.map((order) => ({ status: "قيد الانتظار", ...order })) : [],
    reorderRecords: Array.isArray(stored.reorderRecords) ? stored.reorderRecords : [],
    shifts: Array.isArray(stored.shifts) ? stored.shifts : [],
    expenses: Array.isArray(stored.expenses) ? stored.expenses : [],
    debts: Array.isArray(stored.debts) ? stored.debts : [],
    settings: { imageRetentionDays: stored.settings?.imageRetentionDays ?? 30, printer: { ...DEFAULT_PRINTER_SETTINGS, ...(stored.settings?.printer ?? {}), labelPositions: { ...DEFAULT_PRINTER_SETTINGS.labelPositions, ...(stored.settings?.printer?.labelPositions ?? {}) } }, labelQueue: Array.isArray(stored.settings?.labelQueue) ? stored.settings.labelQueue : [], autoCloudBackup: Boolean(stored.settings?.autoCloudBackup) },
  };
};

export const buildAlerts = (medications: Medication[]): PharmacyAlert[] => {
  const generated: PharmacyAlert[] = [];
  medications.forEach((medication) => {
    if (medication.quantity <= medication.reorderLevel) {
      const severity = medication.quantity <= Math.max(2, Math.floor(medication.reorderLevel / 2)) ? "high" : "medium";
      generated.push({ id: `stock-${medication.id}`, medicationId: medication.id, title: severity === "high" ? "مخزون حرج" : "مخزون منخفض", detail: `${medication.name} — المتاح ${medication.quantity} وحدة بيع فقط`, severity, kind: "stock" });
    }
    const expiryDate = getNearestExpiryDate(medication);
    const remainingDays = daysUntil(expiryDate);
    if (remainingDays <= 60) generated.push({ id: `expiry-${medication.id}`, medicationId: medication.id, title: remainingDays < 0 ? "انتهت الصلاحية" : "صلاحية قريبة", detail: remainingDays < 0 ? `${medication.name} يحتاج إلى معالجة فورية` : `${medication.name} ينتهي خلال ${remainingDays} يومًا`, severity: remainingDays <= 20 ? "high" : "medium", kind: "expiry" });
  });
  return generated.sort((a, b) => (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1));
};

export const buildReorderNeeds = (medications: Medication[], records: ReorderRecord[]): ReorderNeed[] => {
  const recordByMedication = new Map(records.map((record) => [record.medicationId, record]));
  return medications
    .filter((medication) => medication.quantity <= medication.reorderLevel || Boolean(recordByMedication.get(medication.id)?.manual))
    .map((medication) => {
      const record = recordByMedication.get(medication.id);
      const resumed = Boolean(!record?.manual && record && medication.quantity < record.quantityAtMark);
      let status: ReorderNeed["status"];
      if (record?.manual) {
        status = record.status ?? "needed";
      } else if (record?.status === "received" && !resumed) {
        status = "received";
      } else if (record && !resumed) {
        status = record.status === "ordered" ? "ordered" : (record.status ?? "ordered");
      } else {
        status = "needed";
      }
      const defaultDesiredQty = Math.max(1, (medication.reorderLevel * 2) - medication.quantity);
      return {
        medication,
        status,
        resumed,
        orderedAt: record?.orderedAt ?? (record?.status === "ordered" ? record?.markedAt : undefined),
        desiredQuantity: record?.desiredQuantity ?? defaultDesiredQty,
        unit: record?.unit,
        urgent: Boolean(record?.urgent),
        requestedByName: record?.requestedByName,
        orderedByName: record?.orderedByName,
        receivedQty: record?.receivedQty ?? 0,
        receivedAt: record?.receivedAt,
        unavailableSuppliers: record?.unavailableSuppliers ?? [],
        supplierName: record?.supplierName,
        customerName: record?.customerName,
        customerPhone: record?.customerPhone,
        notes: record?.notes,
        demandCount: record?.demandCount ?? 1,
        urgency: record?.urgency ?? (medication.quantity === 0 ? "critical" : medication.quantity <= Math.max(2, Math.floor(medication.reorderLevel / 2)) ? "high" : "normal"),
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) {
        const order: Record<ReorderNeed["status"], number> = { needed: 0, ordered: 1, received: 2 };
        return (order[a.status] ?? 0) - (order[b.status] ?? 0);
      }
      if ((b.demandCount ?? 1) !== (a.demandCount ?? 1)) {
        return (b.demandCount ?? 1) - (a.demandCount ?? 1);
      }
      return a.medication.quantity - b.medication.quantity;
    });
};

export const calculateOrderTotal = (items: CartItem[]) => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
export const calculateCashChange = (total: number, cashReceived: number) => Math.max(0, cashReceived - total);

async function removeExpiredOrderAttachments(state: PharmacyState) {
  const cutoff = Date.now() - state.settings.imageRetentionDays * 86_400_000;
  const { File } = await import("expo-file-system");
  const nextOrders = await Promise.all(state.incomingOrders.map(async (order) => {
    if (new Date(order.createdAt).getTime() >= cutoff) return order;
    for (const uri of [order.invoiceUri, order.receiptUri]) {
      if (uri?.startsWith("file:")) { try { new File(uri).delete(); } catch { /* The file may already be removed by the system. */ } }
    }
    return { ...order, invoiceUri: undefined, receiptUri: undefined };
  }));
  return { ...state, incomingOrders: nextOrders };
}

const arabic = (value: number) => value.toLocaleString("ar-EG");

export function PharmacyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PharmacyState>(createDemoState);
  const [isReady, setIsReady] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<BackupSummary[]>([]);
  const [cloudBackupBusy, setCloudBackupBusy] = useState(false);
  const [cloudBackupError, setCloudBackupError] = useState<string>();
  const storageRef = useRef<LocalStorage | null>(null);
  const stateRef = useRef(state);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoRef = useRef(true);

  useEffect(() => {
    const load = async () => {
      try {
        const storage = await createLocalStorage();
        storageRef.current = storage;
        const stored = await storage.get();
        const loaded = stored ? normalizePharmacyState(JSON.parse(stored) as Partial<PharmacyState>) : createDemoState();
        setState(await removeExpiredOrderAttachments(loaded));
      } catch { setState(createDemoState()); } finally { setIsReady(true); }
    };
    void load();
    return () => { void storageRef.current?.close(); };
  }, []);

  useEffect(() => {
    if (!isReady || !storageRef.current) return;
    stateRef.current = state;
    void storageRef.current.set(JSON.stringify(state));
  }, [isReady, state]);

  // الرفع التلقائي مؤجّل حتى لا تُرسل نسخة عن كل ضغطة، بل بعد توقف التعديل.
  useEffect(() => {
    if (!isReady) return;
    if (skipAutoRef.current) { skipAutoRef.current = false; return; }
    if (!cloudBackupConfigured || !state.settings.autoCloudBackup) return;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => {
      void uploadBackup(stateRef.current, "تلقائي")
        .then((summary) => {
          setCloudBackups((current) => [summary, ...current.filter((item) => item.id !== summary.id)].slice(0, 8));
          void pruneBackups(30).catch(() => undefined);
        })
        .catch((error) => setCloudBackupError(error instanceof Error ? error.message : "تعذّر الرفع التلقائي."));
    }, 45_000);
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); };
  }, [isReady, state]);

  useEffect(() => {
    if (!isReady || !cloudBackupConfigured) return;
    void listBackups(8).then(setCloudBackups).catch(() => undefined);
  }, [isReady]);

  // كل عملية تمسّ الفلوس تاخد نسخة سحابية فورية، من غير انتظار مؤقّت الرفع التلقائي.
  const treasurySignature = `${state.shifts.length}|${state.expenses.length}|${state.sales.length}|${state.debts.reduce((sum, debt) => sum + debt.paid, 0)}`;
  const firstTreasuryRef = useRef(true);
  useEffect(() => {
    if (!isReady || !cloudBackupConfigured) return;
    if (firstTreasuryRef.current) { firstTreasuryRef.current = false; return; }
    void uploadBackup(stateRef.current, "خزينة")
      .then((summary) => setCloudBackups((current) => [summary, ...current.filter((item) => item.id !== summary.id)].slice(0, 8)))
      .catch((error) => setCloudBackupError(error instanceof Error ? error.message : "تعذّرت نسخة الخزينة الاحتياطية."));
  }, [isReady, treasurySignature]);

  const value = useMemo<PharmacyContextValue>(() => ({
    ...state,
    isReady,
    alerts: buildAlerts(state.medications),
    reorderNeeds: buildReorderNeeds(state.medications, state.reorderRecords),
    addMedication: (medication) => setState((current) => ({ ...current, medications: [{ ...withExpiryBatches(medication), id: makeId("med") }, ...current.medications] })),
    updateMedication: (id, medication) => setState((current) => {
      const previous = current.medications.find((item) => item.id === id);
      const isRestocked = Boolean(previous && medication.quantity > previous.quantity && medication.quantity > medication.reorderLevel);
      const expiryBatches = previous
        ? medication.quantity > previous.quantity
          ? addToExpiryBatches(previous, medication.quantity - previous.quantity, getNearestExpiryDate(previous))
          : medication.quantity < previous.quantity
            ? removeFromExpiryBatches(previous, previous.quantity - medication.quantity)
            : getExpiryBatches(previous)
        : [];
      const expiryDate = expiryBatches[0]?.expiryDate ?? medication.expiryDate;
      return { ...current, medications: current.medications.map((item) => item.id === id ? { ...withExpiryBatches({ ...medication, expiryDate, expiryBatches }), id } : item), reorderRecords: isRestocked ? current.reorderRecords.filter((record) => record.medicationId !== id) : current.reorderRecords };
    }),
    deleteMedication: (id) => setState((current) => ({ ...current, medications: current.medications.filter((item) => item.id !== id), reorderRecords: current.reorderRecords.filter((record) => record.medicationId !== id) })),
    completeSale: (items, paymentMethod, paymentDetails) => {
      const activeShift = state.shifts.find((shift) => !shift.closedAt);
      const total = calculateOrderTotal(items);
      if (!["نقدي", "فودافون كاش"].includes(paymentMethod as string)) return false;
      if (!activeShift || !items.length || items.some((item) => (state.medications.find((medication) => medication.id === item.medicationId)?.quantity ?? 0) < item.quantity)) return false;
      if (paymentMethod === "نقدي" && (paymentDetails?.cashReceived ?? 0) < total) return false;
      const sale: Sale = { id: makeId("sale"), createdAt: new Date().toISOString(), items, total, paymentMethod, shiftId: activeShift.id, cashReceived: paymentMethod === "نقدي" ? paymentDetails?.cashReceived : undefined, change: paymentMethod === "نقدي" ? paymentDetails?.change : undefined };
      setState((current) => ({ ...current, medications: current.medications.map((medication) => { const saleItem = items.find((item) => item.medicationId === medication.id); if (!saleItem) return medication; const expiryBatches = removeFromExpiryBatches(medication, saleItem.quantity); const expiryDate = expiryBatches[0]?.expiryDate ?? medication.expiryDate; return { ...medication, quantity: medication.quantity - saleItem.quantity, expiryDate, expiryBatches }; }), sales: [sale, ...current.sales] }));
      return true;
    },
    addSupplier: (supplier) => setState((current) => ({ ...current, suppliers: [{ ...supplier, id: makeId("supplier"), lastOrder: "لم يتم الطلب بعد" }, ...current.suppliers] })),
    // الطلبيات ترتبط باسم الجهة لا بسجلها، لذا حذف المورد لا يمس الطلبات المحفوظة.
    deleteSupplier: (id) => setState((current) => ({ ...current, suppliers: current.suppliers.filter((supplier) => supplier.id !== id) })),
    addIncomingOrder: (order) => setState((current) => ({ ...current, incomingOrders: [{ ...order, id: makeId("order"), status: order.status ?? "قيد الانتظار", createdAt: new Date().toISOString() }, ...current.incomingOrders] })),
    startShift: (pharmacistName, openingCash) => {
      // القاعدة مركزية هنا: لا شيفت جديد قبل قفل السابق، ولا بدء خارج نوافذ الورديات.
      if (!pharmacistName.trim() || openingCash < 0 || !canStartShift(state.shifts).ok) return false;
      setState((current) => ({ ...current, shifts: [{ id: makeId("shift"), pharmacistName: pharmacistName.trim(), openingCash, startedAt: new Date().toISOString() }, ...current.shifts] }));
      return true;
    },
    closeShift: (shiftId, actualCash, note) => setState((current) => { const shift = current.shifts.find((item) => item.id === shiftId); if (!shift || shift.closedAt) return current; const cashSalesTotal = current.sales.filter((sale) => sale.shiftId === shiftId && sale.paymentMethod === "نقدي").reduce((sum, sale) => sum + sale.total, 0); const shiftExpensesTotal = current.expenses.filter((expense) => expense.shiftId === shiftId).reduce((sum, expense) => sum + expense.amount, 0); return { ...current, shifts: current.shifts.map((item) => item.id === shiftId ? { ...item, closedAt: new Date().toISOString(), actualCash, difference: actualCash - calculateExpectedShiftCash(shift.openingCash, cashSalesTotal, shiftExpensesTotal), note } : item) }; }),
    addExpense: (expense) => setState((current) => {
      // المصروف يُربط بالشيفت المفتوح فقط؛ إلحاقه بشيفت مقفّل يعني العبث برصيده بعد إغلاقه.
      const openShift = current.shifts.find((shift) => !shift.closedAt);
      const requested = expense.shiftId ? current.shifts.find((shift) => shift.id === expense.shiftId && !shift.closedAt) : undefined;
      const linkedShift = requested ?? openShift;
      return { ...current, expenses: [{ ...expense, shiftId: linkedShift?.id, id: makeId("expense"), createdAt: new Date().toISOString() }, ...current.expenses] };
    }),
    addDebt: (debt) => setState((current) => ({ ...current, debts: [{ ...debt, id: makeId("debt"), createdAt: new Date().toISOString() }, ...current.debts] })),
    settleDebt: (debtId, amount) => setState((current) => ({ ...current, debts: current.debts.map((debt) => debt.id === debtId ? { ...debt, paid: Math.min(debt.total, debt.paid + Math.max(0, amount)) } : debt) })),
    receiveIncomingOrder: (orderId, items, attachments) => {
      const order = state.incomingOrders.find((item) => item.id === orderId);
      if (!order || order.status === "تم الاستلام") return false;
      setState((current) => {
        const medications = current.medications.map((medication) => { const line = items.find((item) => item.medicationId === medication.id); if (!line) return medication; const expiryBatches = addToExpiryBatches(medication, line.quantity, line.expiryDate ?? medication.expiryDate); return { ...medication, quantity: medication.quantity + line.quantity, price: line.unitCost * getUnitsPerPackage(medication), expiryDate: expiryBatches[0]?.expiryDate ?? medication.expiryDate, expiryBatches }; });
        const total = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
        const currentShift = current.shifts.find((shift) => !shift.closedAt);
        return { ...current, medications, incomingOrders: current.incomingOrders.map((item) => item.id === orderId ? { ...item, status: "تم الاستلام", items, total, receivedAt: new Date().toISOString(), ...attachments } : item), expenses: [{ id: makeId("expense"), title: `توريد ${order.supplierName}`, category: "توريد", amount: total, paidAmount: total, orderId, shiftId: currentShift?.id, createdAt: new Date().toISOString() }, ...current.expenses] };
      });
      return true;
    },
    updateSettings: (settings) => setState((current) => ({ ...current, settings: { ...current.settings, ...settings } })),
    markReorderOrdered: (medicationId) => setState((current) => {
      const medication = current.medications.find((item) => item.id === medicationId);
      const existing = current.reorderRecords.find((item) => item.medicationId === medicationId);
      if (!medication || (!existing?.manual && medication.quantity > medication.reorderLevel)) return current;
      const record: ReorderRecord = { ...existing, medicationId, markedAt: new Date().toISOString(), quantityAtMark: medication.quantity, manual: existing?.manual, status: "ordered" };
      return { ...current, reorderRecords: [record, ...current.reorderRecords.filter((item) => item.medicationId !== medicationId)] };
    }),
    markReorderReceived: (medicationId, addToStock = true) => setState((current) => {
      const medication = current.medications.find((item) => item.id === medicationId);
      const existing = current.reorderRecords.find((item) => item.medicationId === medicationId);
      if (!medication) return current;
      const receivedQty = Math.max(1, existing?.desiredQuantity ?? Math.max(1, (medication.reorderLevel * 2) - medication.quantity));
      let nextMedications = current.medications;
      if (addToStock) {
        const expiryBatches = addToExpiryBatches(medication, receivedQty, getNearestExpiryDate(medication));
        const expiryDate = expiryBatches[0]?.expiryDate ?? medication.expiryDate;
        nextMedications = current.medications.map((item) => item.id === medicationId ? { ...item, quantity: item.quantity + receivedQty, expiryDate, expiryBatches } : item);
      }
      const newQty = addToStock ? medication.quantity + receivedQty : medication.quantity;
      let nextRecords: ReorderRecord[];
      if (newQty > medication.reorderLevel && !existing?.manual) {
        nextRecords = current.reorderRecords.filter((item) => item.medicationId !== medicationId);
      } else {
        const at = new Date().toISOString();
        const record: ReorderRecord = { ...existing, medicationId, markedAt: new Date().toISOString(), quantityAtMark: newQty, manual: existing?.manual, status: "received", receivedQty: existing?.desiredQuantity ?? 0, receivedAt: at };
        nextRecords = [record, ...current.reorderRecords.filter((item) => item.medicationId !== medicationId)];
      }
      return { ...current, medications: nextMedications, reorderRecords: nextRecords };
    }),
    updateReorderNeed: (medicationId, updates) => setState((current) => {
      const medication = current.medications.find((item) => item.id === medicationId);
      if (!medication) return current;
      const existing = current.reorderRecords.find((item) => item.medicationId === medicationId);
      const record: ReorderRecord = {
        medicationId,
        markedAt: existing?.markedAt ?? new Date().toISOString(),
        quantityAtMark: existing?.quantityAtMark ?? medication.quantity,
        manual: existing?.manual ?? true,
        status: existing?.status ?? "needed",
        desiredQuantity: existing?.desiredQuantity ?? Math.max(1, (medication.reorderLevel * 2) - medication.quantity),
        demandCount: existing?.demandCount ?? 1,
        urgency: existing?.urgency,
        ...existing,
        ...updates,
      };
      return { ...current, reorderRecords: [record, ...current.reorderRecords.filter((item) => item.medicationId !== medicationId)] };
    }),
    incrementReorderDemand: (medicationId) => setState((current) => {
      const medication = current.medications.find((item) => item.id === medicationId);
      if (!medication) return current;
      const existing = current.reorderRecords.find((item) => item.medicationId === medicationId);
      const currentDemand = existing?.demandCount ?? 1;
      const record: ReorderRecord = {
        medicationId,
        markedAt: existing?.markedAt ?? new Date().toISOString(),
        quantityAtMark: existing?.quantityAtMark ?? medication.quantity,
        manual: existing?.manual ?? true,
        status: existing?.status ?? "needed",
        desiredQuantity: existing?.desiredQuantity ?? Math.max(1, (medication.reorderLevel * 2) - medication.quantity),
        urgency: existing?.urgency,
        ...existing,
        demandCount: currentDemand + 1,
      };
      return { ...current, reorderRecords: [record, ...current.reorderRecords.filter((item) => item.medicationId !== medicationId)] };
    }),
    removeReorderNeed: (medicationId) => setState((current) => ({
      ...current,
      reorderRecords: current.reorderRecords.filter((item) => item.medicationId !== medicationId),
    })),
    logShortageEntry: (entry) => {
      const medication = stateRef.current.medications.find((item) => item.id === entry.medicationId);
      if (!medication) return false;
      setState((current) => ({
        ...current,
        reorderRecords: logShortage(current.reorderRecords, {
          ...entry,
          qty: entry.qty,
          at: new Date().toISOString(),
          baselineQuantity: medication.quantity,
          requestedByName: current.shifts.find((shift) => !shift.closedAt)?.pharmacistName,
        }).records,
      }));
      return true;
    },
    markShortageUnavailable: (medicationId, supplierName) => setState((current) => ({
      ...current,
      reorderRecords: markUnavailable(current.reorderRecords, medicationId, supplierName),
    })),
    clearShortageUnavailable: (medicationId, supplierName) => setState((current) => ({
      ...current,
      reorderRecords: clearUnavailable(current.reorderRecords, medicationId, supplierName),
    })),
    commitSupplierOrder: (commit) => {
      const { changed } = commitOrder(stateRef.current.reorderRecords, { ...commit, at: new Date().toISOString() });
      if (changed) setState((current) => ({ ...current, reorderRecords: commitOrder(current.reorderRecords, { ...commit, at: new Date().toISOString() }).records }));
      return changed;
    },
    receiveShortagesForDelivery: (delivered) => {
      const at = new Date().toISOString();
      const result = receiveShortages(stateRef.current.reorderRecords, delivered, at);
      if (result.received || result.partial) setState((current) => ({ ...current, reorderRecords: receiveShortages(current.reorderRecords, delivered, at).records }));
      return { received: result.received, partial: result.partial };
    },
    restoreReorderRecords: (records) => setState((current) => ({ ...current, reorderRecords: records })),
    addCustomShortage: (data) => setState((current) => {
      const existing = current.medications.find(
        (item) => (data.barcode && item.barcode === data.barcode) || item.name.trim().toLowerCase() === data.name.trim().toLowerCase()
      );
      const target: Medication = existing ?? {
        id: makeId("med"),
        name: data.name.trim(),
        category: data.category?.trim() || "أخرى",
        sku: data.barcode || makeId("SKU"),
        barcode: data.barcode,
        price: data.price ?? 0,
        quantity: 0,
        reorderLevel: 5,
        expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
      };
      const { records } = logShortage(current.reorderRecords, {
        medicationId: target.id,
        qty: data.desiredQuantity ?? 5,
        at: new Date().toISOString(),
        baselineQuantity: target.quantity,
        unit: data.unit,
        urgent: data.urgent ?? Boolean(data.customerName),
        note: data.notes,
        supplierName: data.supplierName,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        requestedByName: current.shifts.find((shift) => !shift.closedAt)?.pharmacistName,
      });
      return {
        ...current,
        medications: existing ? current.medications : [target, ...current.medications],
        reorderRecords: records,
      };
    }),
    addReorderNeedFromCatalog: (medication) => setState((current) => {
      const existing = current.medications.find((item) => (medication.catalogId && item.catalogId === medication.catalogId) || (medication.barcode && item.barcode === medication.barcode) || item.sku === medication.sku);
      const target = existing ?? { ...medication, id: makeId("med") };
      const { records } = logShortage(current.reorderRecords, {
        medicationId: target.id,
        qty: 5,
        at: new Date().toISOString(),
        baselineQuantity: target.quantity,
        requestedByName: current.shifts.find((shift) => !shift.closedAt)?.pharmacistName,
      });
      return { ...current, medications: existing ? current.medications : [target, ...current.medications], reorderRecords: records };
    }),
    cloudBackups,
    cloudBackupBusy,
    cloudBackupError,
    lastCloudBackupAt: cloudBackups[0]?.createdAt,
    backupNow: async (source = "يدوي") => {
      setCloudBackupBusy(true);
      setCloudBackupError(undefined);
      try {
        const summary = await uploadBackup(stateRef.current, source);
        setCloudBackups((current) => [summary, ...current.filter((item) => item.id !== summary.id)].slice(0, 8));
        return `تم رفع نسخة سحابية (${arabic(summary.counts.medications)} صنف، ${arabic(summary.counts.sales)} فاتورة).`;
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذّر رفع النسخة.";
        setCloudBackupError(message);
        throw error;
      } finally {
        setCloudBackupBusy(false);
      }
    },
    refreshCloudBackups: async () => {
      setCloudBackupBusy(true);
      setCloudBackupError(undefined);
      try { setCloudBackups(await listBackups(8)); }
      catch (error) { setCloudBackupError(error instanceof Error ? error.message : "تعذّر قراءة قائمة النسخ."); throw error; }
      finally { setCloudBackupBusy(false); }
    },
    restoreCloudBackup: async (id) => {
      setCloudBackupBusy(true);
      setCloudBackupError(undefined);
      try {
        const pack = await downloadBackup(id);
        const next = normalizePharmacyState(pack.state);
        stateRef.current = next;
        setState(next);
        const when = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(pack.exportedAt));
        return `تم استرجاع نسخة ${when} على هذا الجهاز. البيانات القديمة ما زالت محفوظة في السحابة.`;
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذّر استرجاع النسخة.";
        setCloudBackupError(message);
        throw error;
      } finally {
        setCloudBackupBusy(false);
      }
    },
    deleteCloudBackup: async (id) => {
      await deleteBackup(id);
      setCloudBackups((current) => current.filter((item) => item.id !== id));
    },
    activeShift: state.shifts.find((shift) => !shift.closedAt),
  }), [cloudBackupBusy, cloudBackupError, cloudBackups, isReady, state]);

  return <PharmacyContext.Provider value={value}>{children}</PharmacyContext.Provider>;
}

export function usePharmacy() {
  const context = useContext(PharmacyContext);
  if (!context) throw new Error("usePharmacy must be used within PharmacyProvider");
  return context;
}

export const formatCurrency = (value: number) => `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(value)} ج.م`;
export const formatShortDate = (date: string) => new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(date));
export const isExpirySoon = (date: string) => daysUntil(date) <= 60;
