import { z } from "zod";
import { normalizeCode } from "@/lib/shared/validation";
import {
  body,
  checkOrigin,
  handle,
  json,
  rateLimit,
  ApiError,
} from "@/lib/server/http";
import { receiveTransfer } from "@/lib/server/transfers";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    checkOrigin(request);
    await rateLimit(request, "lookup");
    const { code } = await body(
      request,
      z.object({ code: z.string().max(32) }).strict(),
    );
    const normalized = normalizeCode(code);
    if (!/^\d{8}$/.test(normalized))
      throw new ApiError(400, "CODE_FORMAT", "Masukkan kode 8 digit.");
    return json(await receiveTransfer("code", normalized));
  });
}
