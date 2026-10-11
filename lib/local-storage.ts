import AsyncStorage from "@react-native-async-storage/async-storage";

export type LocalStorage = {
  get: () => Promise<string | null>;
  set: (payload: string) => Promise<void>;
  close: () => Promise<void>;
};

export async function createLocalStorage(): Promise<LocalStorage> {
  return {
    get: () => AsyncStorage.getItem("saydalty-local-data-v1"),
    set: (payload) => AsyncStorage.setItem("saydalty-local-data-v1", payload),
    close: async () => undefined,
  };
}
