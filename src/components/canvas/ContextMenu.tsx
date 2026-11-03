import { useStudio } from '../../store/useStudioStore';
import { useT } from '../../i18n/useT';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId?: string;
  onClose: () => void;
}

export function ContextMenu({ x, y, nodeId, onClose }: ContextMenuProps) {
  const tr = useT();
  const openInspector = useStudio((s) => s.openInspector);
  const copy = useStudio((s) => s.copy);
  const paste = useStudio((s) => s.paste);
  const duplicate = useStudio((s) => s.duplicate);
  const deleteSelection = useStudio((s) => s.deleteSelection);
  const autoLayoutCanvas = useStudio((s) => s.autoLayoutCanvas);
  const alignSelected = useStudio((s) => s.alignSelected);
  const distributeSelected = useStudio((s) => s.distributeSelected);
  const setCommandPaletteOpen = useStudio((s) => s.setCommandPaletteOpen);
  const setCliModalOpen = useStudio((s) => s.setCliModalOpen);
  const setKillModalOpen = useStudio((s) => s.setKillModalOpen);

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-lg border border-slate-700 bg-slate-900 py-1.5 text-xs text-slate-200 shadow-xl"
      style={{ top: y, left: x }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      {nodeId ? (
        <>
          <button
            onClick={() => openInspector(nodeId, 'identity')}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            🔍 {tr('inspector.title')}
          </button>
          <button
            onClick={() => openInspector(nodeId, 'policies')}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            ⚖️ Policy Lab
          </button>
          <div className="my-1 border-t border-slate-800" />
          <button
            onClick={() => copy()}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            📋 Copy
          </button>
          <button
            onClick={() => duplicate()}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            ⚡ Duplicate
          </button>
          <button
            onClick={() => deleteSelection()}
            className="flex w-full items-center px-3 py-1.5 text-start text-rose-400 hover:bg-rose-600 hover:text-white"
          >
            🗑️ Delete
          </button>
          <div className="my-1 border-t border-slate-800" />
          <button
            onClick={() => setKillModalOpen(true)}
            className="flex w-full items-center px-3 py-1.5 text-start text-amber-400 hover:bg-amber-600 hover:text-white"
          >
            🛑 Emergency Kill Switch
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => autoLayoutCanvas()}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            📐 {tr('top.autolayout')}
          </button>
          <button
            onClick={() => alignSelected('hcenter')}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            ↔️ Align Center
          </button>
          <button
            onClick={() => distributeSelected('x')}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            ⚖️ Distribute Horizontally
          </button>
          <div className="my-1 border-t border-slate-800" />
          <button
            onClick={() => paste()}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            📋 Paste
          </button>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            ⚡ {tr('palette.title')} (Ctrl+K)
          </button>
          <button
            onClick={() => setCliModalOpen(true)}
            className="flex w-full items-center px-3 py-1.5 text-start hover:bg-sky-600 hover:text-white"
          >
            💻 {tr('top.cli')}
          </button>
        </>
      )}
    </div>
  );
}
