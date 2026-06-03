import type { DatalinkId, LinkRttSlot, RttEstimate } from '@shared/types/datalink';

export function formatRttMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

export function formatRttSlot(slot: LinkRttSlot | undefined): string {
  if (!slot || slot.rttMs == null) return '—';
  const label = slot.source === 'timesync' ? 'TIMESYNC' : 'HB est.';
  return `${formatRttMs(slot.rttMs)} (${label})`;
}

export function perLinkRttSlot(rtt: RttEstimate, linkId: DatalinkId): LinkRttSlot | undefined {
  return rtt.perLink[linkId];
}
