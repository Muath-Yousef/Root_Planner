import { useState, useEffect, useMemo } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { useReactFlow } from '@xyflow/react';
import { useT } from '../../i18n/useT';
import { useModalA11y } from '../layout/useModalA11y';

interface PaletteCommand {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPaletteModal() {
  const tr = useT();
  const commandPaletteOpen = useStudio((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useStudio((s) => s.setCommandPaletteOpen);
  const nodes = useStudio((s) => s.nodes);
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const theme = useStudio((s) => s.theme);
  const setTheme = useStudio((s) => s.setTheme);
  const lang = useStudio((s) => s.lang);
  const setLang = useStudio((s) => s.setLang);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const selectAll = useStudio((s) => s.selectAll);
  const deleteSelection = useStudio((s) => s.deleteSelection);
  const autoLayoutCanvas = useStudio((s) => s.autoLayoutCanvas);
  const alignSelected = useStudio((s) => s.alignSelected);
  const distributeSelected = useStudio((s) => s.distributeSelected);
  const setCliModalOpen = useStudio((s) => s.setCliModalOpen);
  const setBreakGlassModalOpen = useStudio((s) => s.setBreakGlassModalOpen);
  const setTenantModalOpen = useStudio((s) => s.setTenantModalOpen);
  const setExportModalOpen = useStudio((s) => s.setExportModalOpen);
  const setKillModalOpen = useStudio((s) => s.setKillModalOpen);
  const setConfigEditorModalOpen = useStudio((s) => s.setConfigEditorModalOpen);
  const openInspector = useStudio((s) => s.openInspector);
  const select = useStudio((s) => s.select);
  const { setCenter, getNode } = useReactFlow();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const dialogRef = useModalA11y<HTMLDivElement>(
    commandPaletteOpen,
    () => setCommandPaletteOpen(false)
  );

  const commands: PaletteCommand[] = useMemo(() => {
    const list: PaletteCommand[] = [
      {
        id: 'toggle-mode',
        title: tr('palette.cmd.mode'),
        category: tr('palette.cat.view'),
        action: () => setMode(mode === 'design' ? 'simulate' : 'design'),
      },
      {
        id: 'toggle-theme',
        title: tr('palette.cmd.theme'),
        category: tr('palette.cat.preferences'),
        action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'toggle-lang',
        title: tr('palette.cmd.lang'),
        category: tr('palette.cat.preferences'),
        action: () => setLang(lang === 'en' ? 'ar' : 'en'),
      },
      {
        id: 'cli-modal',
        title: tr('palette.cmd.cli'),
        category: tr('palette.cat.operations'),
        action: () => setCliModalOpen(true),
      },
      {
        id: 'breakglass-modal',
        title: tr('palette.cmd.breakglass'),
        category: tr('palette.cat.security'),
        action: () => setBreakGlassModalOpen(true),
      },
      {
        id: 'killplane-modal',
        title: tr('palette.cmd.killplane'),
        category: tr('palette.cat.security'),
        action: () => setKillModalOpen(true),
      },
      {
        id: 'tenant-modal',
        title: tr('palette.cmd.tenant'),
        category: tr('palette.cat.governance'),
        action: () => setTenantModalOpen(true),
      },
      {
        id: 'export-modal',
        title: tr('palette.cmd.export'),
        category: tr('palette.cat.project'),
        action: () => setExportModalOpen(true),
      },
      {
        id: 'config-modal',
        title: tr('palette.cmd.configs'),
        category: tr('palette.cat.project'),
        action: () => setConfigEditorModalOpen(true),
      },
      {
        id: 'autolayout',
        title: tr('palette.cmd.autolayout'),
        category: tr('palette.cat.layout'),
        shortcut: 'Ctrl+L',
        action: () => autoLayoutCanvas(),
      },
      {
        id: 'align-hcenter',
        title: tr('palette.cmd.align'),
        category: tr('palette.cat.layout'),
        action: () => alignSelected('hcenter'),
      },
      {
        id: 'distribute-h',
        title: tr('palette.cmd.distribute'),
        category: tr('palette.cat.layout'),
        action: () => distributeSelected('x'),
      },
      {
        id: 'undo',
        title: tr('palette.cmd.undo'),
        category: tr('palette.cat.edit'),
        shortcut: 'Ctrl+Z',
        action: () => undo(),
      },
      {
        id: 'redo',
        title: tr('palette.cmd.redo'),
        category: tr('palette.cat.edit'),
        shortcut: 'Ctrl+Y',
        action: () => redo(),
      },
      {
        id: 'select-all',
        title: tr('palette.cmd.select_all'),
        category: tr('palette.cat.edit'),
        shortcut: 'Ctrl+A',
        action: () => selectAll(),
      },
      {
        id: 'delete-sel',
        title: tr('palette.cmd.delete'),
        category: tr('palette.cat.edit'),
        shortcut: 'Del',
        action: () => deleteSelection(),
      },
    ];

    // Add navigation to each node
    for (const n of nodes) {
      list.push({
        id: `node-${n.id}`,
        title: `Focus Node: ${n.data.label} (${n.data.role})`,
        category: 'Nodes',
        action: () => {
          select(n.id);
          const current = getNode(n.id);
          if (current) setCenter(current.position.x + 80, current.position.y + 30, { zoom: 1, duration: 300 });
          openInspector(n.id, 'identity');
        },
      });
    }

    return list;
  }, [
    mode,
    theme,
    lang,
    nodes,
    setMode,
    setTheme,
    setLang,
    undo,
    redo,
    selectAll,
    deleteSelection,
    autoLayoutCanvas,
    alignSelected,
    distributeSelected,
    setCliModalOpen,
    setBreakGlassModalOpen,
    setTenantModalOpen,
    setExportModalOpen,
    setKillModalOpen,
    openInspector,
    select,
    getNode,
    setCenter,
  ]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[selectedIndex];
      if (target) {
        setCommandPaletteOpen(false);
        target.action();
      }
    } else if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  };

  if (!commandPaletteOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr('palette.placeholder')}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 p-4"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950 px-4 py-3">
          <span className="text-slate-400 me-2">🔍</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('palette.placeholder')}
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5 text-xs">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-slate-500">No commands found.</div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={() => {
                  setCommandPaletteOpen(false);
                  cmd.action();
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-start transition-colors ${
                  idx === selectedIndex
                    ? 'bg-sky-600 text-white font-medium'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] uppercase font-mono ${
                      idx === selectedIndex ? 'bg-sky-700 text-sky-100' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cmd.category}
                  </span>
                  <span className="truncate">{cmd.title}</span>
                </div>
                {cmd.shortcut && (
                  <kbd
                    className={`font-mono text-[10px] ${
                      idx === selectedIndex ? 'text-sky-200' : 'text-slate-500'
                    }`}
                  >
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
