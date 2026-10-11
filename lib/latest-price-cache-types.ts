export const LATEST_PRICE_CACHE_LIMIT = 1000;

export type LatestPriceItem = {
  externalId: string;
  name: string;
  arabicName: string;
  currentPrice: string | number;
  previousPrice: string | number | null;
  soldTimes: number;
  activeIngredient: string | null;
  category: string | null;
  company: string | null;
  barcode: string | null;
  sourceUpdatedAt: number;
};

export type LatestPriceCache = {
  version: 1;
  items: LatestPriceItem[];
  nextOffset: number;
  hasMore: boolean;
  syncedAt: number;
};

export function mergeLatestPriceItems(incoming: LatestPriceItem[], cached: LatestPriceItem[], limit = LATEST_PRICE_CACHE_LIMIT) {
  const seen = new Set<string>();
  const merged: LatestPriceItem[] = [];
  for (const item of [...incoming, ...cached]) {
    if (seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}
