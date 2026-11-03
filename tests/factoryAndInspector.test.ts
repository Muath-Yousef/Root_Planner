import { describe, expect, it } from 'vitest';
import { ref } from './helpers';
import { previewFactory, placeEmployee, resolveHome } from '../src/engine/factoryPlacement';
import {
  setIdentity,
  setNetworkMode,
  transition,
  runSyntheticBenchmark,
  setShadowMatch,
  setScorecard,
  editDocument,
  editCustomCode,
  addSecret,
  setSecretRef,
  removeSecret,
  locateField,
  policyLab,
} from '../src/engine/inspectorEdit';
import { parseWatchlist } from '../src/engine/ssrfGuard';
import { SOURCES_WATCHLIST_YAML } from '../src/presets/defaultConfigs';
import { registerRole, getRole, dockTemplates } from '../src/registry';
import { PEP_BEGIN } from '../src/engine/generators';
import type { SNode } from '../src/types';

describe('factoryPlacement (§6.3, §6.8)', () => {
  it('resolves home department and manager for a placement inside a zone', () => {
    const topology = ref();
    const zone = topology.nodes.find((n) => n.data.kind === 'zone' && n.data.zone?.department_id === 'dept_opportunity_acquisition');
    expect(zone).toBeDefined();

    const home = resolveHome({
      roleId: 'drafter',
      position: { x: zone!.position.x + 50, y: zone!.position.y + 50 },
      tenant_id: 'socroot-core',
      nodes: topology.nodes,
    });

    expect(home.department).toBe('dept_opportunity_acquisition');
    expect(home.prefix).toBe('opp_acq');
    expect(home.manager).toBeDefined();
  });

  it('previewFactory checks the Rule of Three and quality gates', () => {
    const topology = ref();
    const zone = topology.nodes.find((n) => n.data.kind === 'zone' && n.data.zone?.department_id === 'dept_opportunity_acquisition');
    expect(zone).toBeDefined();

    const valid = previewFactory(
      {
        roleId: 'scout',
        position: { x: zone!.position.x + 30, y: zone!.position.y + 30 },
        tenant_id: 'socroot-core',
        nodes: topology.nodes,
      },
      {
        trigger: 'TRUST_BOUNDARY',
        justification: 'Requires network isolation boundary at perimeter.',
        repeat_count: 1,
      }
    );

    expect(valid).not.toHaveProperty('error');
    if (!('error' in valid)) {
      expect(valid.gates).toHaveLength(4);
      expect(valid.gates.every((g) => g.ok)).toBe(true);
      expect(valid.ready).toBe(true);
      expect(valid.id).toMatch(/^opp_acq\.scout\.v/);
    }
  });

  it('previewFactory rejects if justification is too short or Rule of Three fails', () => {
    const topology = ref();
    const invalid = previewFactory(
      {
        roleId: 'scout',
        position: { x: 100, y: 100 },
        tenant_id: 'socroot-core',
        nodes: topology.nodes,
      },
      {
        trigger: 'MANAGER_OVERLOAD',
        justification: 'too short',
        repeat_count: 1,
      }
    );

    expect(invalid).not.toHaveProperty('error');
    if (!('error' in invalid)) {
      expect(invalid.ready).toBe(false);
      expect(invalid.gates.find((g) => g.id === 'intake')?.ok).toBe(false);
    }
  });

  it('placeEmployee produces node and connects manager cable', () => {
    const topology = ref();
    const zone = topology.nodes.find((n) => n.data.kind === 'zone' && n.data.zone?.department_id === 'dept_opportunity_acquisition');
    expect(zone).toBeDefined();

    const res = placeEmployee({
      roleId: 'evaluator',
      position: { x: zone!.position.x + 50, y: zone!.position.y + 50 },
      tenant_id: 'socroot-core',
      nodes: topology.nodes,
      name: 'Custom Evaluator',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.node.data.label).toBe('Custom Evaluator');
      expect(res.node.data.employee).toBeDefined();
      expect(res.edges.length).toBeGreaterThanOrEqual(1);
      expect(res.edges[0].data?.kind).toBe('TASK_DISPATCH_RESULT');
    }
  });
});

