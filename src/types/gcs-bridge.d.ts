import type {
  DatalinkIpcPayload,
  EthernetConnectOptions,
  GcsCommandRequest,
  GcsCommandResult,
  SerialConnectOptions,
  SerialPortInfo,
} from '@shared/types/datalink';
import type { VehicleState } from '@shared/types/vehicle';
import type { GcsMissionDownloadPayload, GcsMissionDownloadResult, GcsMissionPayload } from '@shared/types/mission';

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
  mission: {
    upload: (payload: GcsMissionPayload) => Promise<GcsCommandResult>;
    download: (payload?: GcsMissionDownloadPayload) => Promise<GcsMissionDownloadResult>;
  };
}

declare global {
  interface Window {
    gcs: GcsBridgeApi;
  }
}

export {};
