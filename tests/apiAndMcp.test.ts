import { describe, it, expect } from 'vitest';
import { buildReferenceTopology } from '../src/presets/referenceTopology';
import { defaultConfigs } from '../src/presets/defaultConfigs';
import { buildBundle } from '../src/engine/bundleExporter';
import { collectProblems } from '../src/engine/problems';
import JSZip from 'jszip';

describe('MCP & REST API Engine Verification', () => {
  it('1. validate_topology correctly passes valid canonical reference topology', () => {
    const topo = buildReferenceTopology('tenant-test');
    const problems = collectProblems(topo.nodes, topo.edges, { tenant_id: 'tenant-test' });
    const errors = problems.filter((p) => p.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('2. topology export bundle generates a valid non-empty zip buffer with required files', async () => {
    const topo = buildReferenceTopology('tenant-test');
    const configs = defaultConfigs();
    const bundleRes = buildBundle(topo.nodes, topo.edges, configs, 'tenant-test');

    expect(bundleRes.ok).toBe(true);
    if (!bundleRes.ok) return;

    const zip = new JSZip();
    for (const f of bundleRes.bundle.files) {
      zip.file(f.path, f.content);
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    expect(buffer.length).toBeGreaterThan(500);

    const loadedZip = await JSZip.loadAsync(buffer);
    expect(loadedZip.file('config/model_routing.yaml')).not.toBeNull();
    expect(loadedZip.file('config/sources_watchlist.yaml')).not.toBeNull();
  });

  it('3. MCP reference topology tool payload matches client node contracts', () => {
    const topo = buildReferenceTopology('socroot-core');
    expect(topo.nodes.length).toBeGreaterThan(0);
    expect(topo.edges.length).toBeGreaterThan(0);

    const employeeNodes = topo.nodes.filter((n) => n.data.kind === 'employee');
    expect(employeeNodes.length).toBeGreaterThan(0);

    for (const emp of employeeNodes) {
      expect(emp.data.employee).toBeDefined();
      expect(emp.data.employee?.contract).toBeDefined();
    }
  });
});
