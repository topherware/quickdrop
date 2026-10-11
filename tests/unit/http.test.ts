import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { bearer, body, idempotencyKey } from "@/lib/server/http";
describe("metadata-only API boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("stops streamed metadata at 16 KB before parsing", async () => {
    const request = new Request("https://fixture.invalid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ large: "a".repeat(20_000) }),
    });
    await expect(
      body(request, z.object({ large: z.string() })),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects multipart payload instead of proxying file bytes", async () => {
    const form = new FormData();
    form.append("file", new Blob(["fixture"]));
    await expect(
      body(
        new Request("https://fixture.invalid", { method: "POST", body: form }),
        z.object({}),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("requires exact owner/receive token shape and random idempotency key", () => {
    expect(() => bearer(new Request("https://fixture.invalid"))).toThrow(
      "QD_AUTH",
    );
    expect(
      bearer(
        new Request("https://fixture.invalid", {
          headers: { Authorization: `Bearer ${"a".repeat(43)}` },
        }),
      ),
    ).toBe("a".repeat(43));
    expect(() =>
      idempotencyKey(
        new Request("https://fixture.invalid", {
          headers: { "Idempotency-Key": "1234" },
        }),
      ),
    ).toThrow();
    expect(
      idempotencyKey(
        new Request("https://fixture.invalid", {
          headers: {
            "Idempotency-Key": "0d66a416-125b-442c-8404-7fe229397b66",
          },
        }),
      ),
    ).toBe("0d66a416-125b-442c-8404-7fe229397b66");
  });
});
