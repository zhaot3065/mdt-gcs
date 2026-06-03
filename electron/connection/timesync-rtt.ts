import type { DatalinkId, LinkRttSlot } from '../../shared/types/datalink';
import { MAVLINK_V1_STX, MAVLINK_V2_STX, iterateMavlinkFrames } from './mavlink-frame';
import { packMavlinkV2 } from './mavlink-pack';

const MSG_ID_TIMESYNC = 111;
const CRC_EXTRA_TIMESYNC = 217;

/** GCS-initiated TIMESYNC ping interval per connected link */
export const TIMESYNC_PING_INTERVAL_MS = 1500;

const PENDING_TTL_MS = 8000;
const RTT_EWMA_ALPHA = 0.35;

const DATALINK_IDS: DatalinkId[] = ['ethernet', 'h16_rf'];

interface LinkTimesyncState {
  rttEwmaMs: number | null;
  sampleCount: number;
  updatedAt: number;
  lastPingAt: number;
  pending: Map<string, number>;
}

function gcsTimeUs(): bigint {
  return process.hrtime.bigint() / 1000n;
}

function nowUs(): number {
  return Number(process.hrtime.bigint() / 1000n);
}

function pendingKey(tc1: bigint): string {
  return tc1.toString();
}

function extractPayload(raw: Buffer): Buffer | null {
  const stx = raw[0];
  if (stx === MAVLINK_V2_STX) {
    const len = raw[1];
    if (raw.length < 12 + len + 2) return null;
    return raw.subarray(12, 12 + len);
  }
  if (stx === MAVLINK_V1_STX) {
    const len = raw[1];
    if (raw.length < 6 + len + 2) return null;
    return raw.subarray(6, 6 + len);
  }
  return null;
}

function parseTimesyncPayload(payload: Buffer): { ts1: bigint; tc1: bigint } | null {
  if (payload.length < 16) return null;
  const ts1 = payload.readBigInt64LE(0);
  const tc1 = payload.readBigInt64LE(8);
  return { ts1, tc1 };
}

export function encodeTimesyncRequest(tc1Us: bigint): Buffer {
  const payload = Buffer.alloc(16);
  payload.writeBigInt64LE(0n, 0);
  payload.writeBigInt64LE(tc1Us, 8);
  return packMavlinkV2(MSG_ID_TIMESYNC, CRC_EXTRA_TIMESYNC, payload);
}

/**
 * Per-link GCS-initiated MAVLink TIMESYNC RTT (ArduPilot #111).
 * Send: ts1=0, tc1=GCS time (µs). Response: ts1≠0, RTT ≈ now_us − tc1 (echoed).
 */
export class TimesyncRttManager {
  private readonly state = new Map<DatalinkId, LinkTimesyncState>();

  constructor() {
    for (const id of DATALINK_IDS) {
      this.state.set(id, this.emptyState());
    }
  }

  getRttMs(linkId: DatalinkId): number | null {
    const s = this.state.get(linkId);
    if (!s || s.rttEwmaMs === null) return null;
    return Math.round(s.rttEwmaMs);
  }

  getSlot(linkId: DatalinkId): LinkRttSlot | null {
    const s = this.state.get(linkId);
    if (!s || s.rttEwmaMs === null) return null;
    return {
      rttMs: Math.round(s.rttEwmaMs),
      source: 'timesync',
      updatedAt: s.updatedAt,
      sampleCount: s.sampleCount,
    };
  }

  resetLink(linkId: DatalinkId): void {
    this.state.set(linkId, this.emptyState());
  }

  handleIncoming(linkId: DatalinkId, buffer: Buffer): void {
    const s = this.state.get(linkId);
    if (!s) return;

    const now = Date.now();
    this.prunePending(s, now);

    for (const frame of iterateMavlinkFrames(buffer, now)) {
      if (frame.header.msgId !== MSG_ID_TIMESYNC) continue;
      const payload = extractPayload(frame.raw);
      if (!payload) continue;

      const parsed = parseTimesyncPayload(payload);
      if (!parsed || parsed.ts1 === 0n) continue;

      const tc1Key = pendingKey(parsed.tc1);
      const sentAt = s.pending.get(tc1Key);
      if (sentAt === undefined) continue;

      s.pending.delete(tc1Key);
      const rttUs = nowUs() - Number(parsed.tc1);
      if (rttUs <= 0 || rttUs > 30_000_000) continue;

      const rttMs = rttUs / 1000;
      s.rttEwmaMs =
        s.rttEwmaMs === null
          ? rttMs
          : s.rttEwmaMs * (1 - RTT_EWMA_ALPHA) + rttMs * RTT_EWMA_ALPHA;
      s.sampleCount += 1;
      s.updatedAt = now;
    }
  }

  maybeSendPing(
    linkId: DatalinkId,
    send: (frame: Buffer) => void,
    targetSystem = 1,
    targetComponent = 1,
  ): void {
    void targetSystem;
    void targetComponent;
    const s = this.state.get(linkId);
    if (!s) return;

    const now = Date.now();
    if (now - s.lastPingAt < TIMESYNC_PING_INTERVAL_MS) return;

    s.lastPingAt = now;
    this.prunePending(s, now);

    const tc1 = gcsTimeUs();
    const key = pendingKey(tc1);
    s.pending.set(key, now);

    send(encodeTimesyncRequest(tc1));
  }

  private emptyState(): LinkTimesyncState {
    return {
      rttEwmaMs: null,
      sampleCount: 0,
      updatedAt: 0,
      lastPingAt: 0,
      pending: new Map(),
    };
  }

  private prunePending(s: LinkTimesyncState, now: number): void {
    for (const [key, sentAt] of s.pending) {
      if (now - sentAt > PENDING_TTL_MS) s.pending.delete(key);
    }
  }
}
