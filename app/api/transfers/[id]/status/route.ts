import { bearer, handle, json, uuid } from "@/lib/server/http";
import { transferStatus } from "@/lib/server/transfers";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () =>
    json(
      await transferStatus(uuid((await context.params).id), bearer(request)),
    ),
  );
}
