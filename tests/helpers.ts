import { buildReferenceTopology } from '../src/presets/referenceTopology';
import type { SNode } from '../src/types';
export const ref = () => buildReferenceTopology('socroot-core');
export const node = (nodes: SNode[], id: string): SNode => nodes.find((n) => n.id === id)!;
