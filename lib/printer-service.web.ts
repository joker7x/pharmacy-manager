import type { LabelPrintData, PrinterSettings, ReceiptPrintData, SavedUsbPrinter } from "./printer-types";

const unsupported = () => { throw new Error("طباعة USB المباشرة تعمل من بناء Android Dev Client فقط، وليست متاحة في معاينة الويب أو Expo Go."); };
export const isUsbPrintingAvailable = false;
export async function listUsbPrinters(): Promise<SavedUsbPrinter[]> { return unsupported(); }
export async function requestUsbPermission(_printer: SavedUsbPrinter) { return unsupported(); }
export async function connectUsbPrinter(_printer: SavedUsbPrinter, _baudRate?: number) { return unsupported(); }
export async function writeRaw(_data: Uint8Array) { return unsupported(); }
export async function printReceiptUsb(_printer: SavedUsbPrinter, _data: ReceiptPrintData, _baudRate: number) { return unsupported(); }
export async function printLabelUsb(_printer: SavedUsbPrinter, _settings: PrinterSettings, _data: LabelPrintData) { return unsupported(); }
export async function disconnectUsbPrinter() { return undefined; }
