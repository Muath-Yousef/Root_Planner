import { StudioNode } from './nodes/StudioNode';
import { ZoneNode } from './nodes/ZoneNode';
import { ProtocolEdge } from './edges/ProtocolEdge';
/** Module-level constants: React Flow warns (and re-mounts) if these objects change identity between renders. */
export const nodeTypes = { studio: StudioNode, zone: ZoneNode };
export const edgeTypes = { protocol: ProtocolEdge };
