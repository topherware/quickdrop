import { describe, it, expect } from "vitest";
import { isAuthorized } from "@/supabase/functions/cleanup-transfers/auth";
describe("cleanup worker shared-secret gate", () => {
  const secret = "fixture-secret-" + "a".repeat(32);
  it("accepts only authenticated POST", async () => {
    expect(
      await isAuthorized(
        new Request("https://fixture.invalid", {
          method: "POST",
          headers: { "x-cleanup-secret": secret },
        }),
        secret,
      ),
    ).toBe(true);
  });
  it("denies missing, incorrect, oversized and GET requests", async () => {
    for (const candidate of [
      undefined,
      "wrong-secret-" + "a".repeat(32),
      "a".repeat(257),
    ])
      expect(
        await isAuthorized(
          new Request("https://fixture.invalid", {
            method: "POST",
            headers: candidate ? { "x-cleanup-secret": candidate } : {},
          }),
          secret,
        ),
      ).toBe(false);
    expect(
      await isAuthorized(
        new Request("https://fixture.invalid", {
          headers: { "x-cleanup-secret": secret },
        }),
        secret,
      ),
    ).toBe(false);
    expect(
      await isAuthorized(
        new Request("https://fixture.invalid", {
          method: "POST",
          headers: { "x-cleanup-secret": "short" },
        }),
        "short",
      ),
    ).toBe(false);
  });
});
