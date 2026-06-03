/** Datalink identifiers — independent stats per physical path */
export type DatalinkId = 'ethernet' | 'h16_rf';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type LinkQuality = 'good' | 'degraded' | 'poor' | 'offline';

export type TransportKind = 'udp-client' | 'udp-server' | 'tcp-client' | 'serial';

export interface LinkMetrics {
  packetsReceived: number;
  packetsLost: number;
  lossRatePercent: number;
  /** Rolling RTT estimate from HEARTBEAT (ms); 0 if unknown */
  latencyMs: number;
  /** Time since last valid MAVLink frame */
  lastPacketAgeMs: number;
  bytesReceived: number;
  updatedAt: number;
}

export interface DatalinkSnapshot {
  id: DatalinkId;
  label: string;
  state: ConnectionState;
  quality: LinkQuality;
  transport?: TransportKind;
  endpoint?: string;
  metrics: LinkMetrics;
}

export interface EthernetConnectOptions {
  mode: 'udp-client' | 'udp-server' | 'tcp-client';
  host: string;
  port: number;
  /** Local bind for UDP server / client (optional) */
  localHost?: string;
  localPort?: number;
}

export interface SerialConnectOptions {
  path: string;
  baudRate: number;
}

export const DEFAULT_MAVLINK_PORT = 14550;

export const IPC_CHANNELS = {
  DATALINK_SNAPSHOT: 'datalink:snapshot',
  ETHERNET_CONNECT: 'datalink:ethernet:connect',
  ETHERNET_DISCONNECT: 'datalink:ethernet:disconnect',
  H16_CONNECT: 'datalink:h16:connect',
  H16_DISCONNECT: 'datalink:h16:disconnect',
  LIST_SERIAL_PORTS: 'datalink:serial:list',
} as const;
