/**
 * Mission planner IPC contract (Renderer ↔ Main).
 * ArduPilot waypoint upload — MISSION_COUNT handshake stub in Main today;
 * full MISSION_ITEM_INT exchange in a later phase.
 */

/** Common MAV_CMD values for ArduPilot nav missions */
export const MAV_CMD = {
  NAV_WAYPOINT: 16,
  NAV_TAKEOFF: 22,
  NAV_LAND: 21,
  NAV_RETURN_TO_LAUNCH: 20,
} as const;

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
