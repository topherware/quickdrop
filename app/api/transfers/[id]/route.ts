import { bearer, checkOrigin, handle, json, uuid } from "@/lib/server/http";
import { revokeTransfer } from "@/lib/server/transfers";
export const runtime = "nodejs";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    checkOrigin(request);
    await revokeTransfer(uuid((await context.params).id), bearer(request));
    return json({ status: "revoked" }, 202);
  });
}
