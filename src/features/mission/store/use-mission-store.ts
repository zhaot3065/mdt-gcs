import { create } from 'zustand';
import type { GcsCommandResult } from '@shared/types/datalink';
import {
  createEmptyMissionsByType,
  createWaypointItem,
  DEFAULT_MISSION_WP_ALT_M,
  MAV_MISSION_TYPE,
  normalizeMissionType,
  reindexWaypointItems,
  type GcsMissionDownloadPayload,
  type GcsMissionDownloadResult,
  type GcsMissionPayload,
  type MissionDataType,
  type WaypointItem,
} from '@shared/types/mission';

interface MissionStore {
  currentMissionType: MissionDataType;
  missionsByType: Record<MissionDataType, WaypointItem[]>;
  isEditMode: boolean;
  uploadBusy: boolean;
  downloadBusy: boolean;
  lastUploadResult: GcsCommandResult | null;
  lastDownloadResult: GcsMissionDownloadResult | null;
  setCurrentMissionType: (type: MissionDataType) => void;
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

function patchActiveItems(
  state: MissionStore,
  updater: (items: WaypointItem[]) => WaypointItem[],
): Pick<MissionStore, 'missionsByType'> {
  const type = state.currentMissionType;
  return {
    missionsByType: {
      ...state.missionsByType,
      [type]: updater(state.missionsByType[type]),
    },
  };
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  currentMissionType: MAV_MISSION_TYPE.MISSION,
  missionsByType: createEmptyMissionsByType(),
  isEditMode: false,
  uploadBusy: false,
  downloadBusy: false,
  lastUploadResult: null,
  lastDownloadResult: null,

  setCurrentMissionType: (type) =>
    set({ currentMissionType: normalizeMissionType(type) }),

  setEditMode: (enabled) => set({ isEditMode: enabled }),
  toggleEditMode: () => set((s) => ({ isEditMode: !s.isEditMode })),

  addWaypoint: (lat, lon, alt = DEFAULT_MISSION_WP_ALT_M) => {
    set((state) =>
      patchActiveItems(state, (items) => {
        const seq = items.length;
        return [...items, createWaypointItem(seq, lat, lon, alt)];
      }),
    );
  },

  updateWaypoint: (seq, patch) => {
    set((state) =>
      patchActiveItems(state, (items) =>
        items.map((wp) => (wp.seq === seq ? { ...wp, ...patch, seq: wp.seq } : wp)),
      ),
    );
  },

  removeWaypoint: (seq) => {
    set((state) =>
      patchActiveItems(state, (items) =>
        reindexWaypointItems(items.filter((wp) => wp.seq !== seq)),
      ),
    );
  },

  reorderWaypoint: (fromIndex, toIndex) => {
    set((state) =>
      patchActiveItems(state, (items) => {
        const next = [...items];
        if (fromIndex < 0 || fromIndex >= next.length) return items;
        if (toIndex < 0 || toIndex >= next.length) return items;
        if (fromIndex === toIndex) return items;
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return reindexWaypointItems(next);
      }),
    );
  },

  setWaypointCommand: (seq, command) => {
    set((state) =>
      patchActiveItems(state, (items) =>
        items.map((wp) => (wp.seq === seq ? { ...wp, command } : wp)),
      ),
    );
  },

  clearWaypoints: () =>
    set((state) => ({
      missionsByType: {
        ...state.missionsByType,
        [state.currentMissionType]: [],
      },
      lastUploadResult: null,
      lastDownloadResult: null,
    })),

  setWaypoints: (items) =>
    set((state) => ({
      missionsByType: {
        ...state.missionsByType,
        [state.currentMissionType]: reindexWaypointItems(items),
      },
    })),

  importWaypoints: (items) =>
    set((state) => ({
      missionsByType: {
        ...state.missionsByType,
        [state.currentMissionType]: reindexWaypointItems(items),
      },
      lastUploadResult: null,
      lastDownloadResult: null,
    })),

  uploadMission: async (options) => {
    const { missionsByType, currentMissionType } = get();
    const missionType = normalizeMissionType(options?.missionType ?? currentMissionType);
    const payload: GcsMissionPayload = {
      items: missionsByType[missionType],
      targetSystem: options?.targetSystem,
      targetComponent: options?.targetComponent,
      missionType,
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
    const { currentMissionType } = get();
    const missionType = normalizeMissionType(options?.missionType ?? currentMissionType);

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
      const result = await window.gcs.mission.download({
        ...options,
        missionType,
      });
      set({ lastDownloadResult: result });
      if (result.ok && result.waypoints) {
        set((state) => ({
          missionsByType: {
            ...state.missionsByType,
            [missionType]: reindexWaypointItems(result.waypoints!),
          },
        }));
      }
      return result;
    } finally {
      set({ downloadBusy: false });
    }
  },
}));

/** Active tab waypoints — use in UI selectors */
export function selectActiveWaypoints(state: MissionStore): WaypointItem[] {
  return state.missionsByType[state.currentMissionType];
}
