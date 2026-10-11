import "server-only";
import { randomUUID } from "node:crypto";
import { BUCKET } from "@/lib/shared/config";
import {
  normalizeFiles,
  validationMessage,
  type FileMetadata,
} from "@/lib/shared/validation";
import type {
  InitResponse,
  ReadyResponse,
  ReceiveResponse,
  StatusResponse,
} from "@/lib/shared/types";
import { ApiError } from "./http";
import { database, rpc } from "./supabase";
import { getEnv } from "./env";
import {
  decrypt,
  digest,
  encrypt,
  keyedDigest,
  newCode,
  newToken,
} from "./tokens";
type DbTransfer = {
  id: string;
  status: string;
  upload_deadline: string;
  expires_at: string | null;
  created_at: string;
};
type DbFile = {
  id: string;
  object_path: string;
  original_name: string;
  declared_mime: string;
  declared_size_bytes: number;
};
type OwnerData = { transfer: DbTransfer; files: DbFile[]; serverTime: string };
type InitEnvelope = InitResponse & { shareToken: string };
type CompletionResult = {
  encryptedResponse: string;
  expiresAt: string;
  serverTime: string;
};
export async function initTransfer(
  metadata: FileMetadata[],
  key: string,
): Promise<InitResponse> {
  let files: FileMetadata[];
  try {
    files = normalizeFiles(metadata);
  } catch (error) {
    throw new ApiError(
      error instanceof Error && error.message === "UNSUPPORTED_TYPE"
        ? 415
        : 413,
      "FILE_LIMIT",
      validationMessage(error),
    );
  }
  const env = getEnv();
  const transferId = randomUUID(),
    ownerToken = newToken(),
    shareToken = newToken();
  const assigned = files.map((file) => ({ ...file, id: randomUUID() }));
  const reservation = await rpc<{
    created: boolean;
    encryptedResponse?: string;
    transfer?: DbTransfer;
  }>("qd_init", {
    p_id: transferId,
    p_owner: digest(ownerToken),
    p_share: digest(shareToken),
    p_key: digest(key),
    p_request: digest(JSON.stringify(metadata)),
    p_files: assigned,
    p_period: env.USAGE_PERIOD_START,
  });
  if (!reservation.created) {
    const { shareToken: _share, ...replay } = decrypt<InitEnvelope>(
      reservation.encryptedResponse!,
      env.TOKEN_ENCRYPTION_KEY,
    );
    void _share;
    return { ...replay, serverTime: new Date().toISOString() };
  }
  const db = database();
  try {
    const targets = await Promise.all(
      assigned.map(async (file) => {
        const path = `${transferId}/${file.id}`;
        const { data, error } = await db.storage
          .from(BUCKET)
          .createSignedUploadUrl(path, { upsert: false });
        if (error || !data) throw new Error("QD_PROVIDER");
        return { ...file, path, signedUrl: data.signedUrl };
      }),
    );
    const response: InitEnvelope = {
      transferId,
      ownerToken,
      shareToken,
      targets,
      uploadDeadline: reservation.transfer!.upload_deadline,
      serverTime: new Date().toISOString(),
    };
    await rpc("qd_init_commit", {
      p_id: transferId,
      p_key: digest(key),
      p_response: encrypt(response, env.TOKEN_ENCRYPTION_KEY),
    });
    const { shareToken: _share, ...safe } = response;
    void _share;
    return safe;
  } catch {
    await rpc("qd_revoke", {
      p_id: transferId,
      p_owner: digest(ownerToken),
    }).catch(() => undefined);
    throw new Error("QD_PROVIDER");
  }
}
async function ownerData(id: string, token: string) {
  return rpc<OwnerData>("qd_owner", { p_id: id, p_owner: digest(token) });
}
async function inspectFiles(files: DbFile[]) {
  const db = database();
  return Promise.all(
    files.map(async (file) => {
      const { data, error } = await db.storage
        .from(BUCKET)
        .info(file.object_path);
      if (error) {
        if (
          String(error.statusCode) === "404" ||
          error.status === 404 ||
          ("code" in error && error.code === "NoSuchKey")
        )
          return { id: file.id, size: null };
        throw new Error("QD_PROVIDER");
      }
      return { id: file.id, size: data?.size ?? 0 };
    }),
  );
}
export async function transferStatus(
  id: string,
  owner: string,
): Promise<StatusResponse> {
  const data = await ownerData(id, owner);
  let status = data.transfer.status;
  if (
    (status === "ready" &&
      Date.parse(data.transfer.expires_at!) <= Date.parse(data.serverTime)) ||
    (status === "uploading" &&
      Date.parse(data.transfer.upload_deadline) <= Date.parse(data.serverTime))
  )
    status = "expired";
  const actual = status === "uploading" ? await inspectFiles(data.files) : [];
  let ready: ReadyResponse | undefined;
  if (status === "ready") {
    const { data: record, error } = await database()
      .from("idempotency_records")
      .select("encrypted_response")
      .eq("scope", `complete:${id}`)
      .single();
    if (error) throw new Error("QD_PROVIDER");
    ready = {
      ...decrypt<{ code: string; shareToken: string }>(
        record.encrypted_response,
        getEnv().TOKEN_ENCRYPTION_KEY,
      ),
      expiresAt: data.transfer.expires_at!,
      serverTime: data.serverTime,
    };
  }
  return {
    status,
    serverTime: data.serverTime,
    uploadDeadline: data.transfer.upload_deadline,
    expiresAt: data.transfer.expires_at,
    files: data.files.map((f) => ({
      id: f.id,
      name: f.original_name,
      size: f.declared_size_bytes,
      mime: f.declared_mime,
      uploaded:
        status === "ready" ||
        actual.some((a) => a.id === f.id && a.size === f.declared_size_bytes),
    })),
    ready,
  };
}
export async function completeTransfer(
  id: string,
  owner: string,
  key: string,
): Promise<ReadyResponse> {
  const data = await ownerData(id, owner);
  if (data.transfer.status === "ready") {
    const ready = (await transferStatus(id, owner)).ready;
    if (!ready) throw new Error("QD_UNAVAILABLE");
    return ready;
  }
  if (
    data.transfer.status !== "uploading" ||
    Date.parse(data.transfer.upload_deadline) <= Date.parse(data.serverTime)
  )
    throw new Error("QD_UNAVAILABLE");
  const actual = await inspectFiles(data.files);
  if (actual.some((a) => a.size === null))
    throw new ApiError(
      409,
      "UPLOAD_PENDING",
      "Ada file yang belum selesai diunggah. Coba unggah ulang file tersebut.",
    );
  if (
    actual.some(
      (a) =>
        a.size !== data.files.find((f) => f.id === a.id)!.declared_size_bytes,
    )
  ) {
    await revokeTransfer(id, owner);
    throw new Error("QD_MISMATCH");
  }
  const env = getEnv();
  const { data: record, error } = await database()
    .from("idempotency_records")
    .select("encrypted_response")
    .eq("scope", "init")
    .eq("transfer_id", id)
    .single();
  if (error || !record?.encrypted_response) throw new Error("QD_PROVIDER");
  const init = decrypt<InitEnvelope>(
    record.encrypted_response,
    env.TOKEN_ENCRYPTION_KEY,
  );
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode();
    try {
      const ready = await rpc<CompletionResult>("qd_complete", {
        p_id: id,
        p_owner: digest(owner),
        p_key: digest(key),
        p_request: digest(id),
        p_code: keyedDigest(code, env.CODE_HMAC_SECRET),
        p_response: encrypt(
          { code, shareToken: init.shareToken },
          env.TOKEN_ENCRYPTION_KEY,
        ),
        p_actual: actual,
      });
      return {
        ...decrypt<{ code: string; shareToken: string }>(
          ready.encryptedResponse,
          env.TOKEN_ENCRYPTION_KEY,
        ),
        expiresAt: ready.expiresAt,
        serverTime: ready.serverTime,
      };
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "QD_COLLISION")
        throw error;
    }
  }
  throw new Error("QD_PROVIDER");
}
export async function receiveTransfer(
  kind: "code" | "share",
  value: string,
): Promise<ReceiveResponse> {
  const env = getEnv();
  const receiveToken = newToken();
  const result = await rpc<Omit<ReceiveResponse, "receiveToken">>(
    "qd_receive",
    {
      p_kind: kind,
      p_digest:
        kind === "code"
          ? keyedDigest(value, env.CODE_HMAC_SECRET)
          : digest(value),
      p_session: digest(receiveToken),
    },
  );
  return { ...result, receiveToken };
}
export async function downloadFile(
  fileId: string,
  receiveToken: string,
  key: string,
) {
  const env = getEnv();
  const result = await rpc<{
    replay: boolean;
    encryptedUrl?: string;
    validUntil: string;
    id?: string;
    path?: string;
    name?: string;
    ttl?: number;
  }>("qd_grant_begin", {
    p_file: fileId,
    p_session: digest(receiveToken),
    p_key: digest(key),
    p_grant: randomUUID(),
  });
  if (result.replay)
    return {
      downloadUrl: decrypt<string>(
        result.encryptedUrl!,
        env.TOKEN_ENCRYPTION_KEY,
      ),
      validUntil: result.validUntil,
    };
  // Subtract network time so the URL never outlives the DB grant/transfer.
  const remaining =
    Math.floor((Date.parse(result.validUntil) - Date.now()) / 1000) - 1;
  if (remaining < 1) throw new Error("QD_UNAVAILABLE");
  const { data, error } = await database()
    .storage.from(BUCKET)
    .createSignedUrl(result.path!, Math.min(result.ttl!, remaining), {
      download: result.name!,
    });
  if (error || !data) throw new Error("QD_PROVIDER");
  // Signing failure or an uncertain commit keeps the slot reserved conservatively.
  await rpc("qd_grant_commit", {
    p_grant: result.id,
    p_url: encrypt(data.signedUrl, env.TOKEN_ENCRYPTION_KEY),
  });
  return { downloadUrl: data.signedUrl, validUntil: result.validUntil };
}
export async function revokeTransfer(id: string, owner: string) {
  await rpc("qd_revoke", { p_id: id, p_owner: digest(owner) });
  const env = getEnv();
  // Best effort kick; scheduled worker remains the durable fallback.
  await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cleanup-transfers`,
    {
      method: "POST",
      headers: { "x-cleanup-secret": env.CLEANUP_SECRET },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    },
  ).catch(() => undefined);
}