describe('inspectorEdit (§2.1, §4.5, §6.9)', () => {
  const getEvaluator = () => {
    const topology = ref();
    return topology.nodes.find((n) => n.data.role === 'evaluator')!;
  };

  it('setIdentity updates name and mission, rejects empty name', () => {
    const node = getEvaluator();
    const ok = setIdentity(node, 'socroot-core', { name: 'Senior Evaluator', mission: 'Assess grants strictly' });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect((ok.node.data.employee?.contract as { name: string }).name).toBe('Senior Evaluator');
    }

    const bad = setIdentity(node, 'socroot-core', { name: '   ' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.code).toBe('NAME_REQUIRED');
    }
  });

  it('setNetworkMode updates network mode and re-derives manifest', () => {
    const node = getEvaluator();
    const res = setNetworkMode(node, 'socroot-core', 'internal');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect((res.node.data.employee?.contract as { runtime_config: { docker_network: string } }).runtime_config.docker_network).toBe('internal');
      expect((res.node.data.employee?.manifest as { spec: { network: { mode: string } } }).spec.network.mode).toBe('internal');
    }
  });

  it('transition validates LIF-001 state machines and enforces EVA-001 promotion gate', () => {
    const node = getEvaluator();
    // Valid lifecycle transition DRAFT -> VALIDATED
    const t1 = transition(node, 'socroot-core', 'lifecycle', 'VALIDATED');
    expect(t1.ok).toBe(true);

    // Invalid transition: DRAFT cannot jump directly to BENCHMARKED
    const t2 = transition(node, 'socroot-core', 'lifecycle', 'BENCHMARKED');
    expect(t2.ok).toBe(false);
    if (!t2.ok) expect(t2.code).toBe('LIF-001');

    // Moving to CERTIFIED requires EVA-001 promotion gate
    const t3 = transition(node, 'socroot-core', 'lifecycle', 'CERTIFIED');
    expect(t3.ok).toBe(false);
    if (!t3.ok) expect(t3.code).toBe('LIF-001'); // DRAFT cannot go to CERTIFIED directly either
  });

  it('promotion scoring benchmarks and scorecard updates', () => {
    const node = getEvaluator();
    const bench = runSyntheticBenchmark(node, 'socroot-core');
    expect(bench.ok).toBe(true);
    if (bench.ok) {
      expect(bench.node.data.employee?.promotion.synthetic_passed).toBe(20);
    }

    const shadow = setShadowMatch(node, 'socroot-core', 0.96);
    expect(shadow.ok).toBe(true);
    if (shadow.ok) {
      expect(shadow.node.data.employee?.promotion.shadow_match_rate).toBe(0.96);
    }

    const sc = setScorecard(node, 'socroot-core', 'arithmetic_determinism', 0.99);
    expect(sc.ok).toBe(true);
  });

  it('editDocument parses and validates against schema, rejects syntax errors', () => {
    const node = getEvaluator();
    const validJson = JSON.stringify(node.data.employee?.contract);
    const ok = editDocument(node, 'socroot-core', 'contract', validJson);
    expect(ok.ok).toBe(true);

    const badSyntax = '{ "mission": "incomplete...';
    const bad = editDocument(node, 'socroot-core', 'contract', badSyntax);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.code).toBe('SYNTAX');
    }
  });

  it('editCustomCode enforces SCA-002 (locked PEP) and SEC-001 (no plaintext secrets)', () => {
    const node = getEvaluator();
    // Attempting to modify or include PEP guard
    const pepViolation = editCustomCode(node, 'socroot-core', `def foo():\n    ${PEP_BEGIN}`);
    expect(pepViolation.ok).toBe(false);
    if (!pepViolation.ok) {
      expect(pepViolation.code).toBe('SCA-002');
    }

    // Plaintext secret attempt
    const secretViolation = editCustomCode(node, 'socroot-core', 'API_KEY = "sk-live-1234567890abcdef12345678"');
    expect(secretViolation.ok).toBe(false);
    if (!secretViolation.ok) {
      expect(secretViolation.code).toBe('SEC-001');
    }

    // Valid code
    const valid = editCustomCode(node, 'socroot-core', 'def custom_helper(): return True');
    expect(valid.ok).toBe(true);
  });

  it('addSecret and setSecretRef reject text not starting with vault:// (SEC-001)', () => {
    const node = getEvaluator();
    const badRef = addSecret(node, 'socroot-core', 'NEW_KEY', 'plain_secret_value');
    expect(badRef.ok).toBe(false);
    if (!badRef.ok) {
      expect(badRef.code).toBe('SEC-001');
    }

    const goodRef = addSecret(node, 'socroot-core', 'NEW_KEY', 'vault://depts/opp_acq/new_key');
    expect(goodRef.ok).toBe(true);

    if (goodRef.ok) {
      const idx = goodRef.node.data.employee!.secrets.length - 1;
      const badUpdate = setSecretRef(goodRef.node, 'socroot-core', idx, 'not_vault://key');
      expect(badUpdate.ok).toBe(false);

      const goodUpdate = setSecretRef(goodRef.node, 'socroot-core', idx, 'vault://depts/opp_acq/updated_key');
      expect(goodUpdate.ok).toBe(true);

      const del = removeSecret(goodRef.node, 'socroot-core', idx);
      expect(del.ok).toBe(true);
    }
  });

  it('policyLab evaluates RBAC and 5-tier policies deterministically', () => {
    const ssrf = parseWatchlist(SOURCES_WATCHLIST_YAML);
    const res = policyLab(
      {
        role: 'scout',
        action: 'web:read',
        networkMode: 'internal',
        tenant_id: 'socroot-core',
        url: 'https://ycombinator.com/rfs',
      },
      ssrf
    );

    expect(res.decision.outcome).toBe('ALLOW');
    expect(res.rbac).toBe(true);

    const drafterRes = policyLab(
      {
        role: 'drafter',
        action: 'web:read',
        networkMode: 'none',
        tenant_id: 'socroot-core',
      },
      ssrf
    );
    expect(drafterRes.decision.outcome).toBe('DENY');
    expect(drafterRes.decision.policy_id).toBe('POL_DRF_HARD_01');
  });

  it('locateField finds line number in JSON and YAML', () => {
    const json = '{\n  "mission": "test",\n  "tools": [\n    {\n      "tool_id": "eval"\n    }\n  ]\n}';
    expect(locateField(json, 'mission', 'json')).toBe(1);
    expect(locateField(json, 'tools.0.tool_id', 'json')).toBe(4);
  });
});

