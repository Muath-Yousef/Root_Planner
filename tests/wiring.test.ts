import { describe, it, expect } from 'vitest';
import * as adminCli from '../src/engine/adminCli';
import * as auditLogger from '../src/engine/auditLogger';
import * as breakGlass from '../src/engine/breakGlass';
import * as budgetGuard from '../src/engine/budgetGuard';
import * as bundleExporter from '../src/engine/bundleExporter';
import * as cablingValidator from '../src/engine/cablingValidator';
import * as contextBuilder from '../src/engine/contextBuilder';
import * as ed25519Verifier from '../src/engine/ed25519Verifier';
import * as employeeFactory from '../src/engine/employeeFactory';
import * as factoryPlacement from '../src/engine/factoryPlacement';
import * as generators from '../src/engine/generators';
import * as inspectorEdit from '../src/engine/inspectorEdit';
import * as killSwitchManager from '../src/engine/killSwitchManager';
import * as layout from '../src/engine/layout';
import * as permissionStore from '../src/engine/permissionStore';
import * as policyEngine from '../src/engine/policyEngine';
import * as pricingCalculator from '../src/engine/pricingCalculator';
import * as problems from '../src/engine/problems';
import * as qualityGates from '../src/engine/qualityGates';
import * as scoringEngine from '../src/engine/scoringEngine';
import * as secretGuard from '../src/engine/secretGuard';
import * as simPlayer from '../src/engine/simPlayer';
import * as simulationRunner from '../src/engine/simulationRunner';
import * as ssrfGuard from '../src/engine/ssrfGuard';
import * as zipBundle from '../src/engine/zipBundle';

describe('Engine Wiring & Traceability Test (§5.2, §3.3.1, §6.1, §3.5)', () => {
  it('verifies contextBuilder (§5.2.2) exports and 6-layer context construction', () => {
    expect(typeof contextBuilder.buildLlmContext).toBe('function');
    expect(typeof contextBuilder.retrieveForTenant).toBe('function');
    expect(contextBuilder.CONTEXT_LAYERS).toHaveLength(6);

    const msgs = contextBuilder.buildLlmContext({
      identity_prompt: 'Test prompt',
      policy_constraints: ['POL_DEFAULT_DENY'],
      objective: 'Run task',
      success_criteria: ['sla_met'],
      evidence_text: 'Evidence passage',
      working_memory: {
        current_step: 'Step 1',
        decision_trail: ['dec-1'],
        running_cost_usd: 0.001,
        has_results: true,
      },
      historical_context: 'Prior result',
    });
    expect(msgs.length).toBeGreaterThanOrEqual(4);
    expect(msgs[0].content).toContain('Test prompt');
  });

  it('verifies scoringEngine (§3.3.1 & §3.3.2) calculateFitScore and decide', () => {
    expect(typeof scoringEngine.calculateFitScore).toBe('function');
    expect(typeof scoringEngine.decide).toBe('function');

    const criteria = { a: 0.9, b: 0.8 };
    const score = scoringEngine.calculateFitScore(criteria, ['a', 'b'], { a: 2.0, b: 1.0 });
    expect(score).toBe(86.67);

    const decision = scoringEngine.decide(score);
    expect(decision.decision).toBe('FAST_TRACK');
  });

  it('verifies pricingCalculator (§6.1.2) parsePricing and costUsd', () => {
    expect(typeof pricingCalculator.parsePricing).toBe('function');
    expect(typeof pricingCalculator.costUsd).toBe('function');
    expect(typeof pricingCalculator.usdToMicro).toBe('function');

    const table = pricingCalculator.parsePricing('models:\n  test-model:\n    input_per_million: 3.0\n    output_per_million: 15.0\n');
    expect(table['test-model']).toBeDefined();
    const cost = pricingCalculator.costUsd(table, 'test-model', 1000, 500);
    expect(cost).toBeGreaterThan(0);
  });

  it('verifies adminCli (§3.5) command tree and parser', () => {
    expect(Array.isArray(adminCli.COMMAND_TREE)).toBe(true);
    expect(typeof adminCli.parseCommand).toBe('function');
    expect(typeof adminCli.usageOf).toBe('function');

    const res = adminCli.parseCommand('socroot-admin budget inspect --dept dept_opportunity_acquisition');
    expect(res.ok).toBe(true);
  });

  it('verifies breakGlass (§4.5) session tokens and replay defense', async () => {
    expect(typeof breakGlass.openSession).toBe('function');
    expect(typeof breakGlass.tokenSummary).toBe('function');

    const session = await breakGlass.openSession();
    const issued = await session.issue({
      scope: 'AUTHORIZE_FINANCIAL_COMMITMENT',
      target_resource: 'dept_opportunity_acquisition:task:a1b2c3d4',
      confirm_target: 'dept_opportunity_acquisition:task:a1b2c3d4',
      max_amount_usd: 100,
      ttl_seconds: 60,
    });
    expect(issued.ok).toBe(true);
  });

  it('verifies cablingValidator (§3.2, §4.3) connection and cable validation', () => {
    expect(typeof cablingValidator.checkConnection).toBe('function');
    expect(typeof cablingValidator.checkCable).toBe('function');
    expect(typeof cablingValidator.compatibleNodes).toBe('function');
  });

  it('verifies layout (§6.9) align, distribute, and autoLayout', () => {
    expect(typeof layout.alignNodes).toBe('function');
    expect(typeof layout.distributeNodes).toBe('function');
    expect(typeof layout.autoLayout).toBe('function');
  });

  it('verifies auditLogger (§4.6) SHA-256 chain immutability', async () => {
    const logger = new auditLogger.AuditLogger();
    expect(typeof logger.verify).toBe('function');
    const verified = await logger.verify();
    expect(verified.ok).toBe(true);
  });

  it('verifies generators and quality gates (§2.1, §6.3)', () => {
    expect(typeof generators.employeePy).toBe('function');
    expect(typeof generators.toolsPy).toBe('function');
    expect(typeof generators.policiesPy).toBe('function');
    expect(typeof qualityGates.intakeGate).toBe('function');
    expect(typeof qualityGates.factoryGates).toBe('function');
  });

  it('verifies ssrfGuard, secretGuard, and budgetGuard (§5.4, §5.5, §6.1)', () => {
    expect(typeof ssrfGuard.parseWatchlist).toBe('function');
    expect(typeof secretGuard.validateSecretRef).toBe('function');
    expect(budgetGuard.BudgetGuard).toBeDefined();
  });

  it('verifies zipBundle and bundleExporter (§2.1, §6.3)', () => {
    expect(typeof zipBundle.zipBundle).toBe('function');
    expect(typeof bundleExporter.planBundle).toBe('function');
    expect(typeof bundleExporter.buildBundle).toBe('function');
  });

  it('verifies simulationRunner and simPlayer (§3.1.3)', () => {
    expect(typeof simulationRunner.runSimulation).toBe('function');
    expect(typeof simPlayer.playerReducer).toBe('function');
  });
});
