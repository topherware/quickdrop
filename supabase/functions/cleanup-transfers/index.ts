import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { isAuthorized } from "./auth.ts";
Deno.serve(async (request: Request) => {
  const secret = Deno.env.get("CLEANUP_SECRET");
  if (!secret || secret.length < 32 || secret.length > 256)
    return new Response("Unavailable", { status: 503 });
  if (!(await isAuthorized(request, secret)))
    return new Response("Unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return new Response("Unavailable", { status: 503 });
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, init) =>
        fetch(url, { ...init, signal: AbortSignal.timeout(8000) }),
    },
  });
  const lease = crypto.randomUUID();
  const { data, error } = await db.rpc("qd_cleanup_claim", { p_lease: lease });
  if (error) return Response.json({ error: "CLAIM_FAILED" }, { status: 503 });
  let swept = 0,
    failed = 0;
  const start = Date.now();
  for (const transfer of data ?? []) {
    if (Date.now() - start > 50_000) break; // Remaining claims expire and are retried.
    try {
      const { error: removeError } = await db.storage
        .from("transfers")
        .remove(transfer.paths ?? []);
      if (removeError) throw new Error("STORAGE_DELETE_FAILED");
      // Final release requires an actual absence check through Storage API.
      const { data: remaining, error: listError } = await db.storage
        .from("transfers")
        .list(transfer.id, { limit: 100 });
      if (listError || remaining?.some((f) => f.id))
        throw new Error("STORAGE_NOT_EMPTY");
      const { error: finishError } = await db.rpc("qd_cleanup_finish", {
        p_id: transfer.id,
        p_lease: lease,
        p_success: true,
        p_error: null,
      });
      if (finishError) throw new Error("FINISH_FAILED");
      swept++;
    } catch {
      failed++;
      await db.rpc("qd_cleanup_finish", {
        p_id: transfer.id,
        p_lease: lease,
        p_success: false,
        p_error: "STORAGE_DELETE_FAILED",
      });
    }
  }
  const { error: heartbeatError } = await db.rpc("qd_cleanup_heartbeat");
  return Response.json(
    { claimed: data?.length ?? 0, swept, failed },
    {
      status: failed || heartbeatError ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
});
