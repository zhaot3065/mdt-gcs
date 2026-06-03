import { useDatalinkStore } from '@/stores/datalink-store';
import type { DatalinkSnapshot } from '@shared/types/datalink';
import { SignalLamp } from './SignalLamp';
import './DatalinkStatusBar.css';

function formatMetrics(link: DatalinkSnapshot): string {
  const m = link.metrics;
  if (link.state !== 'connected') return '—';
  return `loss ${m.lossRatePercent.toFixed(1)}% · ${m.latencyMs}ms · ${m.packetsReceived} pkt`;
}

export function DatalinkStatusBar() {
  const snapshots = useDatalinkStore((s) => s.snapshots);

  return (
    <header className="datalink-status-bar" role="banner">
      <div className="brand">MDT GCS</div>
      <div className="links">
        {snapshots.map((link) => (
          <div key={link.id} className="link-chip" data-state={link.state}>
            <SignalLamp
              quality={link.quality}
              title={`${link.label}: ${link.quality} (${link.state})`}
            />
            <div className="link-text">
              <span className="link-name">{link.label}</span>
              <span className="link-meta">
                {link.endpoint ?? 'not connected'} · {formatMetrics(link)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
