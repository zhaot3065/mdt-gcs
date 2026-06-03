import { useDatalinkFeatureStore } from '@/features/datalink/store/use-datalink-store';
import type { DatalinkSnapshot } from '@shared/types/datalink';
import { SignalLamp } from './SignalLamp';
import './DatalinkStatusBar.css';

function formatMetrics(link: DatalinkSnapshot): string {
  const m = link.metrics;
  if (link.state !== 'connected') return '—';
  return `loss ${m.lossRatePercent.toFixed(1)}% · ${m.latencyMs}ms · ${m.packetsReceived} pkt`;
}

export function DatalinkStatusBar() {
  const links = useDatalinkFeatureStore((s) => s.links);
  const activeLinkId = useDatalinkFeatureStore((s) => s.router.activeLinkId);

  return (
    <header className="datalink-status-bar" role="banner">
      <div className="brand">MDT GCS</div>
      <div className="links">
        {links.map((link) => (
          <div
            key={link.id}
            className="link-chip"
            data-state={link.state}
            data-active-route={link.health.isActiveRoute}
          >
            <SignalLamp
              quality={link.quality}
              title={`${link.label}: ${link.quality} (${link.state})`}
            />
            <div className="link-text">
              <span className="link-name">
                {link.label}
                {link.health.isActiveRoute && (
                  <span className="route-badge">ROUTE</span>
                )}
              </span>
              <span className="link-meta">
                {link.endpoint ?? 'not connected'} · {formatMetrics(link)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {activeLinkId && (
        <div className="active-route-pill" title="MavlinkRouter active egress">
          Route: {activeLinkId === 'ethernet' ? 'Ethernet' : 'H16 RF'}
        </div>
      )}
    </header>
  );
}
