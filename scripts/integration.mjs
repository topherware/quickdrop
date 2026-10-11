import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
if (process.env.ENABLE_LIVE_TESTS !== "true")
  throw new Error(
    "Live tests create only QuickDrop fixtures. Set ENABLE_LIVE_TESTS=true only after remote approval.",
  );
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  APP_ORIGIN: origin,
  CLEANUP_SECRET: secret,
} = process.env;
if (!url || !key || !publicKey || !origin || !secret)
  throw new Error("Complete .env.local first; never paste keys into chat.");
assert.equal(
  new URL(url).hostname,
  "iqhllyxufmeocbkrwopr.supabase.co",
  "Unreviewed target",
);
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function request(path, { method = "GET", data, token, key: idem } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Origin: origin,
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idem ? { "Idempotency-Key": idem } : {}),
    },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  const body = await response.json();
  return { status: response.status, body };
}
async function worker(authenticated = true) {
  return fetch(`${url}/functions/v1/cleanup-transfers`, {
    method: "POST",
    headers: authenticated ? { "x-cleanup-secret": secret } : {},
  });
}
const fixtures = [];
try {
  assert.equal((await worker(false)).status, 401);
  assert.equal(
    (await worker()).status,
    200,
    "Cleanup must be healthy before init",
  );
  const { data: bucket, error: bucketError } =
    await db.storage.getBucket("transfers");
  assert.equal(bucketError, null);
  assert.equal(bucket.public, false);
  assert.equal(bucket.file_size_limit, 25_000_000);
  for (const table of [
    "transfers",
    "transfer_files",
    "receive_sessions",
    "idempotency_records",
    "download_grants",
    "rate_limit_buckets",
    "usage_guard",
  ]) {
    const { error } = await anon.from(table).select("*").limit(1);
    assert.ok(error, `Anonymous table read must be denied: ${table}`);
  }
  assert.ok(
    (await anon.rpc("qd_cleanup_heartbeat")).error,
    "Anonymous privileged RPC denied",
  );
  const payloads = [
    Buffer.from("QuickDrop integration fixture A\n"),
    Buffer.from("QuickDrop integration fixture B\n"),
  ];
  const metadata = payloads.map((p, i) => ({
    name: `quickdrop-fixture-${i}.txt`,
    mime: "text/plain",
    size: p.length,
  }));
  const idem = randomUUID();
  const initialized = await request("/api/transfers", {
    method: "POST",
    data: { files: metadata },
    key: idem,
  });
  assert.equal(initialized.status, 201);
  const sender = initialized.body;
  fixtures.push(sender);
  const replay = await request("/api/transfers", {
    method: "POST",
    data: { files: metadata },
    key: idem,
  });
  assert.equal(replay.body.transferId, sender.transferId);
  for (let i = 0; i < sender.targets.length; i++) {
    const form = new FormData();
    form.append("cacheControl", "0");
    form.append("", new Blob([payloads[i]], { type: "text/plain" }), "file");
    const result = await fetch(sender.targets[i].signedUrl, {
      method: "PUT",
      headers: { "x-upsert": "false" },
      body: form,
    });
    assert.ok(result.ok, "Direct signed upload failed");
  }
  assert.ok(
    (await anon.storage.from("transfers").download(sender.targets[0].path))
      .error,
    "Anonymous private download denied",
  );
  assert.ok(
    (
      await anon.storage
        .from("transfers")
        .upload(
          `${sender.transferId}/${randomUUID()}`,
          Buffer.from("unauthorized"),
        )
    ).error,
    "Anonymous upload denied",
  );
  const completionKey = randomUUID();
  const complete = () =>
    request(`/api/transfers/${sender.transferId}/complete`, {
      method: "POST",
      data: {},
      token: sender.ownerToken,
      key: completionKey,
    });
  const [a, b] = await Promise.all([complete(), complete()]);
  assert.equal(a.status, 200);
  assert.equal(b.body.code, a.body.code);
  assert.match(a.body.code, /^\d{8}$/);
  const received = await request("/api/transfers/lookup", {
    method: "POST",
    data: { code: a.body.code.slice(0, 4) + " " + a.body.code.slice(4) },
  });
  assert.equal(received.status, 200);
  const receiver = received.body;
  assert.equal(
    (
      await request(`/api/transfers/${sender.transferId}/status`, {
        token: receiver.receiveToken,
      })
    ).status,
    401,
  );
  for (const file of receiver.files) {
    const grantKey = randomUUID();
    const issued = await request(`/api/files/${file.id}/download`, {
      method: "POST",
      data: {},
      token: receiver.receiveToken,
      key: grantKey,
    });
    assert.equal(issued.status, 200);
    const again = await request(`/api/files/${file.id}/download`, {
      method: "POST",
      data: {},
      token: receiver.receiveToken,
      key: grantKey,
    });
    assert.equal(again.body.downloadUrl, issued.body.downloadUrl);
    const actual = await fetch(issued.body.downloadUrl);
    assert.ok(
      actual.headers
        .get("content-disposition")
        ?.toLowerCase()
        .includes("attachment"),
    );
    const expected = payloads[metadata.findIndex((m) => m.name === file.name)];
    assert.equal(hash(Buffer.from(await actual.arrayBuffer())), hash(expected));
  }
  // Only this fixture is expired. Production TTL/configuration is unchanged.
  assert.equal(
    (
      await db
        .from("transfers")
        .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq("id", sender.transferId)
    ).error,
    null,
  );
  const expired = await request("/api/transfers/lookup", {
    method: "POST",
    data: { code: a.body.code },
  });
  assert.equal(expired.status, 404);
  const absent = await request("/api/transfers/lookup", {
    method: "POST",
    data: { code: "00000000" },
  });
  assert.equal(absent.status, 404);
  assert.equal(expired.body.error.message, absent.body.error.message);
  assert.equal((await worker()).status, 200);
  const { data: remaining, error: listError } = await db.storage
    .from("transfers")
    .list(sender.transferId);
  assert.equal(listError, null);
  assert.equal(remaining.length, 0);
  assert.ok(
    (
      await db
        .from("transfers")
        .select("id")
        .eq("id", sender.transferId)
        .single()
    ).data,
    "Late-upload tombstone must remain",
  );
  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        environment: "live Supabase + local Next.js",
        hashMatch: true,
        privateStorage: true,
        anonymousDenied: true,
        ownerSeparated: true,
        idempotency: true,
        logicalExpiry: true,
        firstCleanupSweep: true,
        finalSweep: "verify after credential lifetime + grace",
        twoPhysicalDevices: "not tested",
      },
      null,
      2,
    ),
  );
} finally {
  for (const sender of fixtures)
    await request(`/api/transfers/${sender.transferId}`, {
      method: "DELETE",
      token: sender.ownerToken,
    }).catch(() => {});
  if (fixtures.length) await worker().catch(() => {});
}
