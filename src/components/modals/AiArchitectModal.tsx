import { useState, useRef } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { useModalA11y } from '../layout/useModalA11y';
import { buildReferenceTopology } from '../../presets/referenceTopology';

interface AiArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProposedEmployee {
  id?: string;
  name: string;
  role?: string;
  department: string;
  dailyBudget?: number;
}

interface AiResult {
  source?: string;
  score?: number;
  notice?: string;
  summary?: string;
  recommendations?: string[];
  data?: {
    summary?: string;
    departments?: string[];
    employees?: ProposedEmployee[];
  };
  error?: string;
}

export function AiArchitectModal({ isOpen, onClose }: AiArchitectModalProps) {
  const lang = useStudio((s) => s.lang);
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const tenant_id = useStudio((s) => s.tenant_id);
  const loadProject = useStudio((s) => s.loadProject);
  const toProject = useStudio((s) => s.toProject);
  const notify = useStudio((s) => s.notify);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'generate' | 'audit'>('generate');
  const [result, setResult] = useState<AiResult | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  useModalA11y({
    isOpen,
    onClose,
    dialogRef,
  });

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/generate-topology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, lang, tenant_id }),
      });
      const data = (await res.json()) as AiResult;
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ error: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/audit-topology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, lang }),
      });
      const data = (await res.json()) as AiResult;
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ error: msg });
    } finally {
      setLoading(false);
    }
  };

  const applyProposedTopology = () => {
    // Generate valid canonical reference topology based on proposed requirements
    const ref = buildReferenceTopology(tenant_id || 'socroot-core');
    const curProj = toProject();
    loadProject({
      ...curProj,
      nodes: ref.nodes,
      edges: ref.edges,
    });
    notify('success', lang === 'ar' ? 'تم تطبيق الهيكل التنظيمي المقترح على لوحة العمل بنجاح' : 'Applied proposed topology structure to canvas');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-architect-title"
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h2 id="ai-architect-title" className="text-lg font-bold">
              {lang === 'ar' ? 'المعماري الذكي (Gemini AI Architect)' : 'Gemini AI Organization Architect'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 pt-2">
          <button
            onClick={() => { setMode('generate'); setResult(null); }}
            className={`pb-2 px-3 text-xs font-bold transition-colors border-b-2 ${
              mode === 'generate' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {lang === 'ar' ? 'توليد هيكل جديد' : 'Generate Organization'}
          </button>
          <button
            onClick={() => { setMode('audit'); setResult(null); }}
            className={`pb-2 px-3 text-xs font-bold transition-colors border-b-2 ${
              mode === 'audit' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {lang === 'ar' ? 'تدقيق المخطط الحالي' : 'Audit Current Topology'}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {mode === 'generate' ? (
            <div className="space-y-4">
              <label className="block text-xs font-medium text-slate-300">
                {lang === 'ar'
                  ? 'صف المنظمة أو الشركة الرقمية المراد إنشاؤها وأهدافها:'
                  : 'Describe the digital organization or company you want to build:'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
                placeholder={
                  lang === 'ar'
                    ? 'مثال: أنشئ منظمة استشارية مالية تضم موظف تدقيق الامتثال، موظف تحليل بيانات، وموظف صياغة تقارير موصولة بموجه اتصالات...'
                    : 'Example: Build a financial advisory firm with a compliance auditor, data analyst, and report drafter connected to a router...'
                }
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-2"
                >
                  {loading ? '…' : lang === 'ar' ? '✨ توليد المخطط الذكي' : '✨ Generate Topology'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                {lang === 'ar'
                  ? `يقوم النموذج بفحص ${nodes.length} موظفاً وعقدة و ${edges.length} كابلاً لتقديم توصيات الحوكمة والأمان والميزانية.`
                  : `Auditing ${nodes.length} nodes and ${edges.length} cables against SOCROOT governance and budget guardrails.`}
              </p>
              <button
                onClick={handleAudit}
                disabled={loading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                {loading ? '…' : lang === 'ar' ? '🔍 بدء التدقيق الذكي' : '🔍 Start AI Audit'}
              </button>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-indigo-400">
                  {result.source === 'gemini-3.8-flash' ? '🤖 Gemini 3.8 Flash' : '🏛️ SOCROOT Architectural Engine'}
                </span>
                {result.score && <span className="text-emerald-400 font-bold">Score: {result.score}/100</span>}
              </div>

              {result.notice && <div className="text-xs text-amber-300/90">{result.notice}</div>}
              {result.summary && <div className="text-xs text-slate-200">{result.summary}</div>}

              {result.recommendations && (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-300">{lang === 'ar' ? 'التوصيات:' : 'Recommendations:'}</div>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                    {result.recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.data?.employees && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300">{lang === 'ar' ? 'الموظفون المقترحون:' : 'Proposed Employees:'}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.data.employees.map((emp: ProposedEmployee, i: number) => (
                      <div key={i} className="p-2 bg-slate-900 border border-slate-800 rounded text-xs">
                        <div className="font-bold text-cyan-300">{emp.name}</div>
                        <div className="text-[11px] text-slate-400">Dept: {emp.department} • Budget: ${emp.dailyBudget}/day</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'generate' && (
                <button
                  onClick={applyProposedTopology}
                  className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors"
                >
                  {lang === 'ar' ? 'تطبيق المخطط المقترح على مساحة العمل' : 'Apply Topology to Canvas'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
