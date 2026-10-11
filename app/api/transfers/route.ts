import { z } from "zod";
import {
  body,
  checkOrigin,
  handle,
  idempotencyKey,
  json,
  rateLimit,
} from "@/lib/server/http";
import { initTransfer } from "@/lib/server/transfers";
export const runtime = "nodejs";
const schema = z
  .object({
    files: z
      .array(
        z
          .object({
            name: z.string().min(1).max(512),
            size: z.number().int(),
            mime: z.string().max(180),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();
export async function POST(request: Request) {
  return handle(async () => {
    checkOrigin(request);
    await rateLimit(request, "init");
    const data = await body(request, schema);
    return json(await initTransfer(data.files, idempotencyKey(request)), 201);
  });
}
