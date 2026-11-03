import type { ProjectConfigs } from '../types';
import { MODEL_ROUTING_YAML, PRICING_CONFIG_YAML, SOURCES_WATCHLIST_YAML } from './referenceConfigs';
export { MODEL_ROUTING_YAML, PRICING_CONFIG_YAML, SOURCES_WATCHLIST_YAML };
export const defaultConfigs = (): ProjectConfigs => ({ model_routing: MODEL_ROUTING_YAML, sources_watchlist: SOURCES_WATCHLIST_YAML, pricing_config: PRICING_CONFIG_YAML });
