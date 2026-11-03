import type { Horizon } from '../types';
export const HORIZONS: Horizon[] = ['CURRENT', 'TRANSITIONAL', 'TARGET'];
const RANK: Record<Horizon, number> = { CURRENT: 0, TRANSITIONAL: 1, TARGET: 2 };
/** The only place that decides horizon visibility; the input is the component's own `architecture_horizon`. */
export const isVisibleAt = (componentHorizon: Horizon, selected: Horizon): boolean => RANK[componentHorizon] <= RANK[selected];
