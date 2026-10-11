import { z } from "zod";
import {
  bearer,
  body,
  checkOrigin,
  handle,
  idempotencyKey,
  json,
  rateLimit,
  uuid,
} from "@/lib/server/http";
import { downloadFile } from "@/lib/server/transfers";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    checkOrigin(request);
    await rateLimit(request, "download");
    await body(request, z.object({}).strict());
    return json(
      await downloadFile(
        uuid((await context.params).id),
        bearer(request),
        idempotencyKey(request),
      ),
    );
  });
}
