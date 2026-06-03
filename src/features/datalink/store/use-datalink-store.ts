import { create } from 'zustand';
import type {
  DatalinkIpcPayload,
  DatalinkSnapshot,
  EthernetConnectOptions,
  MavlinkRouterSnapshot,
} from '@shared/types/datalink';
import { DEFAULT_MAVLINK_PORT } from '@shared/types/datalink';
import { defaultDatalinkPayload } from './defaults';

interface EthernetFormState {
  mode: EthernetConnectOptions['mode'];
  host: string;
  port: number;
}

interface DatalinkFeatureStore {
  payload: DatalinkIpcPayload;
  links: DatalinkSnapshot[];
  router: MavlinkRouterSnapshot;
  ethernetForm: EthernetFormState;
  busy: boolean;
  error: string | null;

  applyPayload: (payload: DatalinkIpcPayload) => void;
  setEthernetForm: (partial: Partial<EthernetFormState>) => void;
  connectEthernet: () => Promise<void>;
  disconnectEthernet: () => Promise<void>;
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
  busy: false,
  error: null,

  applyPayload: (payload) =>
    set({
      payload,
      links: payload.links,
      router: payload.router,
    }),

  setEthernetForm: (partial) =>
    set((s) => ({ ethernetForm: { ...s.ethernetForm, ...partial } })),

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

  subscribeIpc: () => {
    if (!window.gcs) return () => undefined;
    return window.gcs.datalink.onPayload((payload) => {
      get().applyPayload(payload);
    });
  },
}));
