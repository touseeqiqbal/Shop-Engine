import { describe, expect, it } from "vitest";
import { canonicalPath } from "@/lib/canonical-path";

describe("the proxy matches paths as the router sees them (sign-in limits can't be skipped)", () => {
  it("an encoded, doubled, trailing-slash or upper-case sign-in path is the sign-in path", () => {
    for (const p of ["/cms-api/users/%6Cogin", "/cms-api/users/%256Cogin", "/cms-api//users/login/", "/CMS-API/Users/Login", "/%63ms-api/users/login", "/cms-api\\users\\login"]) expect(canonicalPath(p), p).toBe("/cms-api/users/login");
  });
  it("leaves ordinary paths alone and survives bad encoding", () => {
    expect(canonicalPath("/")).toBe("/");
    expect(canonicalPath("/shop")).toBe("/shop");
    expect(canonicalPath("/bad%zzpath")).toBe("/bad%zzpath");
  });
});
