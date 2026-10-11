export class ClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: {
    method?: string;
    data?: unknown;
    token?: string;
    key?: string;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
      headers: {
        ...(options.data !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body:
        options.data !== undefined ? JSON.stringify(options.data) : undefined,
    });
  } catch {
    throw new ClientError(
      "Jaringan terputus atau layanan belum merespons. Coba lagi.",
      "NETWORK",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ClientError("Layanan belum merespons. Coba lagi.", "PROVIDER");
  }
  if (!response.ok)
    throw new ClientError(
      result.error?.message ?? "Permintaan gagal. Coba lagi.",
      result.error?.code ?? "PROVIDER",
      result.error?.retryAfterSeconds,
    );
  return result as T;
}
export function uploadFile(
  file: File,
  target: { signedUrl: string; mime: string },
  progress: (bytes: number) => void,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    const form = new FormData();
    form.append("cacheControl", "0");
    form.append("", file, "file");
    // Signed upload URL is path-scoped; no publishable/service-role key in browser.
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        progress(
          Math.min(file.size, Math.round((e.loaded / e.total) * file.size)),
        );
    };
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.onload = () => {
      signal.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        progress(file.size);
        resolve();
      } else
        reject(new ClientError("Upload gagal. Coba ulang file ini.", "UPLOAD"));
    };
    xhr.onerror = () => {
      signal.removeEventListener("abort", abort);
      reject(
        new ClientError("Jaringan terputus saat upload. Coba lagi.", "UPLOAD"),
      );
    };
    xhr.onabort = () => {
      signal.removeEventListener("abort", abort);
      reject(new ClientError("Upload dihentikan.", "ABORTED"));
    };
    xhr.timeout = 10 * 60 * 1000;
    xhr.ontimeout = () => {
      signal.removeEventListener("abort", abort);
      reject(
        new ClientError(
          "Upload terlalu lama. Coba lagi sebelum masa upload berakhir.",
          "UPLOAD",
        ),
      );
    };
    if (signal.aborted) {
      reject(new ClientError("Upload dihentikan.", "ABORTED"));
      return;
    }
    // Set the MIME on the Blob while preserving every file byte.
    form.set("", new Blob([file], { type: target.mime }), "file");
    xhr.send(form);
  });
}
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
