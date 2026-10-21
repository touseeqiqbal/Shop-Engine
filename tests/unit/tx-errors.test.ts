import { describe, expect, it } from "vitest";
import { isDatabaseError, rethrowIfAborted } from "@/payload/tx-errors";

describe("database errors inside a transaction aren't swallowed", () => {
  const pgError = Object.assign(new Error('duplicate key value violates unique constraint "x"'), { code: "23505" });
  it("knows a Postgres error, also when wrapped", () => {
    expect(isDatabaseError(pgError)).toBe(true);
    expect(isDatabaseError(new Error("save failed", { cause: pgError }))).toBe(true);
    expect(isDatabaseError(new Error("no template for this message"))).toBe(false);
    expect(isDatabaseError(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }))).toBe(false);
  });
  it("rethrows only a database error inside an open transaction", () => {
    expect(() => rethrowIfAborted(pgError, { transactionID: 1 })).toThrow(/duplicate key/);
    expect(() => rethrowIfAborted(pgError, {})).not.toThrow();
    expect(() => rethrowIfAborted(pgError, null)).not.toThrow();
    expect(() => rethrowIfAborted(new Error("no email provider"), { transactionID: 1 })).not.toThrow();
  });
});
