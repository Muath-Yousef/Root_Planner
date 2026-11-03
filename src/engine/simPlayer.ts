/** Play / step / stop / reset over an already computed run. Pure reducer so the buttons are testable without React. */
export interface PlayerState { total: number; revealed: number; playing: boolean }
export type PlayerAction =
  | { type: 'load'; total: number }
  | { type: 'step' }
  | { type: 'step_back' }
  | { type: 'seek'; revealed: number }
  | { type: 'play' }
  | { type: 'tick' }
  | { type: 'stop' }
  | { type: 'reset' };

export const initialPlayer: PlayerState = { total: 0, revealed: 0, playing: false };

export function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  switch (a.type) {
    case 'load':
      return { total: a.total, revealed: 0, playing: false };
    case 'step':
      return { ...s, revealed: Math.min(s.total, s.revealed + 1), playing: false };
    case 'step_back':
      return { ...s, revealed: Math.max(0, s.revealed - 1), playing: false };
    case 'seek':
      return { ...s, revealed: Math.max(0, Math.min(s.total, a.revealed)), playing: false };
    case 'play':
      return s.total === 0 ? s : { ...s, revealed: s.revealed >= s.total ? 0 : s.revealed, playing: true };
    case 'tick': {
      if (!s.playing) return s;
      const revealed = Math.min(s.total, s.revealed + 1);
      return { ...s, revealed, playing: revealed < s.total };
    }
    case 'stop':
      return { ...s, playing: false };
    case 'reset':
      return { ...s, revealed: 0, playing: false };
  }
}
export const isFinished = (s: PlayerState) => s.total > 0 && s.revealed >= s.total;
