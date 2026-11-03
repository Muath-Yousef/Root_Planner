import { useState } from 'react';
import type { SNode, MemoryTier } from '../../../types';
import { policyLab, addSkill, setSkillBody, removeSkill, type LabResult } from '../../../engine/inspectorEdit';
import { parseWatchlist } from '../../../engine/ssrfGuard';
import { useStudio } from '../../../store/useStudioStore';
import { useT } from '../../../i18n/useT';

interface PoliciesTabProps {
  node: SNode;
}

const COMMON_ACTIONS = [
  'web:read',
  'web:write',
  'model:invoke',
  'storage:state_read',
  'storage:state_write',
  'storage:vector_read',
  'storage:vector_write',
  'storage:audit_modify',
  'funds:commit',
  'funds:allocate',
  'external:submit_proposal',
  'evaluator:score_submit',
  'network:private_ip',
  'network:aws_imds',
];

export function PoliciesTab({ node }: PoliciesTabProps) {
  const tr = useT();
  const applyEdit = useStudio((s) => s.applyEdit);
  const configs = useStudio((s) => s.configs);
  const tenant_id = useStudio((s) => s.tenant_id);
  const emp = node.data.employee;

  // Lab state
  const [action, setAction] = useState('web:read');
  const [memoryTier, setMemoryTier] = useState<MemoryTier | ''>('');
  const [memoryAccess, setMemoryAccess] = useState<'read' | 'write'>('read');
  const [confidentiality, setConfidentiality] = useState(1);
  const [clearance, setClearance] = useState(1);
  const [url, setUrl] = useState('');
  const [fitScore, setFitScore] = useState(75);
  const [founderToken, setFounderToken] = useState(false);
  const [founderApproved, setFounderApproved] = useState(false);
  const [budgetBreach, setBudgetBreach] = useState(false);
  const [killActive, setKillActive] = useState(false);
  const [labResult, setLabResult] = useState<LabResult | null>(null);

  // Skills state
  const [selectedSkillIdx, setSelectedSkillIdx] = useState(0);
  const [newSkillName, setNewSkillName] = useState('');
  const [skillError, setSkillError] = useState<string | null>(null);

  if (!emp) {
    return <div className="text-slate-400">{tr('inspector.error', { message: 'No policy available.' })}</div>;
  }

  const role = String(node.data.role ?? 'employee');
  const netMode = node.data.networkMode ?? 'internal';
  const ssrfConfig = parseWatchlist(configs.sources_watchlist);

  const handleRunLab = () => {
    const q = {
      role,
      action,
      networkMode: netMode,
      tenant_id,
      confidentiality,
      clearance,
      fit_score: fitScore,
      url: url || undefined,
      method: 'GET',
      memory_tier: memoryTier || undefined,
      memory_access: memoryAccess,
      founder_token: founderToken,
      founder_approved: founderApproved,
      budget_breach: budgetBreach,
      kill_active: killActive,
    };
    const res = policyLab(q, ssrfConfig);
    setLabResult(res);
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    setSkillError(null);
    const n = newSkillName.endsWith('.md') ? newSkillName : `${newSkillName}.md`;
    const res = applyEdit(node.id, (nd, tid) => addSkill(nd, tid, n));
    if (!res.ok) {
      setSkillError(`[${res.code}] ${res.message}`);
    } else {
      setNewSkillName('');
      setSelectedSkillIdx(emp.skills.length);
    }
  };

  const handleRemoveSkill = (idx: number) => {
    setSkillError(null);
    const res = applyEdit(node.id, (nd, tid) => removeSkill(nd, tid, idx));
    if (!res.ok) {
      setSkillError(`[${res.code}] ${res.message}`);
    } else if (selectedSkillIdx >= emp.skills.length - 1) {
      setSelectedSkillIdx(Math.max(0, emp.skills.length - 2));
    }
  };

  const handleSkillBodyChange = (body: string) => {
    setSkillError(null);
    const res = applyEdit(node.id, (nd, tid) => setSkillBody(nd, tid, selectedSkillIdx, body));
    if (!res.ok) {
      setSkillError(`[${res.code}] ${res.message}`);
    }
  };

  const curSkill = emp.skills[selectedSkillIdx] ?? emp.skills[0];

  return (
    <div className="space-y-6 text-sm">
      {/* Policy Lab Section */}
      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {tr('inspector.lab.title')}
          </h3>
          <span className="rounded bg-sky-950 px-2 py-0.5 text-[10px] text-sky-400 font-mono">
            5-Tier Deterministic Engine
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <label className="text-slate-400">{tr('inspector.lab.action')}</label>
            <div className="mt-1 flex gap-2">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-slate-100"
              >
                {COMMON_ACTIONS.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
              <input
                placeholder="Or custom action"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-1/3 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400">Memory Tier (Optional)</label>
              <select
                value={memoryTier}
                onChange={(e) => setMemoryTier(e.target.value as MemoryTier | '')}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
              >
                <option value="">None</option>
                <option value="L1">L1 (Working Memory)</option>
                <option value="L2">L2 (Postgres State)</option>
                <option value="L3">L3 (Semantic Vector)</option>
                <option value="L4">L4 (Audit Log)</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400">Access Type</label>
              <select
                value={memoryAccess}
                onChange={(e) => setMemoryAccess(e.target.value as 'read' | 'write')}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
              </select>
            </div>
          </div>

          {action.startsWith('web') && (
            <div>
              <label className="text-slate-400">Target URL (SSRF Testing)</label>
              <input
                placeholder="https://ycombinator.com/rfs or http://169.254.169.254"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-slate-100"
              />
            </div>
          )}

          {action.includes('score') && (
            <div>
              <label className="text-slate-400">Fit Score (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={fitScore}
                onChange={(e) => setFitScore(parseFloat(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
              />
            </div>
          )}

          {/* Context toggles */}
          <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-slate-300">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={founderToken} onChange={(e) => setFounderToken(e.target.checked)} />
              Founder Ed25519 Token
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={founderApproved} onChange={(e) => setFounderApproved(e.target.checked)} />
              Founder Approved
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={budgetBreach} onChange={(e) => setBudgetBreach(e.target.checked)} />
              Budget Breach
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={killActive} onChange={(e) => setKillActive(e.target.checked)} />
              Kill Active
            </label>
          </div>

          <button
            onClick={handleRunLab}
            className="mt-2 w-full rounded bg-sky-600 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
          >
            {tr('inspector.lab.run')}
          </button>
        </div>

        {/* Lab Evaluation Output */}
        {labResult && (
          <div className="mt-3 rounded border border-slate-700 bg-slate-950 p-2.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">{tr('inspector.lab.decision')}:</span>
              <span
                className={`rounded px-2 py-0.5 font-bold ${
                  labResult.decision.outcome === 'ALLOW'
                    ? 'bg-emerald-950 text-emerald-400'
                    : labResult.decision.outcome === 'DENY'
                    ? 'bg-rose-950 text-rose-400'
                    : 'bg-amber-950 text-amber-400'
                }`}
              >
                {labResult.decision.outcome} (Tier {labResult.decision.tier})
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Policy ID: <span className="text-sky-300">{labResult.decision.policy_id}</span>
            </div>
            <div className="text-[11px] text-slate-300">{labResult.decision.reason}</div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-2 text-[11px]">
              <div>
                <span className="text-slate-400">{tr('inspector.lab.rbac')}: </span>
                <span className={labResult.rbac ? 'text-emerald-400' : 'text-rose-400'}>
                  {labResult.rbac ? 'ALLOW' : 'DENY'}
                </span>
              </div>
              {labResult.memory !== null && (
                <div>
                  <span className="text-slate-400">{tr('inspector.lab.memory')}: </span>
                  <span className={labResult.memory ? 'text-emerald-400' : 'text-rose-400'}>
                    {labResult.memory ? 'ALLOW' : 'DENY'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Skills Manager Section */}
      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {tr('inspector.skills')} ({emp.skills.length})
          </h3>
        </div>

        {skillError && (
          <div role="alert" className="rounded border border-rose-500/50 bg-rose-950/60 p-2 text-xs text-rose-300">
            {skillError}
          </div>
        )}

        {/* Skill Files Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2">
          {emp.skills.map((sk, idx) => (
            <div key={idx} className="flex items-center rounded overflow-hidden">
              <button
                onClick={() => setSelectedSkillIdx(idx)}
                className={`px-2.5 py-1 text-xs font-mono transition-colors ${
                  selectedSkillIdx === idx ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {sk.name}
              </button>
              {emp.skills.length > 1 && (
                <button
                  onClick={() => handleRemoveSkill(idx)}
                  className="bg-slate-800 px-1 py-1 text-slate-400 hover:bg-rose-900 hover:text-white"
                  title={tr('policies.removeSkill')}
                  aria-label={tr('policies.removeSkill')}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Selected Skill Body Editor */}
        {curSkill && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400 font-mono">{curSkill.name}</div>
            <textarea
              value={curSkill.body}
              onChange={(e) => handleSkillBodyChange(e.target.value)}
              rows={8}
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            />
          </div>
        )}

        {/* Add Skill File Form */}
        <form onSubmit={handleAddSkill} className="flex gap-2 pt-1">
          <input
            placeholder="new_skill.md"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            className="flex-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newSkillName}
            className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            {tr('inspector.skills.add')}
          </button>
        </form>
      </section>
    </div>
  );
}
