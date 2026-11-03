/** Debounced saver, pure (timers injected) so it is testable. `schedule` coalesces bursts; `flush` saves now. */
export interface Autosaver<T> { schedule(v: T): void; flush(): Promise<void>; cancel(): void; readonly pending: boolean }
export function createAutosaver<T>(save: (v: T) => Promise<void>, delayMs = 800,
  timers: { set: (f: () => void, ms: number) => unknown; clear: (h: unknown) => void } = { set: (f, ms) => setTimeout(f, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }): Autosaver<T> {
  let handle: unknown = null; let latest: { v: T } | null = null;
  const run = async () => { handle = null; if (!latest) return; const { v } = latest; latest = null; await save(v); };
  return {
    schedule(v) { latest = { v }; if (handle !== null) timers.clear(handle); handle = timers.set(() => { void run(); }, delayMs); },
    async flush() { if (handle !== null) { timers.clear(handle); } await run(); },
    cancel() { if (handle !== null) timers.clear(handle); handle = null; latest = null; },
    get pending() { return latest !== null; },
  };
}
