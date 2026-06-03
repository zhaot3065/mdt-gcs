import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type DatalinkIpcPayload,
  type EthernetConnectOptions,
  type GcsCommandRequest,
  type GcsCommandResult,
  type SerialConnectOptions,
  type SerialPortInfo,
} from '../shared/types/datalink';
import { VEHICLE_IPC_CHANNELS, type VehicleState } from '../shared/types/vehicle';

export interface GcsBridgeApi {
  datalink: {
    onPayload: (handler: (payload: DatalinkIpcPayload) => void) => () => void;
    connectEthernet: (opts: EthernetConnectOptions) => Promise<DatalinkIpcPayload>;
    disconnectEthernet: () => Promise<DatalinkIpcPayload>;
    connectH16: (opts: SerialConnectOptions) => Promise<DatalinkIpcPayload>;
    disconnectH16: () => Promise<DatalinkIpcPayload>;
    /** List available serial ports (H16 USB) */
    getSerialPorts: () => Promise<SerialPortInfo[]>;
    /** @deprecated use getSerialPorts */
    listSerialPorts: () => Promise<SerialPortInfo[]>;
  };
  vehicle: {
    onState: (handler: (state: VehicleState) => void) => () => void;
    sendCommand: (request: GcsCommandRequest) => Promise<GcsCommandResult>;
  };
}

const api: GcsBridgeApi = {
  datalink: {
    onPayload: (handler) => {
      const listener = (_: unknown, payload: DatalinkIpcPayload) => handler(payload);
      ipcRenderer.on(IPC_CHANNELS.DATALINK_SNAPSHOT, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.DATALINK_SNAPSHOT, listener);
    },
    connectEthernet: (opts) => ipcRenderer.invoke(IPC_CHANNELS.ETHERNET_CONNECT, opts),
    disconnectEthernet: () => ipcRenderer.invoke(IPC_CHANNELS.ETHERNET_DISCONNECT),
    connectH16: (opts) => ipcRenderer.invoke(IPC_CHANNELS.H16_CONNECT, opts),
    disconnectH16: () => ipcRenderer.invoke(IPC_CHANNELS.H16_DISCONNECT),
    getSerialPorts: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_SERIAL_PORTS),
    listSerialPorts: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_SERIAL_PORTS),
  },
  vehicle: {
    onState: (handler) => {
      const listener = (_: unknown, state: VehicleState) => handler(state);
      ipcRenderer.on(VEHICLE_IPC_CHANNELS.VEHICLE_STATE, listener);
      return () => ipcRenderer.removeListener(VEHICLE_IPC_CHANNELS.VEHICLE_STATE, listener);
    },
    sendCommand: (request) => ipcRenderer.invoke(IPC_CHANNELS.SEND_COMMAND, request),
  },
};

contextBridge.exposeInMainWorld('gcs', api);
