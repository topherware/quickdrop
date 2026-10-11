export const LIMITS = {
  maxFiles: 5,
  maxFileBytes: 25_000_000,
  maxTotalBytes: 50_000_000,
  uploadMinutes: 15,
  readyMinutes: 30,
  maxDownloadGrants: 10,
} as const;
export const BUCKET = "transfers";
export const MIME_TYPES: Record<string, readonly string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  heic: ["image/heic", "image/heic-sequence"],
  heif: ["image/heif", "image/heif-sequence"],
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  csv: ["text/csv", "text/plain", "application/vnd.ms-excel"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ],
  zip: ["application/zip", "application/x-zip-compressed"],
  mp4: ["video/mp4"],
  mov: ["video/quicktime"],
};
export const ACCEPT = Object.keys(MIME_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");
export function formatBytes(bytes: number, locale = "id-ID") {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`
    : bytes >= 1000
      ? `${(bytes / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} KB`
      : `${bytes} B`;
}
