import { create } from 'zustand';
import type { GcsCommandResult } from '@shared/types/datalink';
import {
  createWaypointItem,
  DEFAULT_MISSION_WP_ALT_M,
  reindexWaypointItems,
  type GcsMissionPayload,
  type WaypointItem,
} from '@shared/types/mission';

interface MissionStore {
  waypoints: WaypointItem[];
  isEditMode: boolean;
  uploadBusy: boolean;
  lastUploadResult: GcsCommandResult | null;
  setEditMode: (enabled: boolean) => void;
  toggleEditMode: () => void;
  addWaypoint: (lat: number, lon: number, alt?: number) => void;
  updateWaypoint: (seq: number, patch: Partial<Omit<WaypointItem, 'seq'>>) => void;
  removeWaypoint: (seq: number) => void;
  clearWaypoints: () => void;
  setWaypoints: (items: WaypointItem[]) => void;
  uploadMission: (
    options?: Pick<GcsMissionPayload, 'targetSystem' | 'targetComponent' | 'missionType'>,
  ) => Promise<GcsCommandResult>;
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  waypoints: [],
  isEditMode: false,
  uploadBusy: false,
  lastUploadResult: null,

  setEditMode: (enabled) => set({ isEditMode: enabled }),
  toggleEditMode: () => set((s) => ({ isEditMode: !s.isEditMode })),

  addWaypoint: (lat, lon, alt = DEFAULT_MISSION_WP_ALT_M) => {
    set((state) => {
      const seq = state.waypoints.length;
      return {
        waypoints: [...state.waypoints, createWaypointItem(seq, lat, lon, alt)],
      };
    });
  },

  updateWaypoint: (seq, patch) => {
    set((state) => ({
      waypoints: state.waypoints.map((wp) =>
        wp.seq === seq ? { ...wp, ...patch, seq: wp.seq } : wp,
      ),
    }));
  },

  removeWaypoint: (seq) => {
    set((state) => ({
      waypoints: reindexWaypointItems(state.waypoints.filter((wp) => wp.seq !== seq)),
    }));
  },

  clearWaypoints: () => set({ waypoints: [] }),

  setWaypoints: (items) => set({ waypoints: reindexWaypointItems(items) }),

  uploadMission: async (options) => {
    const { waypoints } = get();
    const payload: GcsMissionPayload = {
      items: waypoints,
      targetSystem: options?.targetSystem,
      targetComponent: options?.targetComponent,
      missionType: options?.missionType,
    };

    if (!window.gcs?.mission?.upload) {
      const result: GcsCommandResult = {
        ok: false,
        command: 'mission_upload',
        error: 'Electron bridge unavailable (run via electron:dev)',
        errorCode: 'SEND_FAILED',
      };
      set({ lastUploadResult: result });
      return result;
    }

    set({ uploadBusy: true, lastUploadResult: null });
    try {
      const result = await window.gcs.mission.upload(payload);
      set({ lastUploadResult: result });
      return result;
    } finally {
      set({ uploadBusy: false });
    }
  },
}));
