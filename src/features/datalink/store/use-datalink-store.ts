import { create } from 'zustand';
import type {
  DatalinkIpcPayload,
  DatalinkSnapshot,
  EthernetConnectOptions,
  MavlinkRouterSnapshot,
  SerialPortInfo,
} from '@shared/types/datalink';
import { DEFAULT_H16_BAUD_RATE, DEFAULT_MAVLINK_PORT } from '@shared/types/datalink';
import { defaultDatalinkPayload } from './defaults';

interface EthernetFormState {
  mode: EthernetConnectOptions['mode'];
  host: string;
  port: number;
}

interface H16FormState {
  path: string;
  baudRate: number;
}

interface DatalinkFeatureStore {
  payload: DatalinkIpcPayload;
  links: DatalinkSnapshot[];
  router: MavlinkRouterSnapshot;
  ethernetForm: EthernetFormState;
  h16Form: H16FormState;
  serialPorts: SerialPortInfo[];
  portsLoading: boolean;
  busy: boolean;
  h16Busy: boolean;
  error: string | null;
  h16Error: string | null;

  applyPayload: (payload: DatalinkIpcPayload) => void;
  setEthernetForm: (partial: Partial<EthernetFormState>) => void;
  setH16Form: (partial: Partial<H16FormState>) => void;
  refreshSerialPorts: () => Promise<void>;
  connectEthernet: () => Promise<void>;
  disconnectEthernet: () => Promise<void>;
  connectH16: () => Promise<void>;
  disconnectH16: () => Promise<void>;
  subscribeIpc: () => () => void;
}

export const useDatalinkFeatureStore = create<DatalinkFeatureStore>((set, get) => ({
  payload: defaultDatalinkPayload,
  links: defaultDatalinkPayload.links,
  router: defaultDatalinkPayload.router,
  ethernetForm: {
    mode: 'udp-client',
    host: '127.0.0.1',
    port: DEFAULT_MAVLINK_PORT,
  },
  h16Form: {
    path: '',
    baudRate: DEFAULT_H16_BAUD_RATE,
  },
  serialPorts: [],
  portsLoading: false,
  busy: false,
  h16Busy: false,
  error: null,
  h16Error: null,

  applyPayload: (payload) =>
    set({
      payload,
      links: payload.links,
      router: payload.router,
    }),

  setEthernetForm: (partial) =>
    set((s) => ({ ethernetForm: { ...s.ethernetForm, ...partial } })),

  setH16Form: (partial) =>
    set((s) => ({ h16Form: { ...s.h16Form, ...partial } })),

  refreshSerialPorts: async () => {
    if (!window.gcs?.datalink?.getSerialPorts) {
      set({ h16Error: 'Electron bridge unavailable (run via electron:dev)' });
      return;
    }
    set({ portsLoading: true, h16Error: null });
    try {
      const ports = await window.gcs.datalink.getSerialPorts();
      const currentPath = get().h16Form.path;
      const pathStillValid = ports.some((p) => p.path === currentPath);
      const nextPath = pathStillValid
        ? currentPath
        : ports[0]?.path ?? '';
      set({
        serialPorts: ports,
        h16Form: { ...get().h16Form, path: nextPath },
      });
    } catch (e) {
      set({ h16Error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ portsLoading: false });
    }
  },

  connectEthernet: async () => {
    const { ethernetForm } = get();
    if (!window.gcs) {
      set({ error: 'Electron bridge unavailable (run via electron:dev)' });
      return;
    }
    set({ busy: true, error: null });
    try {
      const payload = await window.gcs.datalink.connectEthernet({
        mode: ethernetForm.mode,
        host: ethernetForm.host,
        port: ethernetForm.port,
      });
      get().applyPayload(payload);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  disconnectEthernet: async () => {
    if (!window.gcs) return;
    set({ busy: true, error: null });
    try {
      const payload = await window.gcs.datalink.disconnectEthernet();
      get().applyPayload(payload);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  connectH16: async () => {
    const { h16Form } = get();
    if (!window.gcs?.datalink?.connectH16) {
      set({ h16Error: 'Electron bridge unavailable (run via electron:dev)' });
      return;
    }
    if (!h16Form.path) {
      set({ h16Error: 'Select a serial port first.' });
      return;
    }
    set({ h16Busy: true, h16Error: null });
    try {
      const payload = await window.gcs.datalink.connectH16({
        path: h16Form.path,
        baudRate: h16Form.baudRate,
      });
      get().applyPayload(payload);
    } catch (e) {
      set({ h16Error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ h16Busy: false });
    }
  },

  disconnectH16: async () => {
    if (!window.gcs?.datalink?.disconnectH16) return;
    set({ h16Busy: true, h16Error: null });
    try {
      const payload = await window.gcs.datalink.disconnectH16();
      get().applyPayload(payload);
    } catch (e) {
      set({ h16Error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ h16Busy: false });
    }
  },

  subscribeIpc: () => {
    if (!window.gcs) return () => undefined;
    return window.gcs.datalink.onPayload((payload) => {
      get().applyPayload(payload);
    });
  },
}));
