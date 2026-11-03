import { useState, useMemo } from 'react';
import type { SNode } from '../../../types';
import { buildLlmContext, retrieveForTenant, CONTEXT_LAYERS, type ContextInput, type MemoryItem } from '../../../engine/contextBuilder';
import { useStudio } from '../../../store/useStudioStore';
import { useT } from '../../../i18n/useT';
import { getRole } from '../../../registry';

interface ContextTabProps {
  node: SNode;
}

export function ContextTab({ node }: ContextTabProps) {
  const tr = useT();
  const tenantId = useStudio((s) => s.tenant_id);
  const emp = node.data.employee;
  const contract = emp?.contract as Record<string, unknown> | undefined;

  const [activeLayer, setActiveLayer] = useState<string>('all');
  const [retrievalLimit, setRetrievalLimit] = useState<number>(3);

  // Mock sample memory pool to demonstrate TEN-003 tenant isolation filter
  const sampleMemories: MemoryItem[] = useMemo(() => [
    { id: 'mem-001', tenant_id: tenantId, text: 'Standard SLA requirement: < 30s response time.', score: 0.95 },
    { id: 'mem-002', tenant_id: tenantId, text: 'Opportunity acquisition guidelines v2.1 approved.', score: 0.88 },
    { id: 'mem-003', tenant_id: 'other-tenant', text: 'Confidential client proprietary pricing model.', score: 0.99 },
    { id: 'mem-004', tenant_id: tenantId, text: 'Previous proposal won grant with 91.5% fit score.', score: 0.72 },
  ], [tenantId]);

  const filteredMemories = useMemo(() => {
    return retrieveForTenant(sampleMemories, tenantId, retrievalLimit);
  }, [sampleMemories, tenantId, retrievalLimit]);

  const roleDef = getRole(node.data.role);

  const contextInput: ContextInput = useMemo(() => {
    const identityPrompt = roleDef?.employee?.identity_prompt ?? `You are ${node.data.label} (${node.data.role}).`;
    const policyConstraints = roleDef?.employee?.policies ?? ['POL_DEFAULT_DENY', 'POL_AUDIT_IMMUTABILITY'];
    const objective = String(contract?.mission ?? roleDef?.employee?.mission ?? 'Execute role task objectives deterministically.');
    const successCriteria = roleDef?.employee?.scorecard ?? ['sla_compliance', 'quality_benchmark'];
    const evidenceText = 'Grounded source document reference verified via SSRFGuard.';
    const workingMemory = {
      current_step: 'Steps 4+5: Model Call & Early Abort Gate',
      decision_trail: ['Receive valid dispatch', 'Reserve $0.005 budget', 'Kill switch clear'],
      running_cost_usd: 0.0045,
      has_results: true,
    };
    const historicalContext = filteredMemories.included.map((m) => `[${m.id}] ${m.text}`).join('\n');

    return {
      identity_prompt: identityPrompt,
      policy_constraints: policyConstraints,
      objective,
      success_criteria: successCriteria,
      evidence_text: evidenceText,
      working_memory: workingMemory,
      historical_context: historicalContext,
    };
  }, [roleDef, node.data.label, node.data.role, contract?.mission, filteredMemories.included]);

  const chatMessages = useMemo(() => {
    return buildLlmContext(contextInput);
  }, [contextInput]);

  return (
    <div className="space-y-4 text-xs text-slate-300">
      <div className="rounded border border-slate-700 bg-slate-950 p-3">
        <h3 className="font-semibold text-slate-100 flex items-center justify-between">
          <span>{tr('context.title')}</span>
          <span className="font-mono text-[10px] text-sky-400">§5.2.2 · 6-Layer Order</span>
        </h3>
        <p className="mt-1 text-slate-400">{tr('context.description')}</p>
      </div>

      {/* Layer Filter Buttons */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setActiveLayer('all')}
          className={`rounded px-2 py-1 text-[11px] ${
            activeLayer === 'all' ? 'bg-sky-600 text-white font-medium' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          {tr('context.layer.all')}
        </button>
        {CONTEXT_LAYERS.map((layer, idx) => (
          <button
            key={layer}
            onClick={() => setActiveLayer(layer)}
            className={`rounded px-2 py-1 font-mono text-[11px] ${
              activeLayer === layer ? 'bg-sky-600 text-white font-medium' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            L{idx + 1}: {layer}
          </button>
        ))}
      </div>

      {/* Tenant Isolation Filter (TEN-003) */}
      <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-200">{tr('context.tenant.filter')} (TEN-003)</span>
          <span className="font-mono text-[10px] text-emerald-400">{tenantId}</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          <div>{tr('context.tenant.included')}: <span className="text-emerald-300 font-mono">{filteredMemories.included.length}</span></div>
          <div>{tr('context.tenant.dropped')}: <span className="text-rose-400 font-mono">{filteredMemories.dropped.length}</span></div>
        </div>
        {filteredMemories.dropped.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {filteredMemories.dropped.map((d) => (
              <div key={d.id} className="text-[10px] text-rose-300 font-mono bg-rose-950/40 p-1 rounded">
                ✗ {d.id} ({d.reason === 'TENANT_MISMATCH' ? tr('context.tenant.mismatch') : tr('context.tenant.limit')})
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assembled Chat Messages Preview */}
      <div className="space-y-2">
        <div className="font-medium text-slate-200">{tr('context.messages.title')} ({chatMessages.length})</div>
        {chatMessages.map((msg, i) => (
          <div key={i} className="rounded border border-slate-800 bg-slate-950 p-2 font-mono text-[11px]">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span className="uppercase text-amber-400 font-bold">[{msg.role}]</span>
              <span>Msg #{i + 1}</span>
            </div>
            <pre className="whitespace-pre-wrap text-slate-300 text-[10px] max-h-40 overflow-y-auto" dir="ltr">
              {msg.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
