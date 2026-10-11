export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default";
  priority?: "default" | "normal" | "high";
};

/** يقبل صيغ Expo الرسمية فقط قبل إرسال أي بيانات إلى خدمة الإشعارات. */
export function isExpoPushToken(value: string | null | undefined) {
  return Boolean(value && /^(Expo(nent)?PushToken)\[[A-Za-z0-9_-]+\]$/.test(value));
}

/** خدمة Expo تستقبل حتى 100 رسالة في الطلب الواحد. */
export function chunkPushMessages<T>(items: T[], size = 100) {
  if (!Number.isInteger(size) || size < 1) throw new Error("حجم دفعة الإشعارات غير صالح.");
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}
