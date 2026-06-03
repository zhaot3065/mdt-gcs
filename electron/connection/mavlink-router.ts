import { EventEmitter } from 'node:events';
import type {
  DatalinkId,
  DatalinkSnapshot,
  MavlinkRouterSnapshot,
  RouterSelectionReason,
  RouterMetrics,
  RttEstimate,
} from '../../shared/types/datalink';
import { LINK_STALE_MS } from '../../shared/types/datalink';
import { dedupKey, iterateMavlinkFrames, type ExtractedMavlinkFrame } from './mavlink-frame';

const DEDUP_TTL_MS = 2000;
const DEDUP_PRUNE_INTERVAL_MS = 5000;

/** Prefer SprintLink when scores are within this margin */
const ETHERNET_SCORE_BIAS = 5;

const LINK_PRIORITY: DatalinkId[] = ['ethernet', 'h16_rf'];

export interface ForwardedMavlinkFrame {
  linkId: DatalinkId;
  frame: ExtractedMavlinkFrame;
}

export interface MavlinkRouterOptions {
  /** Inject TIMESYNC-based RTT later */
  rttProvider?: (linkId: DatalinkId) => number | null;
}

/**
 * Fan-in for dual datalink: dedupe by (sysid, compid, msgid, seq) and pick active link.
 */
export class MavlinkRouter extends EventEmitter {
  private dedupCache = new Map<string, number>();
  private lastPruneAt = 0;

  private framesIngested = 0;
  private framesDeduped = 0;
  private framesForwarded = 0;
  private lastForwardedAt = 0;

  private activeLinkId: DatalinkId | null = null;
  private selectionReason: RouterSelectionReason = 'none';

  private rttProvider?: (linkId: DatalinkId) => number | null;

  constructor(options: MavlinkRouterOptions = {}) {
    super();
    this.rttProvider = options.rttProvider;
  }

  /**
   * Raw bytes from a physical link — stats remain in MavlinkStreamStats separately.
   */
  ingest(linkId: DatalinkId, buffer: Buffer, receivedAt = Date.now()): void {
    this.pruneDedupCache(receivedAt);

    for (const frame of iterateMavlinkFrames(buffer, receivedAt)) {
      this.framesIngested += 1;
      const key = dedupKey(frame.header);

      if (this.isDuplicate(key, receivedAt)) {
        this.framesDeduped += 1;
        continue;
      }

      this.framesForwarded += 1;
      this.lastForwardedAt = receivedAt;
      this.emit('frame', { linkId, frame } satisfies ForwardedMavlinkFrame);
    }
  }

  /**
   * Re-evaluate active link from latest per-link snapshots (called on metrics tick).
   */
  updateActiveLink(links: DatalinkSnapshot[]): void {
    const prev = this.activeLinkId;
    const { id, reason } = selectActiveLink(links);
    this.activeLinkId = id;
    this.selectionReason = reason;

    if (prev !== id) {
      this.emit('active-link-changed', { from: prev, to: id, reason });
    }
  }

  getSnapshot(links: DatalinkSnapshot[]): MavlinkRouterSnapshot {
    this.updateActiveLink(links);
    return {
      activeLinkId: this.activeLinkId,
      selectionReason: this.selectionReason,
      metrics: this.buildRouterMetrics(),
      rtt: this.buildRttEstimate(links),
    };
  }

  reset(): void {
    this.dedupCache.clear();
    this.framesIngested = 0;
    this.framesDeduped = 0;
    this.framesForwarded = 0;
    this.lastForwardedAt = 0;
    this.activeLinkId = null;
    this.selectionReason = 'none';
  }

  getActiveLinkId(): DatalinkId | null {
    return this.activeLinkId;
  }

  private isDuplicate(key: string, now: number): boolean {
    const seenAt = this.dedupCache.get(key);
    if (seenAt !== undefined && now - seenAt < DEDUP_TTL_MS) {
      return true;
    }
    this.dedupCache.set(key, now);
    return false;
  }

  private pruneDedupCache(now: number): void {
    if (now - this.lastPruneAt < DEDUP_PRUNE_INTERVAL_MS) return;
    this.lastPruneAt = now;
    for (const [key, ts] of this.dedupCache) {
      if (now - ts > DEDUP_TTL_MS) this.dedupCache.delete(key);
    }
  }

