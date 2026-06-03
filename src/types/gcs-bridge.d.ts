import type {
  DatalinkSnapshot,
  EthernetConnectOptions,
  SerialConnectOptions,
} from '@shared/types/datalink';

export interface GcsBridgeApi {
  datalink: {
    onSnapshot: (handler: (snapshots: DatalinkSnapshot[]) => void) => () => void;
    connectEthernet: (opts: EthernetConnectOptions) => Promise<DatalinkSnapshot[]>;
    disconnectEthernet: () => Promise<DatalinkSnapshot[]>;
    connectH16: (opts: SerialConnectOptions) => Promise<DatalinkSnapshot[]>;
    disconnectH16: () => Promise<DatalinkSnapshot[]>;
    listSerialPorts: () => Promise<{ path: string; manufacturer?: string }[]>;
  };
}

declare global {
  interface Window {
    gcs: GcsBridgeApi;
  }
}

export {};
