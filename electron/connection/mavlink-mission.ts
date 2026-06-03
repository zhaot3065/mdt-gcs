import { MAV_MISSION_TYPE, type WaypointItem } from '../../shared/types/mission';
import { MAVLINK_V1_STX, MAVLINK_V2_STX } from './mavlink-frame';
import { packMavlinkV2 } from './mavlink-pack';

export const MSG_ID_MISSION_ITEM_INT = 38;
export const MSG_ID_MISSION_REQUEST = 40;
export const MSG_ID_MISSION_REQUEST_LIST = 43;
export const MSG_ID_MISSION_COUNT = 44;
export const MSG_ID_MISSION_ACK = 47;
export const MSG_ID_MISSION_REQUEST_INT = 51;

const CRC_EXTRA_MISSION_ITEM_INT = 38;
const CRC_EXTRA_MISSION_COUNT = 221;
const CRC_EXTRA_MISSION_REQUEST_LIST = 132;
const CRC_EXTRA_MISSION_REQUEST_INT = 196;
const CRC_EXTRA_MISSION_ACK = 153;

/** MAV_FRAME_GLOBAL_RELATIVE_ALT — typical for ArduPilot copter waypoints */
export const MAV_FRAME_GLOBAL_RELATIVE_ALT = 3;

/** MAV_MISSION_RESULT — MISSION_ACK.type */
export const MAV_MISSION_ACCEPTED = 0;

export interface MissionCountParams {
  targetSystem: number;
  targetComponent: number;
  count: number;
  missionType?: number;
}

export interface MissionItemIntParams {
  item: WaypointItem;
  targetSystem: number;
  targetComponent: number;
  missionType?: number;
  frame?: number;
  current?: number;
  autocontinue?: number;
}

export interface MissionRequestListParams {
  targetSystem: number;
  targetComponent: number;
  missionType?: number;
}

export interface MissionRequestIntParams {
  targetSystem: number;
  targetComponent: number;
  seq: number;
  missionType?: number;
}

export interface MissionAckParams {
  targetSystem: number;
  targetComponent: number;
  type?: number;
  missionType?: number;
}

export function encodeMissionCount(params: MissionCountParams): Buffer {
  const payload = Buffer.alloc(5);
  payload.writeUInt8(params.targetSystem, 0);
  payload.writeUInt8(params.targetComponent, 1);
  payload.writeUInt16LE(params.count, 2);
  payload.writeUInt8(params.missionType ?? MAV_MISSION_TYPE.MISSION, 4);
  return packMavlinkV2(MSG_ID_MISSION_COUNT, CRC_EXTRA_MISSION_COUNT, payload);
}

/**
 * MISSION_ITEM_INT (#38) — lat/lon as int32 degrees * 1e7, alt as float meters.
 */
export function encodeMissionItemInt(params: MissionItemIntParams): Buffer {
  const { item } = params;
  const payload = Buffer.alloc(38);
  payload.writeFloatLE(item.param1, 0);
  payload.writeFloatLE(item.param2, 4);
  payload.writeFloatLE(item.param3, 8);
  payload.writeFloatLE(item.param4, 12);
  payload.writeInt32LE(Math.round(item.lat * 1e7), 16);
  payload.writeInt32LE(Math.round(item.lon * 1e7), 20);
  payload.writeFloatLE(item.alt, 24);
  payload.writeUInt16LE(item.seq, 28);
  payload.writeUInt16LE(item.command, 30);
  payload.writeUInt8(params.targetSystem, 32);
  payload.writeUInt8(params.targetComponent, 33);
  payload.writeUInt8(params.frame ?? MAV_FRAME_GLOBAL_RELATIVE_ALT, 34);
  payload.writeUInt8(params.current ?? 0, 35);
  payload.writeUInt8(params.autocontinue ?? 1, 36);
  payload.writeUInt8(params.missionType ?? MAV_MISSION_TYPE.MISSION, 37);
  return packMavlinkV2(MSG_ID_MISSION_ITEM_INT, CRC_EXTRA_MISSION_ITEM_INT, payload);
}

