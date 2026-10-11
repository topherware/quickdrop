export async function isAuthorized(
  request: Request,
  secret: string,
): Promise<boolean> {
  const incoming = request.headers.get("x-cleanup-secret") ?? "";
  if (
    request.method !== "POST" ||
    secret.length < 32 ||
    secret.length > 256 ||
    !incoming ||
    incoming.length > 256
  )
    return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [incoming, secret].map((v) =>
      crypto.subtle.digest("SHA-256", encoder.encode(v)),
    ),
  );
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}
