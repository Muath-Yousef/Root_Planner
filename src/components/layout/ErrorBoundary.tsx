import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../../i18n';
import { useStudio } from '../../store/useStudioStore';

/** A crash in one panel must not blank the app. Read the language straight from the store: class components cannot use hooks. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('UI error', error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    const lang = useStudio.getState().lang;
    return (
      <div role="alert" className="m-6 rounded border border-rose-500 bg-rose-950 p-4 text-sm">
        <b>{t(lang, 'error.title')}</b>
        <pre dir="ltr" className="mt-2 whitespace-pre-wrap text-xs text-rose-200">{this.state.error.message}</pre>
        <button onClick={() => this.setState({ error: null })} className="mt-3 rounded bg-slate-700 px-3 py-1">{t(lang, 'error.reset')}</button>
      </div>
    );
  }
}
