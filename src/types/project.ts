import type { Horizon, IsolationMode, SEdge, SNode } from './model';
export interface ProjectConfigs { model_routing: string; sources_watchlist: string; pricing_config: string }
export interface TenantRef { tenant_id: string; isolation: IsolationMode; name: string }
export interface ProjectFile {
  format_version: number; app: 'socroot-topology-studio';
  id: string; name: string; tenant: TenantRef; horizon: Horizon;
  created_at: string; updated_at: string;
  nodes: SNode[]; edges: SEdge[]; configs: ProjectConfigs;
}
