import { openDatabaseAsync } from "expo-sqlite";
import type { LatestPriceCache } from "./latest-price-cache-types";

const DATABASE_NAME = "saydalty.db";

type LocalDatabase = {
  execAsync: (source: string) => Promise<void>;
  getFirstAsync: <T>(source: string) => Promise<T | null>;
  runAsync: (source: string, ...params: unknown[]) => Promise<unknown>;
  closeAsync: () => Promise<void>;
};

async function withCacheDatabase<T>(work: (database: LocalDatabase) => Promise<T>) {
  const database = (await openDatabaseAsync(DATABASE_NAME)) as unknown as LocalDatabase;
  try {
    await database.execAsync("CREATE TABLE IF NOT EXISTS latest_price_cache (id INTEGER PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);");
    return await work(database);
  } finally {
    await database.closeAsync();
  }
}

export async function loadLatestPriceCache(): Promise<LatestPriceCache | null> {
  try {
    return await withCacheDatabase(async (database) => {
      const row = await database.getFirstAsync<{ payload: string }>("SELECT payload FROM latest_price_cache WHERE id = 1");
      if (!row?.payload) return null;
      const parsed = JSON.parse(row.payload) as LatestPriceCache;
      return parsed?.version === 1 && Array.isArray(parsed.items) ? parsed : null;
    });
  } catch {
    return null;
  }
}

export async function saveLatestPriceCache(cache: LatestPriceCache) {
  await withCacheDatabase((database) => database.runAsync(
    "INSERT INTO latest_price_cache (id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
    JSON.stringify(cache),
    new Date().toISOString(),
  ).then(() => undefined));
}
