import { z } from "zod";
import {
  bearer,
  body,
  checkOrigin,
  handle,
  idempotencyKey,
  json,
  uuid,
} from "@/lib/server/http";
import { completeTransfer } from "@/lib/server/transfers";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    checkOrigin(request);
    await body(request, z.object({}).strict());
    return json(
      await completeTransfer(
        uuid((await context.params).id),
        bearer(request),
        idempotencyKey(request),
      ),
    );
  });
}
