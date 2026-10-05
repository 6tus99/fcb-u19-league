// Client-side SHA-256 (hex) — used to store verification codes as hashes,
// so the raw 6-digit code never sits in the database.
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
