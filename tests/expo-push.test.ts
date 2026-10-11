import { describe, expect, it } from "vitest";
import { chunkPushMessages, isExpoPushToken } from "../lib/expo-push";

describe("Expo Push helpers", () => {
  it("يقبل رموز Expo فقط", () => {
    expect(isExpoPushToken("ExponentPushToken[AbC_123-xYz]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[another_token]")).toBe(true);
    expect(isExpoPushToken("fcm-token")).toBe(false);
    expect(isExpoPushToken("")).toBe(false);
  });

  it("يقسم الإرسال إلى دفعات مائة رسالة", () => {
    const batches = chunkPushMessages(Array.from({ length: 201 }, (_, index) => index));
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 1]);
  });
});
