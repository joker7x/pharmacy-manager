export type LabelElement = "name" | "barcode" | "price" | "expiry";

export type LabelPosition = { x: number; y: number };

export type SavedUsbPrinter = {
  deviceName: string;
  deviceId?: number;
  devicePath?: string;
  vendorId?: number;
  productId: number;
};

export type PrinterSettings = {
  savedPrinter?: SavedUsbPrinter;
  baudRate: number;
  labelPreset: "40x30" | "50x30" | "custom";
  labelWidthMm: number;
  labelHeightMm: number;
  labelElements: LabelElement[];
  labelPositions: Record<LabelElement, LabelPosition>;
};

export const DEFAULT_LABEL_POSITIONS: Record<LabelElement, LabelPosition> = {
  name: { x: 50, y: 10 },
  barcode: { x: 50, y: 45 },
  price: { x: 18, y: 82 },
  expiry: { x: 82, y: 82 },
};

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  baudRate: 9600,
  labelPreset: "40x30",
  labelWidthMm: 40,
  labelHeightMm: 30,
  labelElements: ["name", "barcode", "price", "expiry"],
  labelPositions: DEFAULT_LABEL_POSITIONS,
};

export const LABEL_ELEMENT_LABELS: Record<LabelElement, string> = {
  name: "اسم الصنف",
  barcode: "الباركود",
  price: "السعر",
  expiry: "الصلاحية",
};

export type ReceiptPrintData = {
  receiptNumber: string;
  createdAt: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
};

export type LabelPrintData = { name: string; barcode: string; price: number; expiryMonthYear: string };
export type LabelQueueItem = { id: string; medicationId: string; name: string; barcode: string; price: number; expiryMonthYear: string; quantity: number };
