import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from "node:crypto";
export const newToken = () => randomBytes(32).toString("base64url");
export const newCode = () =>
  randomInt(0, 100_000_000).toString().padStart(8, "0");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const keyedDigest = (value: string, key: string) =>
  createHmac("sha256", key).update(value).digest("hex");
export function encrypt(value: unknown, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function decrypt<T>(value: string, key: string): T {
  const data = Buffer.from(value, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "base64"),
    data.subarray(0, 12),
  );
  cipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  ) as T;
}
