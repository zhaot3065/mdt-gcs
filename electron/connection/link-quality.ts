import type { ConnectionState, LinkQuality, LinkMetrics } from '../../shared/types/datalink';

/** Field-operator signal thresholds (tunable) */
const LOSS_GOOD = 5;
const LOSS_DEGRADED = 15;
const LATENCY_GOOD_MS = 120;
const LATENCY_DEGRADED_MS = 350;
const STALE_MS = 3000;

export function computeLinkQuality(
  state: ConnectionState,
  metrics: LinkMetrics,
): LinkQuality {
  if (state !== 'connected') return 'offline';
  if (metrics.lastPacketAgeMs > STALE_MS) return 'poor';

  const loss = metrics.lossRatePercent;
  const lat = Math.max(metrics.latencyMs, metrics.lastPacketAgeMs);

  if (loss <= LOSS_GOOD && lat <= LATENCY_GOOD_MS) return 'good';
  if (loss <= LOSS_DEGRADED && lat <= LATENCY_DEGRADED_MS) return 'degraded';
  return 'poor';
}
