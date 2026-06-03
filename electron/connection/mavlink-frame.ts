/**
 * MAVLink frame extraction shared by per-link stats and MavlinkRouter dedup.
 */

export const MAVLINK_V1_STX = 0xfe;
export const MAVLINK_V2_STX = 0xfd;

export interface MavlinkFrameHeader {
  stx: number;
  seq: number;
  sysid: number;
  compid: number;
  msgId: number;
}

export interface ExtractedMavlinkFrame {
  raw: Buffer;
  header: MavlinkFrameHeader;
  receivedAt: number;
}

export function parseFrameHeader(payload: Buffer, stx: number): MavlinkFrameHeader | null {
  if (stx === MAVLINK_V1_STX && payload.length >= 6) {
    return {
      stx,
      seq: payload[0],
      sysid: payload[3],
      compid: payload[4],
      msgId: payload[5],
    };
  }
  if (stx === MAVLINK_V2_STX && payload.length >= 9) {
    return {
      stx,
      seq: payload[3],
      sysid: payload[4],
      compid: payload[5],
      msgId: payload[6] | (payload[7] << 8) | (payload[8] << 16),
    };
  }
  return null;
}

export function dedupKey(header: MavlinkFrameHeader): string {
  return `${header.sysid}:${header.compid}:${header.msgId}:${header.seq}`;
}

export function* iterateMavlinkFrames(
  buffer: Buffer,
  receivedAt = Date.now(),
): Generator<ExtractedMavlinkFrame> {
  let offset = 0;
  while (offset < buffer.length) {
    const parsed = tryExtractFrame(buffer, offset);
    if (!parsed) break;
    offset = parsed.nextOffset;
    const header = parseFrameHeader(parsed.payload, parsed.stx);
    if (!header) continue;
    yield { raw: parsed.raw, header, receivedAt };
  }
}

function tryExtractFrame(
  buf: Buffer,
  start: number,
): { payload: Buffer; raw: Buffer; stx: number; nextOffset: number } | null {
  let i = start;
  while (i < buf.length) {
    const b = buf[i];
    if (b === MAVLINK_V1_STX) {
      if (i + 6 > buf.length) return null;
      const len = buf[i + 1];
      const frameLen = 6 + len + 2;
      if (i + frameLen > buf.length) return null;
      const raw = buf.subarray(i, i + frameLen);
      const payload = buf.subarray(i + 1, i + 6 + len);
      return { payload, raw, stx: MAVLINK_V1_STX, nextOffset: i + frameLen };
    }
    if (b === MAVLINK_V2_STX) {
      if (i + 12 > buf.length) return null;
      const len = buf[i + 1];
      const incompat = buf[i + 2];
      const signingExtra = (incompat & 0x01) !== 0 ? 13 : 0;
      const frameLen = 12 + len + 2 + signingExtra;
      if (i + frameLen > buf.length) return null;
      const raw = buf.subarray(i, i + frameLen);
      const payload = buf.subarray(i + 1, i + 12 + len);
      return { payload, raw, stx: MAVLINK_V2_STX, nextOffset: i + frameLen };
    }
    i += 1;
  }
  return null;
}
