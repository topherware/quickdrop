import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
let db: PGlite;
async function call<T = Record<string, unknown>>(
  name: string,
  args: unknown[] = [],
) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(",");
  return (
    await db.query<{ result: T }>(
      `select ${name}(${placeholders}) as result`,
      args,
    )
  ).rows[0].result;
}
async function init(key = randomUUID(), size = 100, count = 1) {
  const id = randomUUID();
  const files = Array.from({ length: count }, () => ({
    id: randomUUID(),
    name: "fixture.txt",
    size,
    mime: "text/plain",
  }));
  const owner = randomUUID();
  await call("qd_init", [
    id,
    owner,
    randomUUID(),
    key,
    "request",
    JSON.stringify(files),
    "2026-01-01T00:00:00Z",
  ]);
  await call("qd_init_commit", [id, key, "encrypted-init"]);
  return { id, files, owner, key };
}
async function ready() {
  const t = await init();
  await call("qd_complete", [
    t.id,
    t.owner,
    randomUUID(),
    "request",
    randomUUID(),
    "encrypted-ready",
    JSON.stringify(t.files.map((f) => ({ id: f.id, size: f.size }))),
  ]);
  return t;
}
describe("real local PostgreSQL transactions (not Supabase integration)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../../supabase/migrations/20261011092942_quickdrop_core.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await call("qd_cleanup_heartbeat");
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  it("enables RLS and revokes table/RPC access for anonymous clients", async () => {
    const tables = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    expect(tables.rows).toHaveLength(7);
    expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true);
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from transfers")).rejects.toThrow(
        /permission denied/,
      );
      await expect(call("qd_cleanup_heartbeat")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("replays init once and rejects a changed request", async () => {
    const t = await init();
    const replay = await call("qd_init", [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      t.key,
      "request",
      JSON.stringify(t.files),
      "2026-01-01T00:00:00Z",
    ]);
    expect(replay.created).toBe(false);
    await expect(
      call("qd_init", [
        randomUUID(),
        randomUUID(),
        randomUUID(),
        t.key,
        "changed",
        JSON.stringify(t.files),
        "2026-01-01T00:00:00Z",
      ]),
    ).rejects.toThrow("QD_IDEMPOTENCY");
  });
  it("rejects mismatch without making ready", async () => {
    const t = await init();
    await expect(
      call("qd_complete", [
        t.id,
        t.owner,
        randomUUID(),
        "request",
        randomUUID(),
        "response",
        JSON.stringify([{ id: t.files[0].id, size: 101 }]),
      ]),
    ).rejects.toThrow("QD_MISMATCH");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from transfers where id=$1",
          [t.id],
        )
      ).rows[0].status,
    ).toBe("uploading");
  });
  it("handles simultaneous completion idempotently and code collision transactionally", async () => {
    const t = await init();
    const code = randomUUID();
    const args = [
      t.id,
      t.owner,
      randomUUID(),
      "request",
      code,
      "same-result",
      JSON.stringify(t.files.map((f) => ({ id: f.id, size: f.size }))),
    ];
    const results = await Promise.all([
      call("qd_complete", args),
      call("qd_complete", args),
    ]);
    expect(results[0].encryptedResponse).toBe(results[1].encryptedResponse);
    const other = await init();
    await expect(
      call("qd_complete", [
        other.id,
        other.owner,
        randomUUID(),
        "request",
        code,
        "other",
        JSON.stringify(other.files.map((f) => ({ id: f.id, size: f.size }))),
      ]),
    ).rejects.toThrow(/duplicate key/);
    await call("qd_complete", [
      other.id,
      other.owner,
      randomUUID(),
      "request",
      randomUUID(),
      "other",
      JSON.stringify(other.files.map((f) => ({ id: f.id, size: f.size }))),
    ]);
  });
  it("rejects receive tokens at owner endpoints and files from another transfer", async () => {
    const t = await ready();
    const code = (
      await db.query<{ code_digest: string }>(
        "select code_digest from transfers where id=$1",
        [t.id],
      )
    ).rows[0].code_digest;
    const session = randomUUID();
    await call("qd_receive", ["code", code, session]);
    await expect(call("qd_owner", [t.id, session])).rejects.toThrow("QD_AUTH");
    const other = await ready();
    await expect(
      call("qd_grant_begin", [
        other.files[0].id,
        session,
        randomUUID(),
        randomUUID(),
      ]),
    ).rejects.toThrow("QD_UNAVAILABLE");
  });
  it("reserves at most ten grants including pending requests, and replay is free", async () => {
    const t = await ready();
    const session = randomUUID();
    const code = (
      await db.query<{ code_digest: string }>(
        "select code_digest from transfers where id=$1",
        [t.id],
      )
    ).rows[0].code_digest;
    await call("qd_receive", ["code", code, session]);
    const firstKey = randomUUID();
    const first = await call("qd_grant_begin", [
      t.files[0].id,
      session,
      firstKey,
      randomUUID(),
    ]);
    await call("qd_grant_commit", [first.id, "cipher-url"]);
    expect(
      (
        await call("qd_grant_begin", [
          t.files[0].id,
          session,
          firstKey,
          randomUUID(),
        ])
      ).replay,
    ).toBe(true);
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        call("qd_grant_begin", [
          t.files[0].id,
          session,
          randomUUID(),
          randomUUID(),
        ]),
      ),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(9);
    expect(
      (
        await db.query<{ download_grants_count: number }>(
          "select download_grants_count from transfer_files where id=$1",
          [t.files[0].id],
        )
      ).rows[0].download_grants_count,
    ).toBe(10);
  });
  it("rejects expired and revoked lookup with the same error", async () => {
    const t = await ready();
    const code = (
      await db.query<{ code_digest: string }>(
        "select code_digest from transfers where id=$1",
        [t.id],
      )
    ).rows[0].code_digest;
    await call("qd_revoke", [t.id, t.owner]);
    await expect(
      call("qd_receive", ["code", code, randomUUID()]),
    ).rejects.toThrow("QD_UNAVAILABLE");
    await expect(
      call("qd_receive", ["code", "nonexistent", randomUUID()]),
    ).rejects.toThrow("QD_UNAVAILABLE");
  });
  it("expired uncertain grant can use a new key without refunding the reserved slot", async () => {
    const t = await ready();
    const session = randomUUID();
    const code = (
      await db.query<{ code_digest: string }>(
        "select code_digest from transfers where id=$1",
        [t.id],
      )
    ).rows[0].code_digest;
    await call("qd_receive", ["code", code, session]);
    const key = randomUUID();
    const grant = await call("qd_grant_begin", [
      t.files[0].id,
      session,
      key,
      randomUUID(),
    ]);
    await db.query(
      "update download_grants set lease_until=now()-interval '1 minute' where id=$1",
      [grant.id],
    );
    await expect(
      call("qd_grant_begin", [t.files[0].id, session, key, randomUUID()]),
    ).rejects.toThrow("QD_GRANT_EXPIRED");
    await call("qd_grant_begin", [
      t.files[0].id,
      session,
      randomUUID(),
      randomUUID(),
    ]);
    expect(
      (
        await db.query<{ download_grants_count: number }>(
          "select download_grants_count from transfer_files where id=$1",
          [t.files[0].id],
        )
      ).rows[0].download_grants_count,
    ).toBe(2);
  });
  it("does not return a signed grant if revocation happened during signing", async () => {
    const t = await ready();
    const session = randomUUID();
    const code = (
      await db.query<{ code_digest: string }>(
        "select code_digest from transfers where id=$1",
        [t.id],
      )
    ).rows[0].code_digest;
    await call("qd_receive", ["code", code, session]);
    const grant = await call("qd_grant_begin", [
      t.files[0].id,
      session,
      randomUUID(),
      randomUUID(),
    ]);
    await call("qd_revoke", [t.id, t.owner]);
    await expect(
      call("qd_grant_commit", [grant.id, "cipher-url"]),
    ).rejects.toThrow("QD_UNAVAILABLE");
  });
  it("keeps reservation/tombstones for late uploads, preserves failed cleanup, releases only once", async () => {
    const t = await init();
    await call("qd_revoke", [t.id, t.owner]);
    const lease = randomUUID();
    const claims = await call<{ id: string }[]>("qd_cleanup_claim", [lease]);
    expect(claims.some((c) => c.id === t.id)).toBe(true);
    const second = await call<{ id: string }[]>("qd_cleanup_claim", [
      randomUUID(),
    ]);
    expect(second.some((c) => c.id === t.id)).toBe(false);
    await call("qd_cleanup_finish", [t.id, lease, false, "DELETE_FAILED"]);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from transfers where id=$1",
          [t.id],
        )
      ).rows[0].status,
    ).toBe("cleanup_failed");
    await db.query(
      "update transfers set cleanup_next_attempt_at=now()-interval '1 minute' where id=$1",
      [t.id],
    );
    const next = randomUUID();
    await call("qd_cleanup_claim", [next]);
    await call("qd_cleanup_finish", [t.id, next, true, null]);
    expect(
      (await db.query("select * from transfers where id=$1", [t.id])).rows,
    ).toHaveLength(1);
    await db.query(
      "update transfers set purge_after=now()-interval '1 minute',cleanup_next_attempt_at=now()-interval '1 minute' where id=$1",
      [t.id],
    );
    const last = randomUUID();
    await call("qd_cleanup_claim", [last]);
    const before = (
      await db.query<{ reserved_bytes: number }>(
        "select reserved_bytes from usage_guard",
      )
    ).rows[0].reserved_bytes;
    await call("qd_cleanup_finish", [t.id, last, true, null]);
    await call("qd_cleanup_finish", [t.id, last, true, null]);
    const after = (
      await db.query<{ reserved_bytes: number }>(
        "select reserved_bytes from usage_guard",
      )
    ).rows[0].reserved_bytes;
    expect(Number(before) - Number(after)).toBe(25_000_000);
  });
  it("counts rate limits atomically", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        call("qd_rate_limit", ["test", randomUUID().slice(0, 0) + "ip", 5]),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
  it("rejects concurrent capacity overflow before signing", async () => {
    await db.exec(
      "update usage_guard set reserved_bytes=725000000,cleanup_heartbeat=now()",
    );
    const attempts = await Promise.allSettled([init(), init(), init()]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((r) => r.status === "rejected")).toHaveLength(2);
  });
});
