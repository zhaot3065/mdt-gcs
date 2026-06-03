import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type DatalinkSnapshot,
  type EthernetConnectOptions,
  type SerialConnectOptions,
} from '../shared/types/datalink';

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

const api: GcsBridgeApi = {
  datalink: {
    onSnapshot: (handler) => {
      const listener = (_: unknown, snapshots: DatalinkSnapshot[]) => handler(snapshots);
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
