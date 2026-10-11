import { describe, expect, it } from "vitest";

import { isProfileActive } from "../server/staff-service";

describe("automatic staff freeze expiry", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  it("blocks a frozen account until its configured time", () => {
    expect(isProfileActive({ status: "frozen", frozenUntil: new Date("2026-08-27T13:00:00.000Z") }, now)).toBe(false);
  });

  it("allows the account once its freeze time has passed", () => {
    expect(isProfileActive({ status: "frozen", frozenUntil: new Date("2026-08-27T11:59:59.000Z") }, now)).toBe(true);
  });

  it("keeps disabled accounts blocked even when a former freeze date has passed", () => {
    expect(isProfileActive({ status: "disabled", frozenUntil: new Date("2026-08-27T11:00:00.000Z") }, now)).toBe(false);
  });
});
