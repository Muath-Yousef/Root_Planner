import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { decide, type Decision } from '../src/engine/scoringEngine';
import { checkCable, verdictFor } from '../src/engine/cablingValidator';
import { editDocument } from '../src/engine/inspectorEdit';
import { validateDoc } from '../src/schemas/validator';
import { buildReferenceTopology } from '../src/presets/referenceTopology';
import { listRoles, CABLE_KINDS, CABLE_DEFS } from '../src/registry';
import type { SNode } from '../src/types';

describe('Property Tests with fast-check', () => {
  describe('Property 1: decide() monotonicity, thresholds & coverage', () => {
    it('always returns a valid decision for any score in [0, 100]', () => {
      fc.assert(
        fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (score) => {
          const res = decide(score);
          expect(['FAST_TRACK', 'PROCEED', 'ESCALATE', 'ABORT']).toContain(res.decision);
        })
      );
    });

    it('reaches all four outcomes across explicit representative bands', () => {
      expect(decide(95).decision).toBe('FAST_TRACK');
      expect(decide(85).decision).toBe('FAST_TRACK');
      expect(decide(75).decision).toBe('PROCEED');
      expect(decide(70).decision).toBe('PROCEED');
      expect(decide(55).decision).toBe('ESCALATE');
      expect(decide(30).decision).toBe('ABORT');
      expect(decide(0).decision).toBe('ABORT');
    });

    it('returns ESCALATE strictly for the unspecified band [40.0, 49.999]', () => {
      fc.assert(
        fc.property(fc.double({ min: 40.0, max: 49.99999, noNaN: true }), (score) => {
          const res = decide(score);
          expect(res.decision).toBe('ESCALATE');
          expect(res.band).toContain('40.0–49.9');
        })
      );
    });

    it('is monotonic: higher scores produce strictly equal or higher decision tiers', () => {
      const rank: Record<Decision, number> = {
        ABORT: 0,
        ESCALATE: 1,
        PROCEED: 2,
        FAST_TRACK: 3,
      };

      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 100, noNaN: true }),
          fc.double({ min: 0, max: 100, noNaN: true }),
          (s1, s2) => {
            const low = Math.min(s1, s2);
            const high = Math.max(s1, s2);
            const rLow = rank[decide(low).decision];
            const rHigh = rank[decide(high).decision];
            expect(rHigh).toBeGreaterThanOrEqual(rLow);
          }
        )
      );
    });
  });

  describe('Property 2: Cabling Validator Security Invariants', () => {
    const roles = listRoles();
    const roleKeys = roles.map((r) => r.id);

    const nodeArbitrary = (id: string) =>
      fc.record({
        role: fc.constantFrom(...roleKeys),
        networkMode: fc.constantFrom('none', 'bridge', 'host', undefined),
      }).map(({ role, networkMode }): SNode => {
        const def = roles.find((r) => r.id === role)!;
        return {
          id,
          type: 'socNode',
          position: { x: 0, y: 0 },
          data: {
            kind: def.kind,
            role: def.id,
            label: def.label.en,
            status: 'IMPLEMENTED',
            networkMode: networkMode as any,
          },
        };
      });

    it('no accepted cable gives network egress to a drafter, an evaluator, or any networkMode: none node', () => {
      fc.assert(
        fc.property(
          nodeArbitrary('node_source'),
          nodeArbitrary('node_target'),
          (sNode, tNode) => {
            const { verdict } = checkCable(sNode, tNode, 'EGRESS_NETWORK');
            const role = roles.find((r) => r.id === sNode.data.role);

            const isRestrictedEgress =
              sNode.data.kind === 'employee' &&
              (role?.hard_no_egress || sNode.data.networkMode === 'none' || role?.network === 'none' || role?.id === 'drafter' || role?.id === 'evaluator');

            if (isRestrictedEgress) {
              expect(verdict.ok).toBe(false);
            }

            if (verdict.ok) {
              expect(role?.hard_no_egress).not.toBe(true);
              expect(sNode.data.networkMode).not.toBe('none');
              expect(role?.network).not.toBe('none');
              expect(sNode.data.role).not.toBe('drafter');
              expect(sNode.data.role).not.toBe('evaluator');
            }
          }
        )
      );
    });

    it('every accepted cable kind matches an allowed link in CABLE_DEFS', () => {
      fc.assert(
        fc.property(
          nodeArbitrary('src_node'),
          nodeArbitrary('tgt_node'),
          fc.constantFrom(...CABLE_KINDS),
          (s, t, kind) => {
            const v = verdictFor(kind, s, t);
            if (v.ok) {
              const def = CABLE_DEFS[kind];
              const matchesFrom = def.links.some(
                (l) => (!l.from.kinds || l.from.kinds.includes(s.data.kind)) && (!l.from.roles || l.from.roles.includes(s.data.role))
              );
              const matchesTo = def.links.some(
                (l) => (!l.to.kinds || l.to.kinds.includes(t.data.kind)) && (!l.to.roles || l.to.roles.includes(t.data.role))
              );
              expect(matchesFrom && matchesTo).toBe(true);
            }
          }
        )
      );
    });
  });

  describe('Property 3: Inspector Edit Document Validity', () => {
    it('editing contract with valid JSON updates the node and validateDoc validates it', () => {
      const topo = buildReferenceTopology();
      const node = topo.nodes.find((n) => n.id === 'drf')!;
      const contract = node.data.employee?.contract;
      const validContract = JSON.stringify(contract, null, 2);

      const edit = editDocument(node, 'socroot-core', 'contract', validContract);
      expect(edit.ok).toBe(true);
      if (edit.ok) {
        expect(edit.issues.length).toBe(0);
        const issues = validateDoc('contract', edit.node.data.employee?.contract);
        expect(issues.length).toBe(0);
      }
    });
  });
});
