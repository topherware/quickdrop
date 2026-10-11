import { z } from "zod";
import { LIMITS, MIME_TYPES } from "./config";
export const fileSchema = z
  .object({
    name: z.string().min(1).max(512),
    size: z.number().int().positive().max(LIMITS.maxFileBytes),
    mime: z.string().max(180),
  })
  .strict();
export const initSchema = z
  .object({ files: z.array(fileSchema).min(1).max(LIMITS.maxFiles) })
  .strict();
export type FileMetadata = z.infer<typeof fileSchema>;
export function sanitizeName(name: string) {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim();
  const dot = cleaned.lastIndexOf(".");
  if (cleaned.length <= 180) return cleaned;
  const suffix = dot > 0 ? cleaned.slice(dot).slice(0, 12) : "";
  return cleaned.slice(0, 180 - suffix.length) + suffix;
}
export function normalizeCode(code: string) {
  return code.replace(/\s/g, "");
}
export function normalizeFiles(files: FileMetadata[]) {
  const input = initSchema.parse({ files });
  if (input.files.reduce((n, f) => n + f.size, 0) > LIMITS.maxTotalBytes)
    throw new Error("TOTAL_LIMIT");
  return input.files.map((file) => {
    const name = sanitizeName(file.name);
    const extension = name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = MIME_TYPES[extension];
    if (!name || !allowed) throw new Error("UNSUPPORTED_TYPE");
    const mime = file.mime.toLowerCase().split(";")[0].trim();
    if (mime && mime !== "application/octet-stream" && !allowed.includes(mime))
      throw new Error("UNSUPPORTED_TYPE");
    return {
      ...file,
      name,
      mime: !mime || mime === "application/octet-stream" ? allowed[0] : mime,
    };
  });
}
export function validationMessage(error: unknown) {
  if (error instanceof Error && error.message === "UNSUPPORTED_TYPE")
    return "Jenis file belum didukung. Pilih foto, dokumen, ZIP, MP4, atau MOV.";
  if (error instanceof Error && error.message === "TOTAL_LIMIT")
    return "Total file maksimal 50 MB.";
  return "Pilih 1–5 file, maksimal 25 MB per file. File kosong tidak dapat dikirim.";
}
