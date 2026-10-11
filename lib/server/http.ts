import "server-only";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { getEnv } from "./env";
import { keyedDigest } from "./tokens";
import { rpc } from "./supabase";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
const ERRORS: Record<string, [number, string]> = {
  QD_SETUP: [
    503,
    "Layanan belum dikonfigurasi. Lengkapi environment Supabase pada server.",
  ],
  QD_PROVIDER: [503, "Layanan sedang sulit dihubungi. Coba lagi."],
  QD_AUTH: [401, "Sesi tidak valid. Buka transfer kembali."],
  QD_UNAVAILABLE: [404, "Kode tidak valid atau transfer sudah berakhir."],
  QD_IDEMPOTENCY: [409, "Permintaan ini berbeda dari percobaan sebelumnya."],
  QD_PENDING: [
    409,
    "Permintaan sebelumnya masih diproses. Coba lagi beberapa detik lagi.",
  ],
  QD_CAPACITY: [503, "Penyimpanan sementara sedang penuh. Coba lagi nanti."],
  QD_CLEANUP_STALE: [
    503,
    "Penyimpanan sementara sedang dirawat. Coba lagi nanti.",
  ],
  QD_PERIOD: [
    503,
    "Periode pemakaian server belum dikonfigurasi dengan benar.",
  ],
  QD_LOOKUP_DISABLED: [503, "Penerimaan sedang dibatasi. Coba lagi nanti."],
  QD_MISMATCH: [409, "Ukuran file tidak sesuai. Transfer dibatalkan."],
  QD_INPUT: [400, "Data transfer tidak valid."],
  QD_GRANT_LIMIT: [429, "Batas tautan unduh file ini sudah tercapai."],
  QD_GRANT_EXPIRED: [
    409,
    "Tautan unduh kedaluwarsa. Tekan Unduh untuk meminta tautan baru.",
  ],
};
export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    const requestId = randomUUID();
    const mapped = error instanceof Error ? ERRORS[error.message] : undefined;
    const fault =
      error instanceof ApiError
        ? error
        : new ApiError(
            mapped?.[0] ?? 503,
            mapped ? (error as Error).message : "QD_PROVIDER",
            mapped?.[1] ?? "Layanan sedang sulit dihubungi. Coba lagi.",
          );
    // No tokens, filenames, paths, request bodies or provider error strings in logs.
    console.warn(
      JSON.stringify({ requestId, status: fault.status, code: fault.code }),
    );
    return Response.json(
      {
        error: {
          code: fault.code,
          message: fault.message,
          ...(fault.retryAfterSeconds
            ? { retryAfterSeconds: fault.retryAfterSeconds }
            : {}),
        },
        requestId,
      },
      {
        status: fault.status,
        headers: {
          "Cache-Control": "no-store",
          ...(fault.retryAfterSeconds
            ? { "Retry-After": String(fault.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== getEnv().APP_ORIGIN)
    throw new ApiError(403, "ORIGIN", "Origin permintaan tidak diizinkan.");
}
export async function body<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(400, "INPUT", "Gunakan JSON untuk metadata.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INPUT", "Data tidak valid.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 16_384) {
      await reader.cancel();
      throw new ApiError(413, "METADATA_LIMIT", "Metadata terlalu besar.");
    }
    chunks.push(chunk.value);
  }
  let data: unknown;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INPUT", "Data tidak valid.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new ApiError(
      400,
      "INPUT",
      "Data tidak valid. Periksa batas file dan kode.",
    );
  return parsed.data;
}
export function bearer(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) throw new Error("QD_AUTH");
  return token;
}
export function idempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key");
  if (
    !key ||
    !/^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9_-]{32,64})$/i.test(
      key,
    )
  )
    throw new ApiError(400, "IDEMPOTENCY", "Idempotency-Key acak diperlukan.");
  return key;
}
export function uuid(value: string) {
  if (!z.uuid().safeParse(value).success)
    throw new ApiError(400, "INPUT", "ID tidak valid.");
  return value;
}
export async function rateLimit(
  request: Request,
  scope: "init" | "lookup" | "download",
) {
  const env = getEnv();
  // Never trust arbitrary x-forwarded-for. Vercel replaces its dedicated header.
  const forwarded = request.headers
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    .trim();
  const ip =
    env.TRUSTED_PROXY === "vercel" && forwarded && isIP(forwarded)
      ? forwarded
      : "local-shared";
  const limit = { init: 5, lookup: 10, download: 30 }[scope];
  const result = await rpc<{ allowed: boolean; retryAfterSeconds: number }>(
    "qd_rate_limit",
    {
      p_scope: scope,
      p_identifier: keyedDigest(ip, env.RATE_LIMIT_HMAC_SECRET),
      p_limit: limit,
    },
  );
  if (!result.allowed)
    throw new ApiError(
      429,
      "RATE_LIMIT",
      `Terlalu banyak percobaan. Coba lagi dalam ${result.retryAfterSeconds} detik.`,
      result.retryAfterSeconds,
    );
  const global = await rpc<{ allowed: boolean; retryAfterSeconds: number }>(
    "qd_rate_limit",
    {
      p_scope: `global:${scope}`,
      p_identifier: keyedDigest("global", env.RATE_LIMIT_HMAC_SECRET),
      p_limit: scope === "download" ? 1000 : 300,
    },
  );
  if (!global.allowed)
    throw new ApiError(
      429,
      "RATE_LIMIT",
      `Layanan sedang ramai. Coba lagi dalam ${global.retryAfterSeconds} detik.`,
      global.retryAfterSeconds,
    );
}
