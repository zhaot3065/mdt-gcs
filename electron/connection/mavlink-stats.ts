/**
 * Per-link MAVLink stream statistics: sequence-based loss + HEARTBEAT latency proxy.
 */

import { iterateMavlinkFrames } from './mavlink-frame';

const HEARTBEAT_MSG_ID = 0;

export interface MavlinkStatsSnapshot {
  packetsReceived: number;
  packetsLost: number;
  lossRatePercent: number;
  latencyMs: number;
  lastPacketAgeMs: number;
  bytesReceived: number;
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
    const now = Date.now();
    for (const { header } of iterateMavlinkFrames(buffer, now)) {
      this.onFrame(header, now);
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

  private onFrame(
    header: { seq: number; sysid: number; compid: number; msgId: number },
    now: number,
  ): void {
    this.lastReceiveAt = now;
    this.trackSequence(header.sysid, header.compid, header.seq);
    this.packetsReceived += 1;

    if (header.msgId === HEARTBEAT_MSG_ID) {
      if (this.lastHeartbeatAt > 0) {
        const interval = now - this.lastHeartbeatAt;
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
}
