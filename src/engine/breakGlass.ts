import { MAX_TTL_SECONDS, NonceRegistry, encodePublicKey, generateSessionKeyPair, signToken, verifyToken, type Expectation, type FounderToken, type TokenCode } from './ed25519Verifier';

/**
 * Break-Glass rehearsal (MASTER_REFERENCE §4.5, IAM-001 and IAM-002). In production the token is minted OUTSIDE the application by an isolated CLI with
 * MFA; here the person can rehearse issuing and checking one. Rules this module enforces:
 *  - the key pair lives inside the session object only: it is never returned in a result, serialised, stored or logged;
 *  - lifetime is at most 900 seconds (15 minutes);
 *  - a nonce is single-use: the second verification of the same token is rejected as a replay.
 */
export const BG_SCOPES = ['AUTHORIZE_FINANCIAL_COMMITMENT'] as const; // the only scope named in §4.5.2 (docs/REFERENCE_GAPS.md G-13)
export type BgScope = (typeof BG_SCOPES)[number];
export const BG_MAX_AMOUNT_USD = 1_000_000;
const TARGET_RE = /^[a-z][a-z0-9_]*(?::[A-Za-z0-9_.-]+)*$/;

export type BgCode = 'BG_SCOPE' | 'BG_TARGET_FORMAT' | 'BG_TARGET_CONFIRM' | 'BG_AMOUNT' | 'BG_TTL' | 'BG_TTL_EXCEEDED';
export interface IssueRequest { scope: string; target_resource: string; confirm_target: string; max_amount_usd: number; ttl_seconds: number; now?: number }
export type IssueResult = { ok: true; token: FounderToken } | { ok: false; code: BgCode; reason: string };
export type CheckResult = { ok: true } | { ok: false; code: TokenCode; reason: string };

/** Opaque handle. The secret key is a closure variable, not a property, so spreading or JSON-serialising the session cannot reveal it. */
export interface BreakGlassSession {
  readonly publicKey: string;
  readonly nonces: NonceRegistry;
  issue(req: IssueRequest): Promise<IssueResult>;
  verify(token: FounderToken, expect?: Omit<Expectation, 'trusted_keys'>, now?: number): Promise<CheckResult>;
}

export async function openSession(): Promise<BreakGlassSession> {
  const pair = await generateSessionKeyPair();
  const publicKey = encodePublicKey(pair.publicKey);
  const nonces = new NonceRegistry();
  return {
    publicKey, nonces,
    async issue(req) {
      if (!(BG_SCOPES as readonly string[]).includes(req.scope)) return { ok: false, code: 'BG_SCOPE', reason: `Scope must be one of ${BG_SCOPES.join(', ')}.` };
      if (!TARGET_RE.test(req.target_resource)) return { ok: false, code: 'BG_TARGET_FORMAT', reason: 'Name the target like dept_opportunity_acquisition:task:a1b2c3d4 (lower-case, colon separated).' };
      if (req.confirm_target !== req.target_resource) return { ok: false, code: 'BG_TARGET_CONFIRM', reason: 'Type the target again exactly. A token is valid for one target only.' };
      if (!Number.isFinite(req.max_amount_usd) || req.max_amount_usd <= 0 || req.max_amount_usd > BG_MAX_AMOUNT_USD) return { ok: false, code: 'BG_AMOUNT', reason: `The amount must be above 0 and at most ${BG_MAX_AMOUNT_USD} USD.` };
      if (!Number.isInteger(req.ttl_seconds) || req.ttl_seconds < 1) return { ok: false, code: 'BG_TTL', reason: 'The lifetime is a whole number of seconds, at least 1.' };
      if (req.ttl_seconds > MAX_TTL_SECONDS) return { ok: false, code: 'BG_TTL_EXCEEDED', reason: `The lifetime is at most ${MAX_TTL_SECONDS} seconds (15 minutes).` };
      return { ok: true, token: await signToken({ scope: req.scope, target_resource: req.target_resource, max_amount_usd: req.max_amount_usd, ttl_seconds: req.ttl_seconds, now: req.now }, pair) };
    },
    verify: (token, expect = {}, now = Date.now()) => verifyToken(token, nonces, { ...expect, trusted_keys: [publicKey] }, now),
  };
}

/** What is safe to log or show about a token: everything except the signature. */
export const tokenSummary = (t: FounderToken) => ({ token_id: t.token_id, scope: t.scope, target_resource: t.target_resource, max_amount_usd: t.max_amount_usd, valid_from: t.valid_from, valid_until: t.valid_until, nonce: t.nonce });
