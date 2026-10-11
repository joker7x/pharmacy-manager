import { useLatestPriceFeed } from "@/hooks/use-latest-price-feed";

/**
 * يبقى متصلًا بجذر التطبيق ويستخدم refetchInterval داخل الخطاف لفحص التغييرات
 * كل 30 دقيقة أثناء تشغيل التطبيق. لا يرسم أي واجهة ولا يعمل عند إغلاق التطبيق.
 */
export function LatestPriceBackgroundSync() {
  useLatestPriceFeed(0, true);
  return null;
}
