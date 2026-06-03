/** Shared MAVLink v2 frame packer for GCS egress */

export const MAVLINK_V2_STX = 0xfd;
export const GCS_SYSTEM_ID = 255;
export const GCS_COMPONENT_ID = 190;

let outboundSeq = 0;

export function packMavlinkV2(msgId: number, crcExtra: number, payload: Buffer): Buffer {
  const seq = outboundSeq++ & 0xff;
  const header = Buffer.alloc(9);
  header.writeUInt8(payload.length, 0);
  header.writeUInt8(0, 1);
  header.writeUInt8(0, 2);
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
