import { z } from "zod";
import { body, checkOrigin, handle, json, rateLimit } from "@/lib/server/http";
import { receiveTransfer } from "@/lib/server/transfers";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    checkOrigin(request);
    await rateLimit(request, "lookup");
    const { token } = await body(
      request,
      z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(),
    );
    return json(await receiveTransfer("share", token));
  });
}
