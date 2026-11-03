import { CABLE_DEFS, CABLE_KINDS, getRole, parsePort, portsFor, type Match } from '../registry';
import type { CableKind, SNode, Verdict } from '../types';
import { isPermitted, memoryPermitted } from './permissionStore';

const OK: Verdict = { ok: true };
const deny = (code: string, reason: string, fix?: string): Verdict => ({ ok: false, code, reason, fix });
const matches = (m: Match, n: SNode) => (!m.kinds || m.kinds.includes(n.data.kind)) && (!m.roles || m.roles.includes(n.data.role));
export const effectiveNetwork = (n: SNode) => n.data.networkMode ?? getRole(n.data.role)?.network;
const hasPort = (n: SNode, dir: 'in' | 'out', cable: CableKind) => portsFor(n.data.kind, n.data.role).some((p) => p.direction === dir && p.cable === cable);
const linked = (kind: CableKind, s: SNode, t: SNode) => CABLE_DEFS[kind].links.some((l) => matches(l.from, s) && matches(l.to, t));
const linkText = (kind: CableKind) => CABLE_DEFS[kind].links.map((l) => `${l.from.roles?.[0] ?? l.from.kinds?.join('/')} → ${l.to.roles?.[0] ?? l.to.kinds?.join('/')}`).join(', ');

/** Which cable does this pair want when the person did not pick a port? Data-driven. */
export function inferKind(s: SNode, t: SNode): CableKind | null {
  const found = CABLE_KINDS.filter((k) => linked(k, s, t));
  if (found.length) return found[0];
  if (t.data.kind === 'external' || t.data.role === 'ssrf_guard' || s.data.role === 'ssrf_guard') return 'EGRESS_NETWORK';
  if (t.data.kind === 'memory') return 'MEMORY_BUS';
  return null;
}

export function verdictFor(kind: CableKind, s: SNode, t: SNode, access: 'read' | 'write' = 'read'): Verdict {
  const role = getRole(s.data.role);
  if (kind === 'EGRESS_NETWORK' && s.data.kind === 'employee' && (role?.hard_no_egress || effectiveNetwork(s) === 'none'))
    return deny('POL_DRF_HARD_01', 'HardDenyViolationError: POL_DRF_HARD_01 - ZERO network egress allowed',
      `${s.data.label} has network mode none, so it can never reach the internet. Remove this cable. If the work truly needs the web, give that job to a Scout and route it through SSRFGuard.`);
  if (!hasPort(s, 'out', kind) || !hasPort(t, 'in', kind))
    return deny('POL_DEFAULT_DENY', `${s.data.label} has no ${kind} output or ${t.data.label} has no ${kind} input.`, 'Drag from a port of the cable type you want to a port of the same color.');
  if (!linked(kind, s, t)) {
    if (kind === 'EGRESS_NETWORK' && s.data.kind === 'employee')
      return deny('POL_DEFAULT_DENY', 'Outbound traffic must go through SSRFGuard first. Connect this employee to SSRFGuard.', 'Add an SSRFGuard, wire the employee to it, then wire SSRFGuard to Approved Sources.');
    return deny('POL_DEFAULT_DENY', `${kind} cannot connect ${s.data.kind} to ${t.data.kind}.`, `Allowed ${kind} links: ${linkText(kind)}.`);
  }
  if (kind === 'EGRESS_NETWORK' && s.data.kind === 'employee' && !isPermitted(s.data.role, 'web:read'))
    return deny('POL_RBAC_DENY', `Role ${s.data.role} has no web:read permission in ROLE_PERMISSIONS.`, 'Only roles with web:read (Scout, Context, Integration Specialist) may reach SSRFGuard.');
  if (kind === 'MEMORY_BUS') {
    const tier = getRole(t.data.role)?.memory_tier;
    if (!tier) return deny('POL_DEFAULT_DENY', `${t.data.label} is not a memory tier.`);
    if (!memoryPermitted(s.data.role, tier, access))
      return deny('POL_RBAC_DENY', `Role ${s.data.role} has no permission to ${access} ${tier} (ROLE_PERMISSIONS).`,
        access === 'write' ? `Switch this cable to read, or use a role that is allowed to write ${tier}.` : `Connect to a tier this role may read, or choose a role that is allowed on ${tier}.`);
  }
  return OK;
}
export function checkCable(s: SNode, t: SNode, hint?: CableKind, access: 'read' | 'write' = 'read'): { kind: CableKind | null; verdict: Verdict } {
  if (s.id === t.id) return { kind: hint ?? null, verdict: deny('POL_DEFAULT_DENY', 'A node cannot be wired to itself.') };
  const kind = hint ?? inferKind(s, t);
  if (!kind) return { kind, verdict: deny('POL_DEFAULT_DENY', `No cable type connects ${s.data.kind} to ${t.data.kind}.`) };
  return { kind, verdict: verdictFor(kind, s, t, access) };
}
/** Check a React Flow connection by its typed handles. */
export function checkConnection(s: SNode, t: SNode, sourceHandle?: string | null, targetHandle?: string | null) {
  const sp = parsePort(sourceHandle), tp = parsePort(targetHandle);
  if (sp && tp && sp.cable !== tp.cable)
    return { kind: sp.cable as CableKind | null, verdict: deny('POL_PORT_MISMATCH', `A ${sp.cable} output cannot plug into a ${tp.cable} input.`, 'Match the port colors: drag to an input of the same cable type.') as Verdict };
  return checkCable(s, t, sp?.cable ?? tp?.cable);
}
/** While dragging from a port: which nodes can receive it? Lights compatible ports, dims the rest. */
export function compatibleNodes(source: SNode, cable: CableKind, fromDirection: 'out' | 'in', nodes: SNode[]): Set<string> {
  const ok = new Set<string>();
  for (const n of nodes) {
    if (n.id === source.id || n.data.kind === 'zone') continue;
    const [s, t] = fromDirection === 'out' ? [source, n] : [n, source];
    if (verdictFor(cable, s, t).ok) ok.add(n.id);
  }
  return ok;
}
