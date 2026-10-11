import { useCallback, useEffect, useRef, useState } from "react";

import { searchOfflineCatalog, type OfflineCatalogItem } from "@/lib/offline-catalog";

export type CatalogSearchData = { items: OfflineCatalogItem[]; total: number };

/**
 * بحث الدليل داخل الجهاز نفسه: بدون شبكة وبدون سيرفر.
 * يعيد نفس شكل استعلام tRPC حتى تستبدل الشاشات المصدر دون تغيير منطقها.
 */
export function useCatalogSearch(
  query: string,
  options: { limit?: number; offset?: number; enabled?: boolean } = {},
) {
  const { limit = 24, offset = 0, enabled = true } = options;
  const term = query.trim();
  const active = enabled && term.length >= 2;
  const [data, setData] = useState<CatalogSearchData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(active);
  const [isError, setIsError] = useState(false);
  const token = useRef(0);

  const run = useCallback(() => {
    const current = ++token.current;
    if (!active) {
      setData(undefined);
      setIsLoading(false);
      setIsError(false);
      return;
    }
    setIsLoading(true);
    setIsError(false);
    void searchOfflineCatalog(term, offset + limit)
      .then((found) => {
        if (token.current !== current) return;
        setData({ items: found.slice(offset, offset + limit), total: found.length });
        setIsLoading(false);
      })
      .catch(() => {
        if (token.current !== current) return;
        setIsError(true);
        setIsLoading(false);
      });
  }, [active, limit, offset, term]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, isLoading, isFetching: isLoading, isError, error: null, refetch: run };
}
