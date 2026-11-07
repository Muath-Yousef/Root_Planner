import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { buildBundle } from '../src/engine/bundleExporter';
import { buildReferenceTopology } from '../src/presets/referenceTopology';
import { defaultConfigs } from '../src/presets/defaultConfigs';
import { createProject } from '../src/presets/startTemplates';
import { parseProjectText, serializeProject } from '../src/persistence/projectIO';
import { PEP_BEGIN, PEP_END, PEP_BLOCK } from '../src/engine/generators';

const REPO_ROOT = typeof __dirname !== 'undefined' ? path.resolve(__dirname, '..') : '.';
const MASTER_REF_PATH = path.join(REPO_ROOT, 'MASTER_REFERENCE_v1.1_fea52b40.md');

describe('Oracle Checks from Raw Master Reference', () => {
  it('1. Embedded PEP block (PEP_BEGIN..PEP_END) matches reference requirements (SCA-002)', () => {
    expect(fs.existsSync(MASTER_REF_PATH)).toBe(true);
    const refContent = fs.readFileSync(MASTER_REF_PATH, 'utf8');

    // The reference mandates 4 interceptors in §2.4.2:
    // 1. Kill-Switch Interceptor
    // 2. Budget Pre-Reserve Interceptor
    // 3. Policy Validation Interceptor
    // 4. Ephemerality & Memory Wipe Interceptor
    expect(refContent).toContain('SCA-002');
    expect(refContent).toContain('Policy Enforcement Point');

    expect(PEP_BLOCK).toContain(PEP_BEGIN);
    expect(PEP_BLOCK).toContain(PEP_END);
    expect(PEP_BLOCK).toContain('assert_employee_active');
    expect(PEP_BLOCK).toContain('budget_guard.reserve');
    expect(PEP_BLOCK).toContain('policy_engine.enforce');
    expect(PEP_BLOCK).toContain('working_memory.wipe');
  });

  it('2. Project export -> import -> export is 100% byte-identical', () => {
    const projResult = createProject({
      name: 'Oracle Reference Dept',
      tenant_id: 'oracle_tenant',
      template: 'reference',
    });

    expect(projResult.ok).toBe(true);
    if (!projResult.ok) return;

    // Export 1
    const jsonExport1 = serializeProject(projResult.project);

    // Import
    const importResult = parseProjectText(jsonExport1);
    expect(importResult.ok).toBe(true);
    if (!importResult.ok) return;

    // Export 2
    const jsonExport2 = serializeProject(importResult.project);

    // Byte-identical assertion
    expect(jsonExport2).toBe(jsonExport1);
    expect(new TextEncoder().encode(jsonExport2)).toEqual(new TextEncoder().encode(jsonExport1));
  });

  it('3. Reference Department bundle compiles cleanly with py_compile and validates against schemas via Python Oracle', () => {
    const cfg = defaultConfigs();
    const topo = buildReferenceTopology('socroot-core');
    const r = buildBundle(topo.nodes, topo.edges, cfg, 'socroot-core');

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const tmpDir = path.join('/tmp', `oracle-bundle-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      for (const file of r.bundle.files) {
        const dest = path.join(tmpDir, file.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, file.content, 'utf8');
      }

      // Execute independent Python validator
      const scriptPath = path.join(REPO_ROOT, 'scripts', 'oracle-validate.py');
      let pyOutput = '';
      try {
        pyOutput = execSync(`python3 "${scriptPath}" "${tmpDir}"`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (err: any) {
        console.error('Python Oracle Output:\n', err.stdout, '\nError:\n', err.stderr);
        throw err;
      }

      expect(pyOutput).toContain('ALL INDEPENDENT PYTHON ORACLE CHECKS PASSED');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
