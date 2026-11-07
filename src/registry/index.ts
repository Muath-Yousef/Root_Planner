import type { Horizon, NodeKind } from '../types';
import type { PortDef, RoleDefinition } from './definitions';
import { DEFAULT_PORTS } from './ports';
import { isVisibleAt } from './horizon';

export * from './definitions';
export * from './ports';
export * from './horizon';
export * from './cables';
export * from './scenarios';

const ROLES = new Map<string, RoleDefinition>();
const listeners = new Set<() => void>();
let version = 0;
const bump = () => { version++; listeners.forEach((l) => l()); };

export function registerRoles(input: RoleDefinition | RoleDefinition[]): void {
  for (const def of Array.isArray(input) ? input : [input]) ROLES.set(def.id, def);
  bump();
}
export const registerRole = registerRoles;
export function unregisterRole(id: string): void { if (ROLES.delete(id)) bump(); }
export const subscribeRegistry = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const getRegistryVersion = () => version;

export const getRole = (id: string): RoleDefinition | undefined => ROLES.get(id);
export const listRoles = (): RoleDefinition[] => [...ROLES.values()];
export const portsFor = (kind: NodeKind, role?: string): PortDef[] => (role ? getRole(role)?.ports : undefined) ?? DEFAULT_PORTS[kind];

const ORDER = ['Command', 'Employees', 'Memory', 'Guards', 'External', 'Zones'];
export function dockCategories(horizon: Horizon): string[] {
  const present = new Set(listRoles().filter((r) => isVisibleAt(r.architecture_horizon, horizon)).map((r) => r.category));
  return [...ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !ORDER.includes(c))];
}
export function dockTemplates(horizon: Horizon, query = '', lang: 'en' | 'ar' = 'en'): RoleDefinition[] {
  const q = query.trim().toLowerCase();
  return listRoles().filter((r) => isVisibleAt(r.architecture_horizon, horizon) && (!q || [r.id, r.label.en, r.label.ar, r.description[lang]].some((s) => s.toLowerCase().includes(q))));
}

export function getRoleHelp(def: RoleDefinition) {
  if (def.help) return def.help;
  return {
    purpose: {
      en: def.description.en,
      ar: def.description.ar,
    },
    when_to_use: {
      en: `Use ${def.label.en} in the ${def.category} layer to provide ${def.kind} capabilities.`,
      ar: `استخدم ${def.label.ar} في طبقة ${def.category} لتقديم قدرات ${def.kind}.`,
    },
    how_to_connect: {
      en: `Connect using standard cables following ${def.ref ?? 'reference'} role constraints.`,
      ar: `قم بالتوصيل باستخدام كوابل البروتوكول المعتمدة وفق قيود ${def.ref ?? 'المرجع'}.`,
    },
  };
}

import commandRoles from './roles/command';
import employeeRoles from './roles/employees';
import infraRoles from './roles/infrastructure';
import zoneRoles from './roles/zones';
import influencerRoles from './roles/influencer';

registerRoles(commandRoles);
registerRoles(employeeRoles);
registerRoles(infraRoles);
registerRoles(zoneRoles);
registerRoles(influencerRoles);
