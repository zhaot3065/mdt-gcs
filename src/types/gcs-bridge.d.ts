import type {
  DatalinkIpcPayload,
  EthernetConnectOptions,
  GcsCommandRequest,
  GcsCommandResult,
  SerialConnectOptions,
  SerialPortInfo,
} from '@shared/types/datalink';
import type { VehicleState } from '@shared/types/vehicle';

export interface GcsBridgeApi {
  datalink: {
    onPayload: (handler: (payload: DatalinkIpcPayload) => void) => () => void;
    connectEthernet: (opts: EthernetConnectOptions) => Promise<DatalinkIpcPayload>;
    disconnectEthernet: () => Promise<DatalinkIpcPayload>;
    connectH16: (opts: SerialConnectOptions) => Promise<DatalinkIpcPayload>;
    disconnectH16: () => Promise<DatalinkIpcPayload>;
    getSerialPorts: () => Promise<SerialPortInfo[]>;
    listSerialPorts: () => Promise<SerialPortInfo[]>;
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
