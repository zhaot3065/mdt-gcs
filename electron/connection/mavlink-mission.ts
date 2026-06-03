import { MAV_MISSION_TYPE } from '../../shared/types/mission';
import { packMavlinkV2 } from './mavlink-pack';

const MSG_ID_MISSION_COUNT = 44;
const CRC_EXTRA_MISSION_COUNT = 221;

export interface MissionCountParams {
  targetSystem: number;
  targetComponent: number;
  count: number;
  missionType?: number;
}

/**
 * MAVLink MISSION_COUNT (#44) — announces mission item count to autopilot.
 * Full MISSION_ITEM_INT handshake follows in a later phase.
 */
export function encodeMissionCount(params: MissionCountParams): Buffer {
  const payload = Buffer.alloc(5);
  payload.writeUInt8(params.targetSystem, 0);
  payload.writeUInt8(params.targetComponent, 1);
  payload.writeUInt16LE(params.count, 2);
  payload.writeUInt8(params.missionType ?? MAV_MISSION_TYPE.MISSION, 4);
  return packMavlinkV2(MSG_ID_MISSION_COUNT, CRC_EXTRA_MISSION_COUNT, payload);
}