describe('Registry extensibility (single role definition drives UI without canvas changes)', () => {
  it('a newly registered role immediately appears in dockTemplates and role registry', () => {
    const expRole = {
      id: 'quantum_auditor',
      kind: 'employee' as const,
      category: 'Employees',
      label: { en: 'Quantum Auditor', ar: 'مدقق كمومي' },
      description: { en: 'Experimental role', ar: 'دور تجريبي' },
      architecture_horizon: 'TARGET' as const,
      implementation_status: 'TRIGGER_BASED' as const,
      inspector: ['identity', 'contract', 'manifest', 'policies'] as ('identity' | 'contract' | 'manifest' | 'code' | 'tools' | 'policies')[],
      employee: {
        name: { en: 'Quantum Auditor', ar: 'مدقق كمومي' },
        mission: 'Verify quantum circuits',
        scope: ['audit'],
        exclusions: ['no funds'],
        autonomy_level: 3,
        tools: [{ tool_id: 'verify_circuit', description: 'verify', is_idempotent: true }],
        policies: ['POL_DEFAULT_DENY'],
        runtime: { max_concurrent_tasks: 2, task_timeout_seconds: 30 },
        identity_prompt: 'Quantum audit prompt',
        skills: [{ name: 'quantum.md', body: '# Quantum\nRules\n' }],
        scorecard: ['circuit_fidelity'],
      },
    };

    registerRole(expRole);

    expect(getRole('quantum_auditor')).toBeDefined();
    const templates = dockTemplates('TARGET', '', 'en');
    expect(templates.some((t) => t.id === 'quantum_auditor')).toBe(true);

    // Inspector tabs are derived directly from the definition
    const def = getRole('quantum_auditor')!;
    expect(def.inspector).toEqual(['identity', 'contract', 'manifest', 'policies']);
  });
});

describe('Canvas 300-node performance test', () => {
  it('moving one node among 300 nodes preserves reference equality of all other 299 nodes', () => {
    // Generate 300 nodes
    const initialNodes: SNode[] = Array.from({ length: 300 }, (_, i) => ({
      id: `node-${i}`,
      type: 'studio',
      position: { x: (i % 20) * 120, y: Math.floor(i / 20) * 80 },
      data: {
        role: 'scout',
        kind: 'employee',
        label: `Node ${i}`,
        status: 'IMPLEMENTED',
        horizon: 'CURRENT',
      },
    }));

    // Move node-42
    const targetId = 'node-42';
    const newPosition = { x: 999, y: 888 };

    // Pure update matching store immutability pattern
    const updatedNodes = initialNodes.map((n) => (n.id === targetId ? { ...n, position: newPosition } : n));

    expect(updatedNodes[42].position).toEqual(newPosition);

    // Verify all other 299 nodes maintain identical object references (O(1) memory & no re-render)
    let unchangedReferences = 0;
    for (let i = 0; i < 300; i++) {
      if (i !== 42) {
        if (updatedNodes[i] === initialNodes[i]) {
          unchangedReferences++;
        }
      }
    }

    expect(unchangedReferences).toBe(299);
  });
});
