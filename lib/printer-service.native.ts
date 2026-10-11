import { NativeModules } from "react-native";
import { getList } from "react-native-printer-usb";

import type { LabelPrintData, PrinterSettings, ReceiptPrintData, SavedUsbPrinter } from "./printer-types";
import { buildEscPosLabel, buildEscPosReceipt } from "./printer-commands";

type NativeUsbDevice = { deviceName: string; deviceId: number; vendorId: number; productId: number; manufacturerName?: string; productName?: string };

export async function listUsbPrinters(): Promise<SavedUsbPrinter[]> {
  const devices = (getList() ?? []) as NativeUsbDevice[];
  return devices.map((device) => ({ deviceName: device.productName || device.deviceName || "USB Printer", deviceId: device.deviceId, vendorId: device.vendorId, productId: device.productId }));
}

export async function requestUsbPermission(printer: SavedUsbPrinter) {
  const nativePrinter = NativeModules.UsbPrinter as { sendRawData: (base64: string, productId: number) => Promise<{ success: boolean; message?: string }> } | undefined;
  if (!nativePrinter) throw new Error("وحدة USB printer غير موجودة. أعد بناء Android Dev Client.");
  const result = await nativePrinter.sendRawData("", printer.productId);
  return result.success;
}

export async function connectUsbPrinter(printer: SavedUsbPrinter) { return printer; }

function toBase64(data: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < data.length; index += 3) {
    const a = data[index];
    const b = data[index + 1];
    const c = data[index + 2];
    output += alphabet[a >> 2];
    output += alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)];
    output += b === undefined ? "=" : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)];
    output += c === undefined ? "=" : alphabet[c & 63];
  }
  return output;
}

export async function writeRaw(printer: SavedUsbPrinter, data: Uint8Array) {
  if (printer.productId === undefined) throw new Error("معرف USB للطابعة غير متاح.");
  const nativePrinter = NativeModules.UsbPrinter as { sendRawData: (base64: string, productId: number) => Promise<{ success: boolean; message?: string }> } | undefined;
  if (!nativePrinter) throw new Error("وحدة USB printer غير موجودة. أعد بناء Android Dev Client.");
  const result = await nativePrinter.sendRawData(toBase64(data), printer.productId);
  if (!result.success) throw new Error(result.message || "رفضت الطابعة البيانات الخام.");
  return result;
}

export async function printReceiptUsb(printer: SavedUsbPrinter, data: ReceiptPrintData, _baudRate: number) {
  await connectUsbPrinter(printer);
  return writeRaw(printer, buildEscPosReceipt(data));
}

export async function printLabelUsb(printer: SavedUsbPrinter, settings: PrinterSettings, data: LabelPrintData) {
  await connectUsbPrinter(printer);
  return writeRaw(printer, buildEscPosLabel(settings, data));
}

export async function disconnectUsbPrinter() { return undefined; }
export const isUsbPrintingAvailable = true;
