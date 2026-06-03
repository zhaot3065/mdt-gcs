import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type DatalinkIpcPayload,
  type EthernetConnectOptions,
  type SerialConnectOptions,
} from '../shared/types/datalink';

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
    listSerialPorts: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_SERIAL_PORTS),
  },
};

contextBridge.exposeInMainWorld('gcs', api);
