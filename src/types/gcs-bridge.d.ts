import type {
  DatalinkIpcPayload,
  EthernetConnectOptions,
  SerialConnectOptions,
} from '@shared/types/datalink';

export interface GcsBridgeApi {
  datalink: {
    onPayload: (handler: (payload: DatalinkIpcPayload) => void) => () => void;
    connectEthernet: (opts: EthernetConnectOptions) => Promise<DatalinkIpcPayload>;
    disconnectEthernet: () => Promise<DatalinkIpcPayload>;
    connectH16: (opts: SerialConnectOptions) => Promise<DatalinkIpcPayload>;
    disconnectH16: () => Promise<DatalinkIpcPayload>;
    listSerialPorts: () => Promise<{ path: string; manufacturer?: string }[]>;
  };
}

declare global {
  interface Window {
    gcs: GcsBridgeApi;
  }
}

export {};
