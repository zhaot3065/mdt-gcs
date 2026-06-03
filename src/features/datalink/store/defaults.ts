import type {
  DatalinkIpcPayload,
  DatalinkSnapshot,
  MavlinkRouterSnapshot,
} from '@shared/types/datalink';

const emptyMetrics = {
  packetsReceived: 0,
  packetsLost: 0,
  lossRatePercent: 0,
  latencyMs: 0,
  lastPacketAgeMs: 0,
  bytesReceived: 0,
  updatedAt: 0,
};

const offlineHealth = {
  isConnected: false,
  isLive: false,
  isEligibleForActive: false,
  isActiveRoute: false,
};

function link(id: DatalinkSnapshot['id'], label: string): DatalinkSnapshot {
  return {
    id,
    label,
    state: 'disconnected',
    quality: 'offline',
    metrics: { ...emptyMetrics },
    health: { ...offlineHealth },
  };
}

export const defaultRouterSnapshot: MavlinkRouterSnapshot = {
  activeLinkId: null,
  selectionReason: 'none',
  metrics: {
    framesIngested: 0,
    framesDeduped: 0,
    framesForwarded: 0,
    dedupRatePercent: 0,
    lastForwardedAt: 0,
  },
  rtt: {
    activeRttMs: null,
    source: 'none',
    perLink: {
      ethernet: { rttMs: null, source: 'none', updatedAt: 0 },
      h16_rf: { rttMs: null, source: 'none', updatedAt: 0 },
    },
  },
};

export const defaultDatalinkPayload: DatalinkIpcPayload = {
  links: [link('ethernet', 'SprintLink (Ethernet)'), link('h16_rf', 'H16 RF')],
  router: defaultRouterSnapshot,
  updatedAt: 0,
};
