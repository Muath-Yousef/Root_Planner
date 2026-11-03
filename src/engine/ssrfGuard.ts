import { load } from 'js-yaml';

export type SsrfCode = 'SSRF_METHOD' | 'SSRF_SCHEME' | 'SSRF_BAD_URL' | 'SSRF_DOMAIN_NOT_APPROVED' | 'SSRF_PRIVATE_IP' | 'SSRF_BLOCKED_RANGE' | 'SSRF_BAD_IP';
export type SsrfResult = { ok: true; host: string } | { ok: false; code: SsrfCode; error: 'ForbiddenMethodError' | 'SSRFViolationError' | 'UnauthorizedDomainError'; reason: string };
export interface SsrfConfig { approved_hosts: string[]; blocked_ip_ranges: string[]; methods: string[]; max_timeout?: number; max_response_size?: number }

/** Parses sources_watchlist.yaml (§5.4.3). Fail-closed: an unreadable file yields an empty allowlist. */
export function parseWatchlist(text: string): SsrfConfig {
  try {
    const doc = (load(text) ?? {}) as { approved_sources?: Record<string, { domain: string }>; blocked_ip_ranges?: string[]; constraints?: { methods?: string[]; max_timeout?: number; max_response_size?: number } };
    return {
      approved_hosts: Object.values(doc.approved_sources ?? {}).map((s) => s.domain),
      blocked_ip_ranges: doc.blocked_ip_ranges ?? [], methods: doc.constraints?.methods ?? ['GET', 'HEAD'],
      max_timeout: doc.constraints?.max_timeout, max_response_size: doc.constraints?.max_response_size,
    };
  } catch { return { approved_hosts: [], blocked_ip_ranges: [], methods: ['GET', 'HEAD'] }; }
}

const parseV4 = (h: string): number[] | null => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((x) => x <= 255) ? o : null;
};
/** Browser-URL hostnames can be decimal/hex/octal integers; normalise like inet_aton so they cannot dodge the check. */
function normalizeHost(host: string): string {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (/^(0x[0-9a-f]+|\d+)$/.test(h)) { const n = Number(h); if (Number.isFinite(n) && n >= 0 && n <= 0xffffffff) return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); }
  return h;
}
const inV4Cidr = (ip: number[], cidr: string): boolean => {
  const [net, bitsRaw] = cidr.split('/');
  const n = parseV4(net); if (!n) return false;
  const bits = Number(bitsRaw ?? 32);
  const a = ((ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3]) >>> 0, b = ((n[0] << 24) | (n[1] << 16) | (n[2] << 8) | n[3]) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
};
/** Equivalent of Python ipaddress is_private/is_loopback/is_link_local/is_multicast/is_reserved/is_unspecified. */
export function isInternalIp(raw: string): boolean {
  const host = normalizeHost(raw);
  const v4 = parseV4(host);
  if (v4) {
    const [a, b, c] = v4;
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && c === 0) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  if (!host.includes(':')) return false;
  if (host === '::' || host === '::1') return true;
  const mapped = /^::ffff:(.+)$/.exec(host);
  if (mapped) {
    const d = parseV4(mapped[1]); if (d) return isInternalIp(d.join('.'));
    const hex = mapped[1].split(':');
    if (hex.length === 2) { const n = (parseInt(hex[0], 16) << 16) | parseInt(hex[1], 16); return isInternalIp([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')); }
  }
  return /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('ff');
}
const internalName = (h: string) => h === 'localhost' || !h.includes('.') || /\.(localhost|local|internal|lan|intranet|corp|home)$/.test(h);
const isIpLiteral = (h: string) => !!parseV4(h) || h.includes(':');

export const isDomainApproved = (host: string, approved: string[]) => approved.some((h) => host === h || host.endsWith(`.${h}`));

/**
 * §5.4.2: four deterministic checks — (1) method, (2) scheme http/https, (3) approved domain, (4) resolved IP not private or in a blocked range.
 * `resolvedIps` stands in for DNS resolution; the studio never touches the network.
 */
export function validateRequest(url: string, method: string, cfg: SsrfConfig, resolvedIps: string[] = []): SsrfResult {
  const m = method.toUpperCase();
  if (!cfg.methods.includes(m)) return { ok: false, code: 'SSRF_METHOD', error: 'ForbiddenMethodError', reason: `Method '${method}' is not in the allowed methods: ${cfg.methods.join(', ')}.` };
  let u: URL;
  try { u = new URL(url); } catch { return { ok: false, code: 'SSRF_BAD_URL', error: 'SSRFViolationError', reason: 'The address is not a valid URL.' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, code: 'SSRF_SCHEME', error: 'SSRFViolationError', reason: `Only http/https schemes are allowed. Got: ${u.protocol.replace(':', '')}.` };
  const host = normalizeHost(u.hostname);
  if (isIpLiteral(host) || internalName(host)) {
    if (isInternalIp(host) || internalName(host)) return { ok: false, code: 'SSRF_PRIVATE_IP', error: 'SSRFViolationError', reason: `${host} is a private or internal address. SSRF access blocked.` };
  }
  if (!isDomainApproved(host, cfg.approved_hosts)) return { ok: false, code: 'SSRF_DOMAIN_NOT_APPROVED', error: 'UnauthorizedDomainError', reason: `Domain '${host}' is not in the approved sources allowlist.` };
  for (const ip of resolvedIps) {
    const v4 = parseV4(ip);
    if (!v4 && !ip.includes(':')) return { ok: false, code: 'SSRF_BAD_IP', error: 'SSRFViolationError', reason: `Invalid IP address format: ${ip}` };
    if (isInternalIp(ip)) return { ok: false, code: 'SSRF_PRIVATE_IP', error: 'SSRFViolationError', reason: `${host} resolved to the private address ${ip}. SSRF access blocked.` };
    const range = v4 ? cfg.blocked_ip_ranges.find((r) => inV4Cidr(v4, r)) : undefined;
    if (range) return { ok: false, code: 'SSRF_BLOCKED_RANGE', error: 'SSRFViolationError', reason: `IP ${ip} is in blocked network range ${range}.` };
  }
  return { ok: true, host };
}
