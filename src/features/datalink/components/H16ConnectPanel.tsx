import { useEffect } from 'react';
import { useDatalinkFeatureStore } from '../store/use-datalink-store';
import { DEFAULT_H16_BAUD_RATE, H16_BAUD_RATE_OPTIONS } from '@shared/types/datalink';
import './DatalinkConnectPanel.css';

function formatPortOption(p: { path: string; manufacturer?: string }): string {
  const mfg = p.manufacturer?.trim();
  return mfg ? `${p.path} — ${mfg}` : p.path;
}

export function H16ConnectPanel() {
  const form = useDatalinkFeatureStore((s) => s.h16Form);
  const setForm = useDatalinkFeatureStore((s) => s.setH16Form);
  const serialPorts = useDatalinkFeatureStore((s) => s.serialPorts);
  const portsLoading = useDatalinkFeatureStore((s) => s.portsLoading);
  const refreshPorts = useDatalinkFeatureStore((s) => s.refreshSerialPorts);
  const connect = useDatalinkFeatureStore((s) => s.connectH16);
  const disconnect = useDatalinkFeatureStore((s) => s.disconnectH16);
  const h16Busy = useDatalinkFeatureStore((s) => s.h16Busy);
  const h16Error = useDatalinkFeatureStore((s) => s.h16Error);
  const h16 = useDatalinkFeatureStore((s) => s.links.find((x) => x.id === 'h16_rf'));

  const isConnected = h16?.state === 'connected';
  const controlsDisabled = h16Busy || portsLoading;

  useEffect(() => {
    void refreshPorts();
  }, [refreshPorts]);

  return (
    <section className="datalink-connect-panel" aria-label="H16 serial connection">
      <h2>H16 · RF (Serial)</h2>
      <span
        className={`status-pill ${isConnected ? 'connected' : 'disconnected'}`}
      >
        {isConnected ? `Connected · ${h16?.endpoint ?? ''}` : 'Disconnected'}
      </span>
      <div className="row">
        <label className="grow">
          Serial port
          <div className="port-label-row">
            <select
              value={form.path}
              disabled={controlsDisabled || isConnected || serialPorts.length === 0}
              onChange={(e) => setForm({ path: e.target.value })}
            >
              {serialPorts.length === 0 ? (
                <option value="">No ports found</option>
              ) : (
                serialPorts.map((p) => (
                  <option key={p.path} value={p.path}>
                    {formatPortOption(p)}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              className="icon-btn"
              title="Refresh port list"
              disabled={controlsDisabled || isConnected}
              onClick={() => void refreshPorts()}
              aria-label="Refresh serial ports"
            >
              🔄
            </button>
          </div>
        </label>
        <label>
          Baud rate
          <select
            value={form.baudRate}
            disabled={controlsDisabled || isConnected}
            onChange={(e) => setForm({ baudRate: Number(e.target.value) })}
          >
            {H16_BAUD_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate}
                {rate === DEFAULT_H16_BAUD_RATE ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="actions">
        {!isConnected ? (
          <button
            type="button"
            disabled={controlsDisabled || !form.path}
            onClick={() => void connect()}
          >
            Connect
          </button>
        ) : (
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => void disconnect()}
          >
            Disconnect
          </button>
        )}
        <button
          type="button"
          className="ghost"
          disabled={controlsDisabled || isConnected}
          onClick={() =>
            setForm({ path: form.path, baudRate: DEFAULT_H16_BAUD_RATE })
          }
        >
          Reset baud default
        </button>
      </div>
      {h16Error && <p className="error">{h16Error}</p>}
      <p className="hint">
        Default baud {DEFAULT_H16_BAUD_RATE} (MAVLink serial). USB/serial to H16
        controller — feeds h16_rf datalink and router.
      </p>
    </section>
  );
}
