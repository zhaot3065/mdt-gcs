import { useDatalinkFeatureStore } from '@/features/datalink/store/use-datalink-store';
import { formatRttMs, perLinkRttSlot } from '@/features/datalink/utils/rtt-format';
import type { DatalinkSnapshot, RttEstimate } from '@shared/types/datalink';
import { SignalLamp } from './SignalLamp';
import './DatalinkStatusBar.css';

function formatMetrics(link: DatalinkSnapshot, rtt: RttEstimate): string {
  const m = link.metrics;
  if (link.state !== 'connected') return '—';

  const slot = perLinkRttSlot(rtt, link.id);
  const latency =
    slot?.rttMs != null
      ? slot.source === 'timesync'
        ? `RTT ${formatRttMs(slot.rttMs)}`
        : `~${formatRttMs(slot.rttMs)} est.`
      : m.latencyMs > 0
        ? `~${m.latencyMs} ms est.`
        : 'RTT —';

  return `loss ${m.lossRatePercent.toFixed(1)}% · ${latency} · ${m.packetsReceived} pkt`;
}



export function DatalinkStatusBar() {

  const links = useDatalinkFeatureStore((s) => s.links);
  const router = useDatalinkFeatureStore((s) => s.router);
  const activeLinkId = router.activeLinkId;



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

                {link.endpoint ?? 'not connected'} · {formatMetrics(link, router.rtt)}

              </span>

            </div>

          </div>

        ))}

      </div>

      {activeLinkId && (

        <div className="active-route-pill" title="MavlinkRouter active egress">
          Route: {activeLinkId === 'ethernet' ? 'Ethernet' : 'H16 RF'}
          {router.rtt.activeRttMs != null && (
            <span className="route-rtt mono">
              {' '}
              · {formatRttMs(router.rtt.activeRttMs)}
              {router.rtt.source === 'timesync' ? '' : ' est.'}
            </span>
          )}
        </div>

      )}

    </header>

  );

}


