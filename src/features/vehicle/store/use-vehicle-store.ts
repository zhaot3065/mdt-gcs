import { create } from 'zustand';
import type { VehicleState } from '@shared/types/vehicle';
import { createInitialVehicleState } from '@shared/types/vehicle';

interface VehicleStore {
  vehicle: VehicleState;
  applyState: (state: VehicleState) => void;
  subscribeIpc: () => () => void;
}

export const useVehicleStore = create<VehicleStore>((set, get) => ({
  vehicle: createInitialVehicleState(),

  applyState: (vehicle) => set({ vehicle }),

  subscribeIpc: () => {
    if (!window.gcs?.vehicle) return () => undefined;
    return window.gcs.vehicle.onState((state) => {
      get().applyState(state);
    });
  },
}));
