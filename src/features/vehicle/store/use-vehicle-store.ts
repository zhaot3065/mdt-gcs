import { create } from 'zustand';
import type { GcsCommandRequest, GcsCommandResult } from '@shared/types/datalink';
import type { VehicleState } from '@shared/types/vehicle';
import { createInitialVehicleState } from '@shared/types/vehicle';

interface VehicleStore {
  vehicle: VehicleState;
  commandBusy: boolean;
  lastCommandResult: GcsCommandResult | null;
  applyState: (state: VehicleState) => void;
  subscribeIpc: () => () => void;
  sendCommand: (request: GcsCommandRequest) => Promise<GcsCommandResult>;
}

export const useVehicleStore = create<VehicleStore>((set, get) => ({
  vehicle: createInitialVehicleState(),
  commandBusy: false,
  lastCommandResult: null,

  applyState: (vehicle) => set({ vehicle }),

  subscribeIpc: () => {
    if (!window.gcs?.vehicle) return () => undefined;
    return window.gcs.vehicle.onState((state) => {
      get().applyState(state);
    });
  },

  sendCommand: async (request) => {
    if (!window.gcs?.vehicle?.sendCommand) {
      const result: GcsCommandResult = {
        ok: false,
        command: request.command,
        error: 'Electron bridge unavailable (run via electron:dev)',
        errorCode: 'SEND_FAILED',
      };
      set({ lastCommandResult: result });
      return result;
    }
    set({ commandBusy: true, lastCommandResult: null });
    try {
      const result = await window.gcs.vehicle.sendCommand(request);
      set({ lastCommandResult: result });
      return result;
    } finally {
      set({ commandBusy: false });
    }
  },
}));
