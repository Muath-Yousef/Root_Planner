import { useState, useEffect, useRef } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { useModalA11y } from '../layout/useModalA11y';
import { useT } from '../../i18n/useT';

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function McpConsoleModal({ isOpen, onClose }: McpConsoleModalProps) {
  const tr = useT();
  const lang = useStudio((s) => s.lang);
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const tenant_id = useStudio((s) => s.tenant_id);

  const [tools, setTools] = useState<McpTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>('get_pipeline_status');
  const [toolArgs, setToolArgs] = useState<string>('{}');
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'console' | 'config'>('console');
  const [copied, setCopied] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  useModalA11y({
    isOpen,
    onClose,
    dialogRef,
  });

  // Load available MCP tools
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/mcp/tools')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.tools)) {
          setTools(data.tools);
          if (data.tools.length > 0 && !selectedTool) {
            setSelectedTool(data.tools[0].name);
          }
        }
      })
      .catch(() => {
        // Fallback default list
        setTools([
          { name: 'get_my_role', description: 'Returns role definition and pipeline status.', inputSchema: {} },
          { name: 'list_pending_tasks', description: 'Lists all pending tasks in docs/pipeline/tasks.', inputSchema: {} },
          { name: 'get_pipeline_status', description: 'Returns full analytics on tasks and reviews.', inputSchema: {} },
          { name: 'validate_topology', description: 'Validates current nodes and edges.', inputSchema: {} },
          { name: 'generate_reference_topology', description: 'Generates the standard reference department.', inputSchema: {} },
        ]);
      });
  }, [isOpen]);

  // Auto-populate default argument when switching tools
  useEffect(() => {
    if (selectedTool === 'validate_topology') {
      setToolArgs(JSON.stringify({ nodes, edges, tenant_id }, null, 2));
    } else if (selectedTool === 'generate_reference_topology') {
      setToolArgs(JSON.stringify({ tenant_id }, null, 2));
    } else if (selectedTool === 'list_pending_tasks') {
      setToolArgs(JSON.stringify({ status: 'all' }, null, 2));
    } else {
      setToolArgs('{}');
    }
  }, [selectedTool, nodes, edges, tenant_id]);

  if (!isOpen) return null;

  const handleRunTool = async () => {
    setLoading(true);
    setOutput('');
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgs || '{}');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setOutput(`❌ JSON Syntax Error in tool arguments: ${msg}`);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedTool, arguments: parsedArgs }),
      });

      const data = await res.json();
      setOutput(JSON.stringify(data.result || data, null, 2));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOutput(`❌ Execution error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        "socroot-pipeline": {
          command: "node",
          args: ["/absolute/path/to/Root_Planner/scripts/pipeline-mcp-server.mjs"],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: "your_ghp_token_here"
          }
        }
      }
    },
    null,
    2
  );

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        "socroot-remote-sse": {
          url: `${window.location.origin}/sse`
        }
      }
    },
    null,
    2
  );

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
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
        aria-labelledby="mcp-modal-title"
        className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 id="mcp-modal-title" className="text-lg font-bold">
              {lang === 'ar' ? 'وحدة تحكم بروتوكول سياق النموذج (MCP Console)' : 'Model Context Protocol (MCP) Console'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'console' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {lang === 'ar' ? 'تشغيل الأدوات (Tools Runner)' : 'Tools Runner'}
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'config' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {lang === 'ar' ? 'إعدادات الاتصال (Clients Setup)' : 'Clients Setup'}
            </button>
            <button
              onClick={onClose}
              aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'console' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tool Selector */}
              <div className="md:col-span-1 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'ar' ? 'الأدوات المتوفرة' : 'Available Tools'}
                </label>
                <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                  {tools.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTool(t.name)}
                      className={`w-full text-left rtl:text-right px-3 py-2 rounded-lg text-xs font-mono transition-all border ${
                        selectedTool === t.name
                          ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold">{t.name}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{t.description}</div>
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="text-emerald-400 font-bold">🟢 Protocol: MCP v2.0</div>
                  <div>• Transports: Stdio + HTTP SSE</div>
                  <div>• Server Endpoint: <code className="text-cyan-300">/sse</code></div>
                </div>
              </div>

              {/* Execution Area */}
              <div className="md:col-span-2 space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {lang === 'ar' ? 'معاملات الأداة (JSON Arguments)' : 'Tool Arguments (JSON)'}
                  </label>
                  <button
                    onClick={handleRunTool}
                    disabled={loading}
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2"
                  >
                    {loading ? '…' : lang === 'ar' ? '⚡ تشغيل الأداة' : '⚡ Execute Tool'}
                  </button>
                </div>

                <textarea
                  value={toolArgs}
                  onChange={(e) => setToolArgs(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-950 font-mono text-xs text-slate-200 p-3 rounded-lg border border-slate-700 focus:border-cyan-500 focus:outline-hidden"
                  placeholder="{}"
                />

                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">
                  {lang === 'ar' ? 'نتيجة الاستجابة (Execution Output)' : 'Execution Output'}
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-400 max-h-[220px] overflow-y-auto whitespace-pre">
                  {output || (lang === 'ar' ? '// اضغط على "تشغيل الأداة" لعرض النتيجة هنا...' : '// Click "Execute Tool" to see the output here...')}
                </div>
              </div>
            </div>
          ) : (
            /* Setup Guide Tab */
            <div className="space-y-6 text-sm text-slate-300">
              {/* Claude Desktop Config */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <span>🟣 Claude Desktop (Local Stdio)</span>
                  </h3>
                  <button
                    onClick={() => copyToClipboard(claudeDesktopConfig, 'claude')}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700"
                  >
                    {copied === 'claude' ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نسخ الإعدادات' : 'Copy Config')}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'أضف هذا المقطع إلى ملف claude_desktop_config.json لتفويض كلود بالتحكم في خط الإنتاج:'
                    : 'Add this block to your claude_desktop_config.json file:'}
                </p>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs overflow-x-auto text-slate-300 font-mono">
                  {claudeDesktopConfig}
                </pre>
              </div>

              {/* Cursor & Remote SSE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <span>⚡ Cursor IDE / Remote Clients (HTTP SSE)</span>
                  </h3>
                  <button
                    onClick={() => copyToClipboard(cursorConfig, 'cursor')}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700"
                  >
                    {copied === 'cursor' ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نسخ الإعدادات' : 'Copy Config')}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'في Cursor Settings -> Features -> MCP Servers، أضف خادم Type: SSE بعنوان:'
                    : 'In Cursor Settings -> Features -> MCP Servers, add an SSE server with URL:'}
                </p>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs overflow-x-auto text-slate-300 font-mono">
                  {cursorConfig}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
