import { getRole } from '../registry';

/** Python `fnmatch.fnmatchcase` semantics: `*` any run (incl. "/"), `?` one char, `[seq]`, `[!seq]`. Case-sensitive (POSIX). */
export function fnmatch(pattern: string, name: string): boolean {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') { while (pattern[i + 1] === '*') i++; re += '[\\s\\S]*'; }
    else if (c === '?') re += '[\\s\\S]';
    else if (c === '[') {
      let j = i + 1;
      if (pattern[j] === '!') j++;
      if (pattern[j] === ']') j++;
      while (j < pattern.length && pattern[j] !== ']') j++;
      if (j >= pattern.length) { re += '\\['; continue; }
      let body = pattern.slice(i + 1, j).replace(/\\/g, '\\\\');
      const neg = body.startsWith('!');
      if (neg) body = body.slice(1);
      re += `[${neg ? '^' : ''}${body.replace(/\^/g, '\\^').replace(/]/g, '\\]')}]`;
      i = j;
    } else re += c.replace(/[.+^${}()|\\/-]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(name);
}

/** §4.2.2: prohibitions first, then grants, then default deny. */
export function isPermitted(role: string, action: string): boolean {
  const def = getRole(role)?.permissions;
  if (!def) return false;
  if (def.prohibitions.some((p) => fnmatch(p, action))) return false;
  if (def.grants.some((p) => fnmatch(p, action))) return true;
  return false;
}
/** Live views over the registry, shaped like the reference dicts. */
const view = (pick: 'grants' | 'prohibitions') => new Proxy({} as Record<string, string[]>, {
  get: (_t, role) => (typeof role === 'string' ? getRole(role)?.permissions?.[pick] : undefined),
  has: (_t, role) => typeof role === 'string' && !!getRole(role)?.permissions,
});
export const ROLE_PERMISSIONS: Readonly<Record<string, string[]>> = view('grants');
export const ROLE_PROHIBITIONS: Readonly<Record<string, string[]>> = view('prohibitions');

/** Which action a memory tier needs for read/write. L1 is task-scoped and always allowed. */
export const TIER_ACTION: Record<string, { read: string | null; write: string | null }> = {
  L1: { read: null, write: null },
  L2: { read: 'storage:state_read', write: 'storage:state_write' },
  L3: { read: 'storage:vector_read', write: 'storage:vector_write' },
  L4: { read: 'audit:read', write: 'audit:write' },
};
export function memoryPermitted(role: string, tier: 'L1' | 'L2' | 'L3' | 'L4', access: 'read' | 'write'): boolean {
  const a = TIER_ACTION[tier][access];
  return a === null ? true : isPermitted(role, a);
}
