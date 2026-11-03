export type SecretVerdict = { ok: true } | { ok: false; code: 'SEC-001'; reason: string };
/** SEC-001 (§5.5.1): a secret field holds a reference of the form vault://<path>/<key>, never the secret. */
const REF = /^vault:\/\/[a-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+$/;
export function validateSecretRef(value: string): SecretVerdict {
  const v = value.trim();
  if (!v.startsWith('vault://')) return { ok: false, code: 'SEC-001', reason: 'A secret must be a reference that starts with vault://. Never paste the secret itself.' };
  if (!REF.test(v)) return { ok: false, code: 'SEC-001', reason: 'Use the form vault://<scope>/<name>/<key>, for example vault://depts/opp_acq/yc_api_key.' };
  return { ok: true };
}
const SHAPES: { name: string; re: RegExp }[] = [
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ }, { name: 'API key (sk-…)', re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ }, { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'inline credential', re: /(?:password|secret|token|api[_-]?key)\s*[:=]\s*['"][A-Za-z0-9/+_.-]{12,}['"]/i },
];
export interface SecretHit { line: number; shape: string }
/** Finds text shaped like a real secret so it never reaches a generated file, an export or the audit log. */
export function scanForSecrets(text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  text.split('\n').forEach((line, i) => { for (const s of SHAPES) if (s.re.test(line)) hits.push({ line: i + 1, shape: s.name }); });
  return hits;
}
