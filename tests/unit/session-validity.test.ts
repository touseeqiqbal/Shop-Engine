import { describe, expect, it } from "vitest";
import { sessionStillValid } from "@/lib/session-validity";

describe("shop sessions after a password reset", () => {
  const reset = "2026-10-18T10:00:00.000Z";
  const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  it("a sign-in from before the reset is over – however often its token was renewed since", () => {
    expect(sessionStillValid(at("2026-10-18T09:59:00Z"), reset)).toBe(false);
  });
  it("signing in again after the reset works (also within the same second)", () => {
    expect(sessionStillValid(at("2026-10-18T10:00:00.400Z"), reset)).toBe(true);
    expect(sessionStillValid(at("2026-10-18T10:05:00Z"), reset)).toBe(true);
  });
  it("tokens from before the sign-in time was recorded count as old once a reset happened", () => {
    expect(sessionStillValid(undefined, reset)).toBe(false);
    expect(sessionStillValid(0, reset)).toBe(false);
  });
  it("an account that never reset its password keeps every session", () => {
    expect(sessionStillValid(undefined, null)).toBe(true);
    expect(sessionStillValid(at("2020-01-01T00:00:00Z"), undefined)).toBe(true);
  });
});
