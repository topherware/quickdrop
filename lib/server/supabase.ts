import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";
export function database() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (url, init) =>
          fetch(url, {
            ...init,
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
          }),
      },
    },
  );
}
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await database().rpc(name, args);
  if (error) {
    if (error.code === "23505") throw new Error("QD_COLLISION");
    const known = error.message.match(/QD_[A-Z_]+/);
    throw new Error(known?.[0] ?? "QD_PROVIDER");
  }
  return data as T;
}
