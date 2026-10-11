export type ExpiryBatch = {
  id: string;
  expiryDate: string;
  quantity: number;
  receivedAt: string;
};

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

export type CartItem = {
  medicationId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  unitLabel?: string;
};

export type NewSalePaymentMethod = "نقدي" | "فودافون كاش";
export type LegacySalePaymentMethod = NewSalePaymentMethod | "بطاقة" | "محفظة";

export type Sale = {
  id: string;
  createdAt: string;
  items: CartItem[];
  total: number;
  paymentMethod: LegacySalePaymentMethod;
  shiftId?: string;
  cashReceived?: number;
  change?: number;
};

export type Supplier = {
  id: string;
  name: string;
  company: string;
  phone: string;
  lastOrder: string;
};

export type ReorderRecord = {
  medicationId: string;
  markedAt: string;
  quantityAtMark: number;
  status: "needed" | "ordered" | "received";
  desiredQuantity: number;
  supplierName?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  demandCount: number;
  urgency: "critical" | "high" | "normal";
  unit?: "علبة" | "شريط" | "قطعة";
  urgent: boolean;
  orderedAt?: string;
  receivedQty?: number;
  receivedAt?: string;
};

export type ReorderNeed = ReorderRecord & {
  medication: Medication;
};

export type Shift = {
  id: string;
  pharmacistName: string;
  openingCash: number;
  startedAt: string;
  closedAt?: string;
  actualCash?: number;
  difference?: number;
  note?: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  category: "توريد" | "تشغيل" | "أخرى";
  createdAt: string;
  shiftId?: string;
};

export type CustomerDebt = {
  id: string;
  customerName: string;
  phone?: string;
  total: number;
  paid: number;
  createdAt: string;
  note?: string;
  payments?: { amount: number; date: string }[];
};

export type PharmacyAlert = {
  id: string;
  medicationId: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  kind: "stock" | "expiry";
};

export type PharmacySettings = {
  pharmacyName: string;
  pharmacistInCharge: string;
  phone: string;
  address: string;
  autoCloudBackup?: boolean;
};

export type PharmacyState = {
  medications: Medication[];
  sales: Sale[];
  suppliers: Supplier[];
  reorderRecords: ReorderRecord[];
  shifts: Shift[];
  expenses: Expense[];
  debts: CustomerDebt[];
  settings: PharmacySettings;
};
