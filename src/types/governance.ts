import type { NetworkMode } from './model';
/** §4.3.1 */
export type PolicyOutcome = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL' | 'REQUIRE_ESCALATION';
export interface PolicyDecision { policy_id: string; outcome: PolicyOutcome; reason: string; tier: 1 | 2 | 3 | 4 | 5 }
export interface Principal { employee_id: string; role: string; tenant_id: string; department: string; networkMode: NetworkMode }
export interface PolicyContext {
  url?: string; method?: string; fit_score?: number; budget_breach?: boolean;
  founder_signed_token?: unknown; founder_approved?: boolean;
  tenant_id?: string; confidentiality?: number; clearance?: number; kill_active?: boolean;
}
