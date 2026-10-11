import AsyncStorage from "@react-native-async-storage/async-storage";
import { openDatabaseAsync } from "expo-sqlite";

const STORAGE_KEY = "saydalty-local-data-v1";
const SQLITE_DB_NAME = "saydalty.db";
type LocalDatabase = { execAsync: (source: string) => Promise<void>; getFirstAsync: <T>(source: string) => Promise<T | null>; runAsync: (source: string, ...params: unknown[]) => Promise<unknown>; closeAsync: () => Promise<void> };

export type LocalStorage = { get: () => Promise<string | null>; set: (payload: string) => Promise<void>; close: () => Promise<void> };

export async function createLocalStorage(): Promise<LocalStorage> {
  const database = (await openDatabaseAsync(SQLITE_DB_NAME)) as unknown as LocalDatabase;
  await database.execAsync("PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);");
  const row = await database.getFirstAsync<{ payload: string }>("SELECT payload FROM app_state WHERE id = 1");
  if (!row) {
    const legacy = await AsyncStorage.getItem(STORAGE_KEY);
    if (legacy) await database.runAsync("INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?)", legacy, new Date().toISOString());
  }
  return {
    get: async () => (row?.payload ?? await AsyncStorage.getItem(STORAGE_KEY)),
    set: (payload) => database.runAsync("INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at", payload, new Date().toISOString()).then(() => undefined),
    close: () => database.closeAsync(),
  };
}
