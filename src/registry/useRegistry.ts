import { useSyncExternalStore } from 'react';
import { getRegistryVersion, subscribeRegistry } from './index';
export const useRegistryVersion = (): number => useSyncExternalStore(subscribeRegistry, getRegistryVersion, getRegistryVersion);
