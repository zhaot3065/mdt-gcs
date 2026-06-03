import { create } from 'zustand';
import type { GcsCommandResult } from '@shared/types/datalink';
import {
  createWaypointItem,
  DEFAULT_MISSION_WP_ALT_M,
  reindexWaypointItems,
  type GcsMissionDownloadPayload,
  type GcsMissionDownloadResult,
  type GcsMissionPayload,
  type WaypointItem,
} from '@shared/types/mission';

interface MissionStore {
  waypoints: WaypointItem[];
  isEditMode: boolean;
  uploadBusy: boolean;
  downloadBusy: boolean;
  lastUploadResult: GcsCommandResult | null;
  lastDownloadResult: GcsMissionDownloadResult | null;
  setEditMode: (enabled: boolean) => void;
  toggleEditMode: () => void;
  addWaypoint: (lat: number, lon: number, alt?: number) => void;
  updateWaypoint: (seq: number, patch: Partial<Omit<WaypointItem, 'seq'>>) => void;
  removeWaypoint: (seq: number) => void;
  reorderWaypoint: (fromIndex: number, toIndex: number) => void;
  setWaypointCommand: (seq: number, command: number) => void;
  clearWaypoints: () => void;
  setWaypoints: (items: WaypointItem[]) => void;
  importWaypoints: (items: WaypointItem[]) => void;
  uploadMission: (
    options?: Pick<GcsMissionPayload, 'targetSystem' | 'targetComponent' | 'missionType'>,
  ) => Promise<GcsCommandResult>;
  downloadMission: (
    options?: GcsMissionDownloadPayload,
  ) => Promise<GcsMissionDownloadResult>;
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  waypoints: [],
  isEditMode: false,
  uploadBusy: false,
  downloadBusy: false,
  lastUploadResult: null,
  lastDownloadResult: null,

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

  reorderWaypoint: (fromIndex, toIndex) => {
    set((state) => {
      const items = [...state.waypoints];
      if (fromIndex < 0 || fromIndex >= items.length) return state;
      if (toIndex < 0 || toIndex >= items.length) return state;
      if (fromIndex === toIndex) return state;
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return { waypoints: reindexWaypointItems(items) };
    });
  },

  setWaypointCommand: (seq, command) => {
    set((state) => ({
      waypoints: state.waypoints.map((wp) =>
        wp.seq === seq ? { ...wp, command } : wp,
      ),
    }));
  },

  clearWaypoints: () =>
    set({ waypoints: [], lastUploadResult: null, lastDownloadResult: null }),

  setWaypoints: (items) => set({ waypoints: reindexWaypointItems(items) }),

  importWaypoints: (items) =>
    set({ waypoints: reindexWaypointItems(items), lastUploadResult: null, lastDownloadResult: null }),

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

  downloadMission: async (options) => {
    if (!window.gcs?.mission?.download) {
      const result: GcsMissionDownloadResult = {
        ok: false,
        error: 'Electron bridge unavailable (run via electron:dev)',
      };
      set({ lastDownloadResult: result });
      return result;
    }

    set({ downloadBusy: true, lastDownloadResult: null });
    try {
      const result = await window.gcs.mission.download(options);
      set({ lastDownloadResult: result });
      if (result.ok && result.waypoints) {
        set({ waypoints: reindexWaypointItems(result.waypoints) });
      }
      return result;
    } finally {
      set({ downloadBusy: false });
    }
  },
}));
