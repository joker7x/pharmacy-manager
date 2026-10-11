import { useCallback, useEffect, useRef, useState } from "react";

import { loadLatestPriceCache, saveLatestPriceCache } from "@/lib/latest-price-cache";
import { LATEST_PRICE_CACHE_LIMIT, mergeLatestPriceItems, type LatestPriceCache, type LatestPriceItem } from "@/lib/latest-price-cache-types";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 100;
const INITIAL_PAGE_COUNT = LATEST_PRICE_CACHE_LIMIT / PAGE_SIZE;
const HALF_HOUR_MS = 30 * 60 * 1000;

export function useLatestPriceFeed(page: number, enabled: boolean) {
  const [cache, setCache] = useState<LatestPriceCache | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [fillOffset, setFillOffset] = useState<number | null>(null);
  const initialMergeRef = useRef(0);
  const fillMergeRef = useRef(0);
  const headMergeRef = useRef(0);

  useEffect(() => {
    let active = true;
    loadLatestPriceCache().then((saved) => {
      if (!active) return;
      setCache(saved);
      setHydrated(true);
      if (saved && saved.items.length < LATEST_PRICE_CACHE_LIMIT && saved.hasMore) setFillOffset(saved.nextOffset);
    });
    return () => { active = false; };
  }, []);

  // أول 100 صنف فقط؛ تفتح الشاشة بمجرد وصول هذه الدفعة.
  const initialQuery = trpc.catalog.latestFeed.useQuery(
    { offset: 0, pages: 1 },
    { enabled: enabled && hydrated && !cache, staleTime: HALF_HOUR_MS, refetchOnMount: false },
  );
  // الصفحات 2 إلى 10 تُملأ بالتتابع في الخلفية، فلا تحجب أول عرض.
  const fillQuery = trpc.catalog.latestFeed.useQuery(
    { offset: fillOffset ?? 0, pages: 1 },
    { enabled: enabled && hydrated && fillOffset !== null, staleTime: HALF_HOUR_MS, refetchOnMount: false },
  );
  // فحص خفيف لأول 100 صنف كل 30 دقيقة ما دام التطبيق مفتوحًا.
  const headQuery = trpc.catalog.latestFeed.useQuery(
    { offset: 0, pages: 1 },
    {
      enabled: enabled && hydrated && Boolean(cache),
      staleTime: HALF_HOUR_MS,
      refetchOnMount: "always",
      refetchInterval: HALF_HOUR_MS,
      refetchIntervalInBackground: false,
    },
  );
  const overflowQuery = trpc.catalog.latestFeed.useQuery(
    { offset: Math.max(LATEST_PRICE_CACHE_LIMIT, page * PAGE_SIZE), pages: 1 },
    { enabled: enabled && hydrated && page >= INITIAL_PAGE_COUNT, staleTime: HALF_HOUR_MS, refetchOnMount: false },
  );

  useEffect(() => {
    if (!initialQuery.data || initialQuery.dataUpdatedAt === initialMergeRef.current) return;
    initialMergeRef.current = initialQuery.dataUpdatedAt;
    const next: LatestPriceCache = {
      version: 1,
      items: initialQuery.data.items as LatestPriceItem[],
      nextOffset: initialQuery.data.nextOffset,
      hasMore: initialQuery.data.hasMore,
      syncedAt: Date.now(),
    };
    setCache(next);
    void saveLatestPriceCache(next);
    if (next.items.length < LATEST_PRICE_CACHE_LIMIT && next.hasMore) setFillOffset(next.nextOffset);
  }, [initialQuery.data, initialQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!cache || !fillQuery.data || fillQuery.dataUpdatedAt === fillMergeRef.current) return;
    fillMergeRef.current = fillQuery.dataUpdatedAt;
    const next: LatestPriceCache = {
      ...cache,
      items: mergeLatestPriceItems(cache.items, fillQuery.data.items as LatestPriceItem[]),
      nextOffset: fillQuery.data.nextOffset,
      hasMore: fillQuery.data.hasMore,
      syncedAt: Date.now(),
    };
    setCache(next);
    void saveLatestPriceCache(next);
    setFillOffset(next.items.length < LATEST_PRICE_CACHE_LIMIT && next.hasMore ? next.nextOffset : null);
  }, [cache, fillQuery.data, fillQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!cache || !headQuery.data || headQuery.dataUpdatedAt === headMergeRef.current) return;
    headMergeRef.current = headQuery.dataUpdatedAt;
    const next: LatestPriceCache = {
      ...cache,
      items: mergeLatestPriceItems(headQuery.data.items as LatestPriceItem[], cache.items),
      syncedAt: Date.now(),
    };
    setCache(next);
    void saveLatestPriceCache(next);
  }, [cache, headQuery.data, headQuery.dataUpdatedAt]);

  const cachedItems = cache?.items ?? [];
  const cachedPages = Math.ceil(cachedItems.length / PAGE_SIZE);
  const isCachedPage = page < cachedPages;
  const pageItems = isCachedPage
    ? cachedItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : (overflowQuery.data?.items ?? []) as LatestPriceItem[];
  const isFilling = fillOffset !== null || fillQuery.isFetching;
  const hasNext = isCachedPage && page < cachedPages - 1
    ? true
    : isCachedPage
      ? !isFilling && Boolean(cache?.hasMore)
      : Boolean(overflowQuery.data?.hasMore);

  const refresh = useCallback(async () => {
    if (!cache) return initialQuery.refetch();
    return headQuery.refetch();
  }, [cache, headQuery, initialQuery]);

  return {
    items: pageItems,
    cacheCount: cachedItems.length,
    hasNext,
    isReady: hydrated,
    isFetching: !hydrated || initialQuery.isFetching || overflowQuery.isFetching,
    isUpdatingInBackground: isFilling || headQuery.isFetching,
    refresh,
    lastSyncedAt: cache?.syncedAt ?? null,
  };
}