export function encodeMissionRequestList(params: MissionRequestListParams): Buffer {
  const payload = Buffer.alloc(3);
  payload.writeUInt8(params.targetSystem, 0);
  payload.writeUInt8(params.targetComponent, 1);
  payload.writeUInt8(params.missionType ?? MAV_MISSION_TYPE.MISSION, 2);
  return packMavlinkV2(MSG_ID_MISSION_REQUEST_LIST, CRC_EXTRA_MISSION_REQUEST_LIST, payload);
}

export function encodeMissionRequestInt(params: MissionRequestIntParams): Buffer {
  const payload = Buffer.alloc(5);
  payload.writeUInt8(params.targetSystem, 0);
  payload.writeUInt8(params.targetComponent, 1);
  payload.writeUInt16LE(params.seq, 2);
  payload.writeUInt8(params.missionType ?? MAV_MISSION_TYPE.MISSION, 4);
  return packMavlinkV2(MSG_ID_MISSION_REQUEST_INT, CRC_EXTRA_MISSION_REQUEST_INT, payload);
}

export function encodeMissionAck(params: MissionAckParams): Buffer {
  const payload = Buffer.alloc(4);
  payload.writeUInt8(params.targetSystem, 0);
  payload.writeUInt8(params.targetComponent, 1);
  payload.writeUInt8(params.type ?? MAV_MISSION_ACCEPTED, 2);
  payload.writeUInt8(params.missionType ?? MAV_MISSION_TYPE.MISSION, 3);
  return packMavlinkV2(MSG_ID_MISSION_ACK, CRC_EXTRA_MISSION_ACK, payload);
}

export function extractMavlinkPayload(raw: Buffer): Buffer | null {
  if (raw.length < 8) return null;
  const stx = raw[0];
  if (stx === MAVLINK_V1_STX) {
    const len = raw[1];
    if (raw.length < 6 + len + 2) return null;
    return raw.subarray(6, 6 + len);
  }
  if (stx === MAVLINK_V2_STX) {
    const len = raw[1];
    if (raw.length < 12 + len + 2) return null;
    return raw.subarray(12, 12 + len);
  }
  return null;
}

/** MISSION_COUNT (#44) — autopilot reports item count to GCS */
export function parseMissionCount(payload: Buffer): { count: number; missionType: number } | null {
  if (payload.length < 5) return null;
  return {
    count: payload.readUInt16LE(0),
    missionType: payload.readUInt8(4),
  };
}

/** MISSION_ITEM_INT (#38) — lat/lon int32 degrees × 1e7 → float degrees */
export function parseMissionItemInt(payload: Buffer): WaypointItem | null {
  if (payload.length < 38) return null;
  const lat = payload.readInt32LE(16) / 1e7;
  const lon = payload.readInt32LE(20) / 1e7;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    param1: payload.readFloatLE(0),
    param2: payload.readFloatLE(4),
    param3: payload.readFloatLE(8),
    param4: payload.readFloatLE(12),
    lat,
    lon,
    alt: payload.readFloatLE(24),
    seq: payload.readUInt16LE(28),
    command: payload.readUInt16LE(30),
  };
}

/** MISSION_REQUEST (#40) — autopilot requests seq from GCS */
export function parseMissionRequestSeq(payload: Buffer): number | null {
  if (payload.length < 4) return null;
  return payload.readUInt16LE(2);
}

/** MISSION_REQUEST_INT (#51) */
export function parseMissionRequestInt(payload: Buffer): { seq: number; missionType: number } | null {
  if (payload.length < 5) return null;
  return {
    seq: payload.readUInt16LE(2),
    missionType: payload.readUInt8(4),
  };
}

/** MISSION_ACK (#47) */
export function parseMissionAck(payload: Buffer): { type: number; missionType: number } | null {
  if (payload.length < 4) return null;
  return {
    type: payload.readUInt8(2),
    missionType: payload.readUInt8(3),
  };
}
