/**
 * Mission planner IPC contract (Renderer ↔ Main).
 * ArduPilot waypoint upload — full MISSION_ITEM_INT handshake in Main.
 */

/** Essential MAV_CMD nav commands for multicopter / VTOL missions */
export const MAV_CMD = {
  NAV_WAYPOINT: 16,
  NAV_TAKEOFF: 22,
  NAV_LAND: 21,
  NAV_RETURN_TO_LAUNCH: 20,
} as const;

export type MissionNavCommand = (typeof MAV_CMD)[keyof typeof MAV_CMD];

/** UI dropdown options — value is MAV_CMD integer */
export const MISSION_CMD_OPTIONS = [
  { value: MAV_CMD.NAV_WAYPOINT, label: 'WAYPOINT' },
  { value: MAV_CMD.NAV_TAKEOFF, label: 'TAKEOFF' },
  { value: MAV_CMD.NAV_LAND, label: 'LAND' },
  { value: MAV_CMD.NAV_RETURN_TO_LAUNCH, label: 'RTL' },
] as const;

const CMD_LABEL: Record<number, string> = {
  [MAV_CMD.NAV_WAYPOINT]: 'WAYPOINT',
  [MAV_CMD.NAV_TAKEOFF]: 'TAKEOFF',
  [MAV_CMD.NAV_LAND]: 'LAND',
  [MAV_CMD.NAV_RETURN_TO_LAUNCH]: 'RTL',
};

export function mavCommandLabel(command: number): string {
  return CMD_LABEL[command] ?? `CMD ${command}`;
}

export function isMissionNavCommand(command: number): command is MissionNavCommand {
  return Object.values(MAV_CMD).includes(command as MissionNavCommand);
}

/** MAV_MISSION_TYPE — mission storage target */
export const MAV_MISSION_TYPE = {
  MISSION: 0,
  FENCE: 1,
  RALLY: 2,
} as const;

/** Single mission item (maps to future MISSION_ITEM_INT fields) */
export interface WaypointItem {
  /** Zero-based sequence in the upload list */
  seq: number;
  /** MAV_CMD enum (e.g. MAV_CMD_NAV_WAYPOINT = 16) */
  command: number;
  lat: number;
  lon: number;
  /** Altitude in meters (relative frame for copter missions) */
  alt: number;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
}

/** Renderer → Main invoke payload for `datalink:mission:download` */
export interface GcsMissionDownloadPayload {
  targetSystem?: number;
  targetComponent?: number;
  missionType?: number;
}

/** Main → Renderer result for `datalink:mission:download` */
export interface GcsMissionDownloadResult {
  ok: boolean;
  waypoints?: WaypointItem[];
  error?: string;
}

/** Renderer → Main invoke payload for `datalink:mission:upload` */
export interface GcsMissionPayload {
  items: WaypointItem[];
  /** MAVLink target_system — default 1 */
  targetSystem?: number;
  /** MAVLink target_component — default 1 (autopilot) */
  targetComponent?: number;
  /** MAV_MISSION_TYPE — default 0 (mission) */
  missionType?: number;
}

/** Default altitude (m) when adding waypoints from the map editor */
export const DEFAULT_MISSION_WP_ALT_M = 100;

export function createWaypointItem(
  seq: number,
  lat: number,
  lon: number,
  alt = DEFAULT_MISSION_WP_ALT_M,
  command: number = MAV_CMD.NAV_WAYPOINT,
): WaypointItem {
  return {
    seq,
    command,
    lat,
    lon,
    alt,
    param1: 0,
    param2: 0,
    param3: 0,
    param4: 0,
  };
}

/** Reassign seq 0..n-1 after list edits */
export function reindexWaypointItems(items: WaypointItem[]): WaypointItem[] {
  return items.map((item, index) => ({ ...item, seq: index }));
}

/** Renderer-only mission JSON file (Export / Import — no IPC) */
export interface MissionFileDocument {
  version: 1;
  exportedAt: string;
  waypoints: WaypointItem[];
}

export function buildMissionFileDocument(waypoints: WaypointItem[]): MissionFileDocument {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    waypoints: reindexWaypointItems(waypoints),
  };
}

function isWaypointItem(raw: unknown): raw is WaypointItem {
  if (!raw || typeof raw !== 'object') return false;
  const w = raw as Record<string, unknown>;
  return (
    typeof w.seq === 'number' &&
    typeof w.command === 'number' &&
    typeof w.lat === 'number' &&
    typeof w.lon === 'number' &&
    typeof w.alt === 'number' &&
    Number.isFinite(w.lat) &&
    Number.isFinite(w.lon)
  );
}

/** Parse imported JSON — throws on invalid structure */
export function parseMissionFileDocument(json: unknown): WaypointItem[] {
  let data = json;
  if (typeof json === 'string') {
    data = JSON.parse(json) as unknown;
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid mission file: expected JSON object');
  }
  const doc = data as Record<string, unknown>;
  const list = Array.isArray(doc.waypoints)
    ? doc.waypoints
    : Array.isArray(data)
      ? (data as unknown[])
      : null;
  if (!list || list.length === 0) {
    throw new Error('Invalid mission file: waypoints array is empty or missing');
  }
  if (!list.every(isWaypointItem)) {
    throw new Error('Invalid mission file: waypoint entry missing required fields');
  }
  return reindexWaypointItems(
    list.map((item) => ({
      seq: item.seq,
      command: item.command,
      lat: item.lat,
      lon: item.lon,
      alt: item.alt,
      param1: typeof item.param1 === 'number' ? item.param1 : 0,
      param2: typeof item.param2 === 'number' ? item.param2 : 0,
      param3: typeof item.param3 === 'number' ? item.param3 : 0,
      param4: typeof item.param4 === 'number' ? item.param4 : 0,
    })),
  );
}
