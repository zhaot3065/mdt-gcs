import { create } from 'zustand';
import type { DatalinkSnapshot, EthernetConnectOptions } from '@shared/types/datalink';
import { DEFAULT_MAVLINK_PORT } from '@shared/types/datalink';

interface EthernetFormState {
  mode: EthernetConnectOptions['mode'];
  host: string;
  port: number;
}

interface DatalinkStore {
  snapshots: DatalinkSnapshot[];
  ethernetForm: EthernetFormState;
  busy: boolean;
  error: string | null;

  setSnapshots: (snapshots: DatalinkSnapshot[]) => void;
  setEthernetForm: (partial: Partial<EthernetFormState>) => void;
  connectEthernet: () => Promise<void>;
  disconnectEthernet: () => Promise<void>;
  subscribeIpc: () => () => void;
}

const defaultSnapshots: DatalinkSnapshot[] = [
  {
    id: 'ethernet',
    label: 'SprintLink (Ethernet)',
    state: 'disconnected',
    quality: 'offline',
    metrics: {
      packetsReceived: 0,
      packetsLost: 0,
      lossRatePercent: 0,
      latencyMs: 0,
      lastPacketAgeMs: 0,
      bytesReceived: 0,
      updatedAt: 0,
    },
  },
  {
    id: 'h16_rf',
    label: 'H16 RF',
    state: 'disconnected',
    quality: 'offline',
    metrics: {
      packetsReceived: 0,
      packetsLost: 0,
      lossRatePercent: 0,
      latencyMs: 0,
      lastPacketAgeMs: 0,
      bytesReceived: 0,
      updatedAt: 0,
    },
  },
];

export const useDatalinkStore = create<DatalinkStore>((set, get) => ({
  snapshots: defaultSnapshots,
  ethernetForm: {
    mode: 'udp-client',
    host: '127.0.0.1',
    port: DEFAULT_MAVLINK_PORT,
  },
  busy: false,
  error: null,

  setSnapshots: (snapshots) => set({ snapshots }),

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
      const snapshots = await window.gcs.datalink.connectEthernet({
        mode: ethernetForm.mode,
        host: ethernetForm.host,
        port: ethernetForm.port,
      });
      set({ snapshots });
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
      const snapshots = await window.gcs.datalink.disconnectEthernet();
      set({ snapshots });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  subscribeIpc: () => {
    if (!window.gcs) return () => undefined;
    return window.gcs.datalink.onSnapshot((snapshots) => {
      set({ snapshots });
    });
  },
}));
