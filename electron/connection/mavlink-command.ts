import type { GcsCommandRequest, GcsCommandType } from '../../shared/types/datalink';
import { packMavlinkV2 } from './mavlink-pack';

const MSG_ID_COMMAND_LONG = 76;
const CRC_EXTRA_COMMAND_LONG = 152;

const MAV_CMD_COMPONENT_ARM_DISARM = 400;
const MAV_CMD_NAV_RETURN_TO_LAUNCH = 20;
const MAV_CMD_DO_SET_MODE = 176;
/** MAV_MODE_FLAG_CUSTOM_MODE_ENABLED */
const MAV_MODE_FLAG_CUSTOM_MODE_ENABLED = 1;

export interface CommandLongParams {
  command: number;
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;
  param5?: number;
  param6?: number;
  param7?: number;
  targetSystem?: number;
  targetComponent?: number;
  confirmation?: number;
}

export function buildCommandFromGcsRequest(req: GcsCommandRequest): Buffer | null {
  const targetSystem = req.targetSystem ?? 1;
  const targetComponent = req.targetComponent ?? 1;

  switch (req.command) {
    case 'arm':
      return encodeCommandLong({
        command: MAV_CMD_COMPONENT_ARM_DISARM,
        param1: 1,
        targetSystem,
        targetComponent,
      });
    case 'disarm':
      return encodeCommandLong({
        command: MAV_CMD_COMPONENT_ARM_DISARM,
        param1: 0,
        targetSystem,
        targetComponent,
      });
    case 'rtl':
      return encodeCommandLong({
        command: MAV_CMD_NAV_RETURN_TO_LAUNCH,
        targetSystem,
        targetComponent,
      });
    case 'set_mode':
      if (req.customMode === undefined || !Number.isFinite(req.customMode)) {
        return null;
      }
      return encodeCommandLong({
        command: MAV_CMD_DO_SET_MODE,
        param1: MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
        param2: req.customMode,
        targetSystem,
        targetComponent,
      });
    default:
      return null;
  }
}

export function encodeCommandLong(params: CommandLongParams): Buffer {
  const payload = Buffer.alloc(33);
  payload.writeFloatLE(params.param1 ?? 0, 0);
  payload.writeFloatLE(params.param2 ?? 0, 4);
  payload.writeFloatLE(params.param3 ?? 0, 8);
  payload.writeFloatLE(params.param4 ?? 0, 12);
  payload.writeFloatLE(params.param5 ?? 0, 16);
  payload.writeFloatLE(params.param6 ?? 0, 20);
  payload.writeFloatLE(params.param7 ?? 0, 24);
  payload.writeUInt16LE(params.command, 28);
  payload.writeUInt8(params.targetSystem ?? 1, 30);
  payload.writeUInt8(params.targetComponent ?? 1, 31);
  payload.writeUInt8(params.confirmation ?? 0, 32);

  return packMavlinkV2(MSG_ID_COMMAND_LONG, CRC_EXTRA_COMMAND_LONG, payload);
}

export function gcsCommandLabel(command: GcsCommandType, reqCustomMode?: number): string {
  switch (command) {
    case 'arm':
      return 'ARM motors';
    case 'disarm':
      return 'DISARM motors';
    case 'rtl':
      return 'Return to Launch (RTL)';
    case 'set_mode':
      return reqCustomMode != null
        ? `Set flight mode (custom_mode ${reqCustomMode})`
        : 'Set flight mode';
    default:
      return String(command);
  }
}
