import "server-only";
import { z } from "zod";
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_ORIGIN: z.url(),
  CODE_HMAC_SECRET: z.string().min(32),
  RATE_LIMIT_HMAC_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine(
      (v) =>
        /^[A-Za-z0-9+/]{43}=$/.test(v) &&
        Buffer.from(v, "base64").length === 32,
    ),
  CLEANUP_SECRET: z.string().min(32).max(256),
  USAGE_PERIOD_START: z.iso.datetime({ offset: true }),
  TRUSTED_PROXY: z.enum(["local", "vercel"]).default("local"),
});
export function getEnv() {
  const env = envSchema.safeParse(process.env);
  if (!env.success) throw new Error("QD_SETUP");
  const origin = new URL(env.data.APP_ORIGIN);
  if (
    origin.origin !== env.data.APP_ORIGIN ||
    (origin.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(origin.hostname))
  )
    throw new Error("QD_SETUP");
  if (process.env.VERCEL && env.data.TRUSTED_PROXY !== "vercel")
    throw new Error("QD_SETUP");
  return env.data;
}
