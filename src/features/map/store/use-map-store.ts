import { create } from 'zustand';
import type { MapTileMode } from '@shared/types/map';

interface MapStore {
  tileMode: MapTileMode;
  setTileMode: (mode: MapTileMode) => void;
  toggleTileMode: () => void;
}

export const useMapStore = create<MapStore>((set, get) => ({
  tileMode: 'online',
  setTileMode: (tileMode) => set({ tileMode }),
  toggleTileMode: () =>
    set({ tileMode: get().tileMode === 'online' ? 'offline' : 'online' }),
}));
