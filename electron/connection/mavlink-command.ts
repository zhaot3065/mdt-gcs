import type { GcsCommandRequest, GcsCommandType } from '../../shared/types/datalink';

const MAVLINK_V2_STX = 0xfd;
const MSG_ID_COMMAND_LONG = 76;
const CRC_EXTRA_COMMAND_LONG = 152;

/** GCS identity on the MAVLink bus */
const GCS_SYSTEM_ID = 255;
const GCS_COMPONENT_ID = 190;

const MAV_CMD_COMPONENT_ARM_DISARM = 400;
const MAV_CMD_NAV_RETURN_TO_LAUNCH = 20;

let outboundSeq = 0;

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

function packMavlinkV2(msgId: number, crcExtra: number, payload: Buffer): Buffer {
  const seq = outboundSeq++ & 0xff;
  const header = Buffer.alloc(9);
  header.writeUInt8(payload.length, 0);
  header.writeUInt8(0, 1); // incompat
  header.writeUInt8(0, 2); // compat
  header.writeUInt8(seq, 3);
  header.writeUInt8(GCS_SYSTEM_ID, 4);
  header.writeUInt8(GCS_COMPONENT_ID, 5);
  header.writeUInt8(msgId & 0xff, 6);
  header.writeUInt8((msgId >> 8) & 0xff, 7);
  header.writeUInt8((msgId >> 16) & 0xff, 8);

  const crcBuf = Buffer.concat([header, payload]);
  const crc = mavlinkCrc(crcBuf, crcExtra);
  const crcBytes = Buffer.alloc(2);
  crcBytes.writeUInt16LE(crc, 0);

  return Buffer.concat([Buffer.from([MAVLINK_V2_STX]), header, payload, crcBytes]);
}

function mavlinkCrc(data: Buffer, crcExtra: number): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    let tmp = data[i] ^ (crc & 0xff);
    tmp ^= (tmp << 4) & 0xff;
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3)) & 0xffff;
  }
  crc ^= crcExtra;
  return crc & 0xffff;
}

export function gcsCommandLabel(command: GcsCommandType): string {
  switch (command) {
    case 'arm':
      return 'ARM motors';
    case 'disarm':
      return 'DISARM motors';
    case 'rtl':
      return 'Return to Launch (RTL)';
    default:
      return String(command);
  }
}
