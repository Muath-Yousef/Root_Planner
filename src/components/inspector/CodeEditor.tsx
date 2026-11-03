import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { python } from '@codemirror/lang-python';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: 'json' | 'yaml' | 'python';
  readOnly?: boolean;
  highlightLine?: number; // 1-indexed
  height?: string;
}

export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  highlightLine,
  height = '320px',
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const langExtension =
      language === 'json' ? json() : language === 'yaml' ? yaml() : python();

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange && !readOnly) {
        onChange(update.state.doc.toString());
      }
    });

    const theme = EditorView.theme({
      '&': {
        height,
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontSize: '12px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      '.cm-content': {
        caretColor: '#38bdf8',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: '#38bdf8',
      },
      '.cm-gutters': {
        backgroundColor: '#090d16',
        color: '#64748b',
        borderRight: '1px solid #1e293b',
      },
      '.cm-activeLine': {
        backgroundColor: '#1e293b55',
      },
      '.cm-activeLineGutter': {
        backgroundColor: '#1e293b',
        color: '#38bdf8',
      },
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        langExtension,
        theme,
        updateListener,
        EditorState.readOnly.of(readOnly),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, readOnly, height]);

  // Update doc if value changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Scroll to highlighted line
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !highlightLine || highlightLine < 1) return;
    try {
      const line = view.state.doc.line(Math.min(highlightLine, view.state.doc.lines));
      view.dispatch({
        selection: { anchor: line.from, head: line.to },
        scrollIntoView: true,
      });
    } catch {
      // ignore out of range
    }
  }, [highlightLine]);

  return <div ref={containerRef} className="overflow-hidden rounded border border-slate-700" />;
}
