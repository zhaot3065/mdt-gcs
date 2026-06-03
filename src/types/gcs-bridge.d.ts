import type {
  DatalinkIpcPayload,
  EthernetConnectOptions,
  GcsCommandRequest,
  GcsCommandResult,
  SerialConnectOptions,
} from '@shared/types/datalink';
import type { VehicleState } from '@shared/types/vehicle';

export interface GcsBridgeApi {
  datalink: {
    onPayload: (handler: (payload: DatalinkIpcPayload) => void) => () => void;
    connectEthernet: (opts: EthernetConnectOptions) => Promise<DatalinkIpcPayload>;
    disconnectEthernet: () => Promise<DatalinkIpcPayload>;
    connectH16: (opts: SerialConnectOptions) => Promise<DatalinkIpcPayload>;
    disconnectH16: () => Promise<DatalinkIpcPayload>;
    listSerialPorts: () => Promise<{ path: string; manufacturer?: string }[]>;
  };
  vehicle: {
    onState: (handler: (state: VehicleState) => void) => () => void;
    sendCommand: (request: GcsCommandRequest) => Promise<GcsCommandResult>;
  };
}

declare global {
  interface Window {
    gcs: GcsBridgeApi;
  }
}

export {};
