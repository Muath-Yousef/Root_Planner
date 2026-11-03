/** Studio-owned schema for the .socroot.json file (not one of the six reference schemas). */
export const CURRENT_FORMAT_VERSION = 2;
export const projectSchema = {
  $id: 'socroot-studio/project/v2', title: 'Socroot project file', type: 'object',
  required: ['format_version', 'app', 'id', 'name', 'tenant', 'horizon', 'nodes', 'edges', 'configs'],
  properties: {
    format_version: { const: CURRENT_FORMAT_VERSION }, app: { const: 'socroot-topology-studio' },
    id: { type: 'string', minLength: 1 }, name: { type: 'string', minLength: 1 },
    tenant: { type: 'object', required: ['tenant_id', 'isolation', 'name'], properties: { tenant_id: { type: 'string', minLength: 1 }, isolation: { enum: ['logical_rls', 'dedicated'] }, name: { type: 'string' } } },
    horizon: { enum: ['CURRENT', 'TRANSITIONAL', 'TARGET'] },
    nodes: { type: 'array', items: { type: 'object', required: ['id', 'position', 'data'], properties: { id: { type: 'string' }, position: { type: 'object', required: ['x', 'y'], properties: { x: { type: 'number' }, y: { type: 'number' } } }, data: { type: 'object', required: ['label', 'kind', 'role', 'status'], properties: { label: { type: 'string' }, kind: { type: 'string' }, role: { type: 'string' }, status: { type: 'string' } } } } } },
    edges: { type: 'array', items: { type: 'object', required: ['id', 'source', 'target', 'data'], properties: { id: { type: 'string' }, source: { type: 'string' }, target: { type: 'string' }, data: { type: 'object', required: ['kind'], properties: { kind: { type: 'string' } } } } } },
    configs: { type: 'object', required: ['model_routing', 'sources_watchlist', 'pricing_config'], properties: { model_routing: { type: 'string' }, sources_watchlist: { type: 'string' }, pricing_config: { type: 'string' } } },
  },
} as const;
