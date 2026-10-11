import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LatestPriceCache } from "./latest-price-cache-types";

const CACHE_KEY = "saydalty-latest-price-cache-v1";

export async function loadLatestPriceCache(): Promise<LatestPriceCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LatestPriceCache;
    return parsed?.version === 1 && Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveLatestPriceCache(cache: LatestPriceCache) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}
