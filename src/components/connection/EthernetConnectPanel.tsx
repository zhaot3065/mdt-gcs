import { useDatalinkStore } from '@/stores/datalink-store';
import { DEFAULT_MAVLINK_PORT } from '@shared/types/datalink';
import './EthernetConnectPanel.css';

export function EthernetConnectPanel() {
  const form = useDatalinkStore((s) => s.ethernetForm);
  const setForm = useDatalinkStore((s) => s.setEthernetForm);
  const connect = useDatalinkStore((s) => s.connectEthernet);
  const disconnect = useDatalinkStore((s) => s.disconnectEthernet);
  const busy = useDatalinkStore((s) => s.busy);
  const error = useDatalinkStore((s) => s.error);
  const ethernet = useDatalinkStore((s) =>
    s.snapshots.find((x) => x.id === 'ethernet'),
  );
  const isConnected = ethernet?.state === 'connected';

  return (
    <section className="ethernet-panel" aria-label="Ethernet connection">
      <h2>SprintLink · Ethernet</h2>
      <div className="row">
        <label>
          Mode
          <select
            value={form.mode}
            disabled={busy || isConnected}
            onChange={(e) =>
              setForm({ mode: e.target.value as typeof form.mode })
            }
          >
            <option value="udp-client">UDP Client</option>
            <option value="udp-server">UDP Server</option>
            <option value="tcp-client">TCP Client</option>
          </select>
        </label>
        <label>
          Host / Bind IP
          <input
            type="text"
            value={form.host}
            disabled={busy || isConnected || form.mode === 'udp-server'}
            onChange={(e) => setForm({ host: e.target.value })}
            placeholder="192.168.1.10"
          />
        </label>
        <label>
          Port
          <input
            type="number"
            min={1}
            max={65535}
            value={form.port}
            disabled={busy || isConnected}
            onChange={(e) => setForm({ port: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="actions">
        {!isConnected ? (
          <button type="button" disabled={busy} onClick={() => void connect()}>
            Connect
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void disconnect()}>
            Disconnect
          </button>
        )}
        <button
          type="button"
          className="ghost"
          disabled={busy || isConnected}
          onClick={() =>
            setForm({ host: '127.0.0.1', port: DEFAULT_MAVLINK_PORT, mode: 'udp-client' })
          }
        >
          Reset defaults
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="hint">Default MAVLink port {DEFAULT_MAVLINK_PORT}. High-contrast dark UI for outdoor use.</p>
    </section>
  );
}
