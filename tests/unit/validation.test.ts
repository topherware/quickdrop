import { describe, expect, it } from "vitest";
import {
  normalizeFiles,
  normalizeCode,
  sanitizeName,
} from "@/lib/shared/validation";
describe("file validation", () => {
  const file = { name: "foto.jpg", size: 100, mime: "image/jpeg" };
  it("keeps leading zero and strips pasted whitespace", () =>
    expect(normalizeCode("0012 3456\n")).toBe("00123456"));
  it("rejects zero bytes, oversize, sixth file, total overflow", () => {
    for (const batch of [
      [{ ...file, size: 0 }],
      [{ ...file, size: 25_000_001 }],
      Array(6).fill(file),
      Array(3).fill({ ...file, size: 20_000_000 }),
    ])
      expect(() => normalizeFiles(batch)).toThrow();
  });
  it("normalizes empty/octet-stream MIME for Office and HEIC", () => {
    expect(
      normalizeFiles([{ name: "foto.heic", size: 42, mime: "" }])[0].mime,
    ).toBe("image/heic");
    expect(
      normalizeFiles([
        { name: "doc.docx", size: 42, mime: "application/octet-stream" },
      ])[0].mime,
    ).toContain("wordprocessingml");
  });
  it("rejects active content and mismatched MIME", () => {
    for (const name of ["x.html", "x.svg", "x.exe", "x.js"])
      expect(() => normalizeFiles([{ ...file, name }])).toThrow(
        "UNSUPPORTED_TYPE",
      );
    expect(() => normalizeFiles([{ ...file, mime: "text/html" }])).toThrow(
      "UNSUPPORTED_TYPE",
    );
  });
  it("sanitizes path, controls, bidi and preserves long extension", () => {
    expect(sanitizeName("../a\\b\u0000\u202e.txt")).toBe("..ab.txt");
    const name = sanitizeName("a".repeat(300) + ".docx");
    expect(name.length).toBe(180);
    expect(name.endsWith(".docx")).toBe(true);
  });
  it("accepts exactly the byte limits", () =>
    expect(
      normalizeFiles([
        { ...file, size: 25_000_000 },
        { ...file, size: 25_000_000 },
      ]),
    ).toHaveLength(2));
});