  private buildRouterMetrics(): RouterMetrics {
    const total = this.framesIngested;
    const dedupRatePercent =
      total > 0 ? Math.round((this.framesDeduped / total) * 1000) / 10 : 0;
    return {
      framesIngested: this.framesIngested,
      framesDeduped: this.framesDeduped,
      framesForwarded: this.framesForwarded,
      dedupRatePercent,
      lastForwardedAt: this.lastForwardedAt,
    };
  }

  private buildRttEstimate(links: DatalinkSnapshot[]): RttEstimate {
    const perLink = {} as RttEstimate['perLink'];
    for (const id of LINK_PRIORITY) {
      const link = links.find((l) => l.id === id);
      const timesyncRtt = this.rttProvider?.(id) ?? null;
      if (timesyncRtt !== null) {
        perLink[id] = { rttMs: timesyncRtt, source: 'timesync', updatedAt: Date.now() };
      } else if (link && link.state === 'connected' && link.metrics.latencyMs > 0) {
        perLink[id] = {
          rttMs: link.metrics.latencyMs,
          source: 'heartbeat_proxy',
          updatedAt: link.metrics.updatedAt,
        };
      } else {
        perLink[id] = { rttMs: null, source: 'none', updatedAt: Date.now() };
      }
    }

    const active = this.activeLinkId;
    const activeSlot = active ? perLink[active] : null;

    return {
      activeRttMs: activeSlot?.rttMs ?? null,
      source: activeSlot?.source ?? 'none',
      perLink,
    };
  }
}

function linkScore(link: DatalinkSnapshot): number {
  if (link.state !== 'connected') return -Infinity;
  if (!link.health.isLive) return -Infinity;

  const m = link.metrics;
  return (
    1000 -
    m.lossRatePercent * 12 -
    m.latencyMs * 0.5 -
    m.lastPacketAgeMs * 0.2
  );
}

function selectActiveLink(links: DatalinkSnapshot[]): {
  id: DatalinkId | null;
  reason: RouterSelectionReason;
} {
  const scored = LINK_PRIORITY.map((id) => {
    const link = links.find((l) => l.id === id);
    return { id, link, score: link ? linkScore(link) : -Infinity };
  }).filter((s) => s.score > -Infinity);

  if (scored.length === 0) {
    return { id: null, reason: 'none' };
  }

  scored.sort((a, b) => {
    const diff = b.score - a.score;
    if (Math.abs(diff) <= ETHERNET_SCORE_BIAS) {
      return LINK_PRIORITY.indexOf(a.id) - LINK_PRIORITY.indexOf(b.id);
    }
    return diff;
  });

  const winner = scored[0];
  const ethernet = links.find((l) => l.id === 'ethernet');
  const h16 = links.find((l) => l.id === 'h16_rf');

  if (winner.id === 'ethernet') {
    if (ethernet && !ethernet.health.isLive && h16?.health.isLive) {
      return { id: 'h16_rf', reason: 'stale_failover' };
    }
    const closeSecond = scored[1];
    if (closeSecond && Math.abs(winner.score - closeSecond.score) <= ETHERNET_SCORE_BIAS) {
      return { id: 'ethernet', reason: 'tie_break_priority' };
    }
    return { id: 'ethernet', reason: 'ethernet_preferred' };
  }

  if (ethernet?.health.isEligibleForActive && winner.id === 'h16_rf') {
    return { id: 'h16_rf', reason: 'h16_fallback' };
  }

  return { id: winner.id, reason: 'h16_fallback' };
}

export function buildLinkHealth(
  link: Omit<DatalinkSnapshot, 'health'>,
  activeLinkId: DatalinkId | null,
): DatalinkSnapshot['health'] {
  const isConnected = link.state === 'connected';
  const isLive = isConnected && link.metrics.lastPacketAgeMs < LINK_STALE_MS;
  return {
    isConnected,
    isLive,
    isEligibleForActive: isLive,
    isActiveRoute: activeLinkId === link.id,
  };
}
