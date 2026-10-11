import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decrypt,
  digest,
  encrypt,
  keyedDigest,
  newCode,
  newToken,
} from "@/lib/server/tokens";
describe("capability secrets", () => {
  it("uses independent 256-bit tokens and eight-digit codes", () => {
    expect(newToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(newToken());
    expect(newCode()).toMatch(/^\d{8}$/);
  });
  it("authenticates encrypted replay envelopes with unique nonce", () => {
    const key = randomBytes(32).toString("base64");
    const a = encrypt({ owner: "secret" }, key);
    expect(decrypt(a, key)).toEqual({ owner: "secret" });
    expect(encrypt({ owner: "secret" }, key)).not.toBe(a);
    const corrupt = Buffer.from(a, "base64");
    corrupt[corrupt.length - 1] ^= 1;
    expect(() => decrypt(corrupt.toString("base64"), key)).toThrow();
  });
  it("separates keyed code digest from token digest", () => {
    expect(keyedDigest("00123456", "a")).not.toBe(keyedDigest("00123456", "b"));
    expect(digest("x")).toHaveLength(64);
  });
});
