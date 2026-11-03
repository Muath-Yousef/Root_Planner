import * as ed from '@noble/ed25519';

/** §4.5.2: valid_until - valid_from <= 900 s. */
export const MAX_TTL_SECONDS = 900;
export interface FounderToken {
  token_id: string; founder_public_key: string; scope: string; target_resource: string; max_amount_usd: number;
  valid_from: string; valid_until: string; nonce: string; signature: string;
}
export type TokenCode = 'TOKEN_MALFORMED' | 'TOKEN_TTL_EXCEEDED' | 'TOKEN_NOT_YET_VALID' | 'TOKEN_EXPIRED' | 'TOKEN_BAD_SIGNATURE' | 'TOKEN_REPLAY' | 'TOKEN_SCOPE_MISMATCH' | 'TOKEN_TARGET_MISMATCH' | 'TOKEN_AMOUNT_EXCEEDED' | 'TOKEN_UNTRUSTED_KEY';
export type VerifyResult = { ok: true } | { ok: false; code: TokenCode; reason: string };

// SPKI DER prefix for an Ed25519 public key: the Base64 of this prefix + key starts with "MCowBQYDK2VwAyEA" as in §4.5.2.
const SPKI = Uint8Array.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const encodePublicKey = (raw: Uint8Array) => `ed25519:${b64(Uint8Array.from([...SPKI, ...raw]))}`;
export function decodePublicKey(s: string): Uint8Array | null {
  if (!s.startsWith('ed25519:')) return null;
  try { const u = unb64(s.slice(8)); return u.length === SPKI.length + 32 ? u.slice(SPKI.length) : null; } catch { return null; }
}
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}
const body = (t: Omit<FounderToken, 'signature'>) => new TextEncoder().encode(canonical(t));
const hex = (u: Uint8Array) => [...u].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Session keys live in memory only. They are never persisted, exported or logged. */
export async function generateSessionKeyPair() {
  const secretKey = ed.utils.randomSecretKey();
  return { secretKey, publicKey: await ed.getPublicKeyAsync(secretKey) };
}
export const newNonce = () => hex(crypto.getRandomValues(new Uint8Array(16)));

export interface TokenRequest { scope: string; target_resource: string; max_amount_usd: number; ttl_seconds: number; now?: number }
export async function signToken(req: TokenRequest, key: { secretKey: Uint8Array; publicKey: Uint8Array }): Promise<FounderToken> {
  const now = req.now ?? Date.now();
  const unsigned = {
    token_id: `tok-${crypto.randomUUID()}`, founder_public_key: encodePublicKey(key.publicKey), scope: req.scope, target_resource: req.target_resource,
    max_amount_usd: req.max_amount_usd, valid_from: new Date(now).toISOString(), valid_until: new Date(now + req.ttl_seconds * 1000).toISOString(), nonce: newNonce(),
  };
  return { ...unsigned, signature: `ed25519:${b64(await ed.signAsync(body(unsigned), key.secretKey))}` };
}

/** Replay defense: a nonce is stored on first successful use; any later use of the same nonce is rejected. */
export class NonceRegistry {
  private seen = new Map<string, number>();
  has(n: string) { return this.seen.has(n); }
  add(n: string, expiresAtMs: number) { this.seen.set(n, expiresAtMs); }
  prune(now: number) { for (const [n, e] of this.seen) if (e < now) this.seen.delete(n); }
  get size() { return this.seen.size; }
}
export interface Expectation { scope?: string; target_resource?: string; amount_usd?: number; trusted_keys?: string[] }

export async function verifyToken(t: FounderToken, nonces: NonceRegistry, expect: Expectation = {}, now = Date.now()): Promise<VerifyResult> {
  const from = Date.parse(t.valid_from), until = Date.parse(t.valid_until);
  const pub = decodePublicKey(t.founder_public_key);
  if (!t.nonce || !t.signature?.startsWith('ed25519:') || !pub || Number.isNaN(from) || Number.isNaN(until))
    return { ok: false, code: 'TOKEN_MALFORMED', reason: 'The token is missing a nonce, a valid key, a signature or valid timestamps.' };
  if ((until - from) / 1000 > MAX_TTL_SECONDS) return { ok: false, code: 'TOKEN_TTL_EXCEEDED', reason: `Lifetime ${(until - from) / 1000}s is above the 15 minute maximum (${MAX_TTL_SECONDS}s).` };
  if (until <= from) return { ok: false, code: 'TOKEN_MALFORMED', reason: 'valid_until must be after valid_from.' };
  if (now < from - 30_000) return { ok: false, code: 'TOKEN_NOT_YET_VALID', reason: 'valid_from is in the future.' };
  if (now > until) return { ok: false, code: 'TOKEN_EXPIRED', reason: 'The token has expired.' };
  if (expect.trusted_keys && !expect.trusted_keys.includes(t.founder_public_key)) return { ok: false, code: 'TOKEN_UNTRUSTED_KEY', reason: 'The signing key is not a trusted founder key.' };
  let valid = false;
  const { signature, ...unsigned } = t;
  try { valid = await ed.verifyAsync(unb64(signature.slice(8)), body(unsigned), pub); } catch { valid = false; }
  if (!valid) return { ok: false, code: 'TOKEN_BAD_SIGNATURE', reason: 'The signature does not match the token content and key.' };
  if (expect.scope && expect.scope !== t.scope) return { ok: false, code: 'TOKEN_SCOPE_MISMATCH', reason: `Token scope ${t.scope} does not match ${expect.scope}.` };
  if (expect.target_resource && expect.target_resource !== t.target_resource) return { ok: false, code: 'TOKEN_TARGET_MISMATCH', reason: 'Token targets a different resource.' };
  if (expect.amount_usd !== undefined && expect.amount_usd > t.max_amount_usd) return { ok: false, code: 'TOKEN_AMOUNT_EXCEEDED', reason: `Amount ${expect.amount_usd} is above the token limit ${t.max_amount_usd}.` };
  nonces.prune(now);
  if (nonces.has(t.nonce)) return { ok: false, code: 'TOKEN_REPLAY', reason: 'This nonce was already used. Replayed tokens are rejected.' };
  nonces.add(t.nonce, until);
  return { ok: true };
}
