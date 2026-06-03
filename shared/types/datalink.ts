/** Datalink identifiers — independent stats per physical path */
export type DatalinkId = 'ethernet' | 'h16_rf';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type LinkQuality = 'good' | 'degraded' | 'poor' | 'offline';

export type TransportKind = 'udp-client' | 'udp-server' | 'tcp-client' | 'serial';

/** Why the router chose the current active link */
export type RouterSelectionReason =
  | 'none'
  | 'ethernet_preferred'
  | 'h16_fallback'
  | 'stale_failover'
  | 'tie_break_priority';

/** RTT source — TIMESYNC hook reserved for a later phase */
export type RttSource = 'none' | 'heartbeat_proxy' | 'timesync';

export interface LinkMetrics {
  packetsReceived: number;
  packetsLost: number;
  lossRatePercent: number;
  /** Rolling delay proxy from HEARTBEAT (ms); 0 if unknown */
  latencyMs: number;
  /** Time since last valid MAVLink frame on this link */
  lastPacketAgeMs: number;
  bytesReceived: number;
  updatedAt: number;
}

/** Per-link health flags for UI binding (independent of raw metrics) */
export interface LinkHealth {
  isConnected: boolean;
  /** Connected and last packet younger than stale threshold */
  isLive: boolean;
  /** Router may select this link as active */
  isEligibleForActive: boolean;
  /** True when this link is the current egress / fan-in winner */
  isActiveRoute: boolean;
}

export interface DatalinkSnapshot {
  id: DatalinkId;
  label: string;
  state: ConnectionState;
  quality: LinkQuality;
  transport?: TransportKind;
  endpoint?: string;
  metrics: LinkMetrics;
  health: LinkHealth;
}

/** Main-process router telemetry (dedup + active link) */
export interface RouterMetrics {
  framesIngested: number;
  framesDeduped: number;
  framesForwarded: number;
  dedupRatePercent: number;
  lastForwardedAt: number;
}

/** Per-link RTT slot — populated by TIMESYNC later */
export interface LinkRttSlot {
  rttMs: number | null;
  source: RttSource;
  updatedAt: number;
}

export interface RttEstimate {
  /** Best known RTT on the active link (ms) */
  activeRttMs: number | null;
  source: RttSource;
  perLink: Record<DatalinkId, LinkRttSlot>;
}

export interface MavlinkRouterSnapshot {
  activeLinkId: DatalinkId | null;
  selectionReason: RouterSelectionReason;
  metrics: RouterMetrics;
  rtt: RttEstimate;
}

/**
 * Unified IPC payload (Main → Renderer, ~200 ms).
 * Replaces bare `DatalinkSnapshot[]` on the wire.
 */
export interface DatalinkIpcPayload {
  links: DatalinkSnapshot[];
  router: MavlinkRouterSnapshot;
  updatedAt: number;
}

export interface EthernetConnectOptions {
  mode: 'udp-client' | 'udp-server' | 'tcp-client';
  host: string;
  port: number;
  localHost?: string;
  localPort?: number;
}

export interface SerialConnectOptions {
  path: string;
  baudRate: number;
}

export const DEFAULT_MAVLINK_PORT = 14550;

export const IPC_CHANNELS = {
  /** @deprecated payload shape — use DatalinkIpcPayload */
  DATALINK_SNAPSHOT: 'datalink:snapshot',
  ETHERNET_CONNECT: 'datalink:ethernet:connect',
  ETHERNET_DISCONNECT: 'datalink:ethernet:disconnect',
  H16_CONNECT: 'datalink:h16:connect',
  H16_DISCONNECT: 'datalink:h16:disconnect',
  LIST_SERIAL_PORTS: 'datalink:serial:list',
} as const;

/** Stale packet threshold aligned with link-quality.ts */
export const LINK_STALE_MS = 3000;
