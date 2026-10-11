import { LIMITS } from "@/lib/shared/config";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET() {
  return json({ ...LIMITS, serverTime: new Date().toISOString() });
}
