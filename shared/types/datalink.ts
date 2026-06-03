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

/** RTT measurement source (TIMESYNC preferred when available) */
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

/** Per-link RTT slot in router snapshot (TIMESYNC or HEARTBEAT fallback) */
export interface LinkRttSlot {
  /** Round-trip latency in milliseconds; null when not yet measured */
  rttMs: number | null;
  source: RttSource;
  updatedAt: number;
  /** TIMESYNC EWMA samples applied (Main only) */
  sampleCount?: number;
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
  /** OS serial device path (e.g. COM3, /dev/ttyUSB0) */
  path: string;
  baudRate: number;
}

/** Result of `datalink:serial:list` / SerialPort.list() */
export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

/** Default H16 / MAVLink serial baud (57600) */
export const DEFAULT_H16_BAUD_RATE = 57600;

/** Common baud rates for dropdown */
export const H16_BAUD_RATE_OPTIONS = [
  57600, 115200, 230400, 460800, 921600, 9600,
] as const;

export const DEFAULT_MAVLINK_PORT = 14550;

/** High-level GCS commands (Main builds MAVLink COMMAND_LONG) */
export type GcsCommandType = 'arm' | 'disarm' | 'rtl' | 'set_mode' | 'mission_upload';

export interface GcsCommandRequest {
  command: GcsCommandType;
  /** ArduPilot custom_mode — required when command is `set_mode` */
  customMode?: number;
  /** MAVLink target_system — default 1 */
  targetSystem?: number;
  /** MAVLink target_component — default 1 (autopilot) */
  targetComponent?: number;
}

export type GcsCommandErrorCode =
  | 'NO_ACTIVE_LINK'
  | 'LINK_NOT_CONNECTED'
  | 'LINK_NOT_LIVE'
  | 'ENCODE_FAILED'
  | 'SEND_FAILED';

export interface GcsCommandResult {
  ok: boolean;
  command: GcsCommandType;
  /** Link used for egress when ok */
  activeLinkId?: DatalinkId;
  bytesSent?: number;
  /** Mission upload: waypoint count announced via MISSION_COUNT */
  missionItemCount?: number;
  error?: string;
  errorCode?: GcsCommandErrorCode;
}

export const IPC_CHANNELS = {
  /** @deprecated payload shape — use DatalinkIpcPayload */
  DATALINK_SNAPSHOT: 'datalink:snapshot',
  ETHERNET_CONNECT: 'datalink:ethernet:connect',
  ETHERNET_DISCONNECT: 'datalink:ethernet:disconnect',
  H16_CONNECT: 'datalink:h16:connect',
  H16_DISCONNECT: 'datalink:h16:disconnect',
  LIST_SERIAL_PORTS: 'datalink:serial:list',
  /** Renderer → Main: egress on router active link only */
  SEND_COMMAND: 'datalink:send-command',
  /** Renderer → Main: mission upload (MISSION_COUNT stub; active link only) */
  MISSION_UPLOAD: 'datalink:mission:upload',
} as const;

/** Stale packet threshold aligned with link-quality.ts */
export const LINK_STALE_MS = 3000;
