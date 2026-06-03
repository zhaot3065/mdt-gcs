/**
 * Per-link MAVLink stream statistics: sequence-based loss + HEARTBEAT latency proxy.
 * Supports MAVLink v1 (0xFE) and v2 (0xFD) framing.
 */

const MAVLINK_V1_STX = 0xfe;
const MAVLINK_V2_STX = 0xfd;
const HEARTBEAT_MSG_ID_V1 = 0;
const HEARTBEAT_MSG_ID_V2 = 0;

export interface MavlinkStatsSnapshot {
  packetsReceived: number;
  packetsLost: number;
  lossRatePercent: number;
  latencyMs: number;
  lastPacketAgeMs: number;
  bytesReceived: number;
}

interface SeqKey {
  sysid: number;
  compid: number;
}

export class MavlinkStreamStats {
  private bytesReceived = 0;
  private packetsReceived = 0;
  private packetsLost = 0;
  private lastSeq = new Map<string, number>();
  private lastReceiveAt = 0;
  private latencyEwma = 0;
  private lastHeartbeatAt = 0;

  ingest(buffer: Buffer): void {
    this.bytesReceived += buffer.length;
    let offset = 0;
    while (offset < buffer.length) {
      const frame = this.tryExtractFrame(buffer, offset);
      if (!frame) break;
      offset = frame.nextOffset;
      this.onFrame(frame.payload, frame.stx);
    }
    if (this.lastReceiveAt > 0) {
      // age updated on each ingest call from main tick — computed at snapshot time
    }
  }

  snapshot(now = Date.now()): MavlinkStatsSnapshot {
    const total = this.packetsReceived + this.packetsLost;
    const lossRatePercent =
      total > 0 ? Math.min(100, (this.packetsLost / total) * 100) : 0;
    const lastPacketAgeMs =
      this.lastReceiveAt > 0 ? Math.max(0, now - this.lastReceiveAt) : 0;

    return {
      packetsReceived: this.packetsReceived,
      packetsLost: this.packetsLost,
      lossRatePercent: Math.round(lossRatePercent * 10) / 10,
      latencyMs: Math.round(this.latencyEwma),
      lastPacketAgeMs,
      bytesReceived: this.bytesReceived,
    };
  }

  reset(): void {
    this.bytesReceived = 0;
    this.packetsReceived = 0;
    this.packetsLost = 0;
    this.lastSeq.clear();
    this.lastReceiveAt = 0;
    this.latencyEwma = 0;
    this.lastHeartbeatAt = 0;
  }

  private onFrame(payload: Buffer, stx: number): void {
    const now = Date.now();
    this.lastReceiveAt = now;

    let sysid: number;
    let compid: number;
    let seq: number;
    let msgId: number;

    if (stx === MAVLINK_V1_STX && payload.length >= 6) {
      seq = payload[0];
      sysid = payload[3];
      compid = payload[4];
      msgId = payload[5];
    } else if (stx === MAVLINK_V2_STX && payload.length >= 9) {
      seq = payload[3];
      sysid = payload[4];
      compid = payload[5];
      msgId = payload[6] | (payload[7] << 8) | (payload[8] << 16);
    } else {
      return;
    }

    this.trackSequence(sysid, compid, seq);
    this.packetsReceived += 1;

    if (msgId === HEARTBEAT_MSG_ID_V1 || msgId === HEARTBEAT_MSG_ID_V2) {
      if (this.lastHeartbeatAt > 0) {
        const interval = now - this.lastHeartbeatAt;
        // Expected ~1000 ms; deviation treated as one-way delay indicator
        const deviation = Math.abs(interval - 1000);
        const alpha = 0.2;
        this.latencyEwma =
          this.latencyEwma === 0
            ? deviation
            : alpha * deviation + (1 - alpha) * this.latencyEwma;
      }
      this.lastHeartbeatAt = now;
    }
  }

  private trackSequence(sysid: number, compid: number, seq: number): void {
    const key = `${sysid}:${compid}`;
    const prev = this.lastSeq.get(key);
    if (prev !== undefined) {
      const expected = (prev + 1) & 0xff;
      if (seq !== expected) {
        const gap = (seq - expected + 256) & 0xff;
        this.packetsLost += gap > 0 ? gap : 1;
      }
    }
    this.lastSeq.set(key, seq);
  }

  private tryExtractFrame(
    buf: Buffer,
    start: number,
  ): { payload: Buffer; stx: number; nextOffset: number } | null {
    let i = start;
    while (i < buf.length) {
      const b = buf[i];
      if (b === MAVLINK_V1_STX) {
        if (i + 6 > buf.length) return null;
        const len = buf[i + 1];
        const frameLen = 6 + len + 2;
        if (i + frameLen > buf.length) return null;
        const payload = buf.subarray(i + 1, i + 6 + len);
        return { payload, stx: MAVLINK_V1_STX, nextOffset: i + frameLen };
      }
      if (b === MAVLINK_V2_STX) {
        if (i + 12 > buf.length) return null;
        const len = buf[i + 1];
        const incompat = buf[i + 2];
        const signingExtra = (incompat & 0x01) !== 0 ? 13 : 0;
        const frameLen = 12 + len + 2 + signingExtra;
        if (i + frameLen > buf.length) return null;
        const payload = buf.subarray(i + 1, i + 12 + len);
        return { payload, stx: MAVLINK_V2_STX, nextOffset: i + frameLen };
      }
      i += 1;
    }
    return null;
  }
}
