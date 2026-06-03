import { useDatalinkFeatureStore } from '../store/use-datalink-store';
import type { DatalinkId, RouterSelectionReason } from '@shared/types/datalink';
import { formatRttSlot } from '../utils/rtt-format';
import './RouterStatusPanel.css';

const LINK_LABEL: Record<DatalinkId, string> = {
  ethernet: 'SprintLink (Ethernet)',
  h16_rf: 'H16 RF',
};

const REASON_LABEL: Record<RouterSelectionReason, string> = {
  none: 'No active link',
  ethernet_preferred: 'Ethernet preferred (best score)',
  h16_fallback: 'H16 RF fallback',
  stale_failover: 'Failover — Ethernet stale',
  tie_break_priority: 'Tie-break — Ethernet priority',
};

export function RouterStatusPanel() {
  const router = useDatalinkFeatureStore((s) => s.router);
  const links = useDatalinkFeatureStore((s) => s.links);

  const activeLabel = router.activeLinkId
    ? LINK_LABEL[router.activeLinkId]
    : '—';

  return (
    <section className="router-panel" aria-label="MAVLink router status">
      <h2>MAVLink Router</h2>
      <div className="router-grid">
        <div className="router-stat">
          <span className="label">Active route</span>
          <span className="value accent">{activeLabel}</span>
        </div>
        <div className="router-stat">
          <span className="label">Selection</span>
          <span className="value">{REASON_LABEL[router.selectionReason]}</span>
        </div>
        <div className="router-stat">
          <span className="label">Dedup rate</span>
          <span className="value mono">{router.metrics.dedupRatePercent.toFixed(1)}%</span>
        </div>
        <div className="router-stat">
          <span className="label">Forwarded</span>
          <span className="value mono">{router.metrics.framesForwarded}</span>
        </div>
        <div className="router-stat">
          <span className="label">RTT (active)</span>
          <span className="value mono" data-rtt-source={router.rtt.source}>
            {router.activeLinkId
              ? formatRttSlot(router.rtt.perLink[router.activeLinkId])
              : formatRttSlot(
                  router.rtt.activeRttMs != null
                    ? {
                        rttMs: router.rtt.activeRttMs,
                        source: router.rtt.source,
                        updatedAt: Date.now(),
                      }
                    : undefined,
                )}
          </span>
        </div>
      </div>
      <table className="health-table">
        <thead>
          <tr>
            <th>Link</th>
            <th>Live</th>
            <th>Eligible</th>
            <th>Active</th>
            <th>Loss</th>
            <th>RTT</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.id} data-active={link.health.isActiveRoute}>
              <td>{link.label}</td>
              <td>{link.health.isLive ? 'yes' : 'no'}</td>
              <td>{link.health.isEligibleForActive ? 'yes' : 'no'}</td>
              <td>{link.health.isActiveRoute ? '★' : '—'}</td>
              <td className="mono">
                {link.state === 'connected'
                  ? `${link.metrics.lossRatePercent.toFixed(1)}%`
                  : '—'}
              </td>
              <td className="mono">{formatRttSlot(router.rtt.perLink[link.id])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Per-link MAVLink TIMESYNC (#111) RTT when connected; falls back to HEARTBEAT interval estimate.
      </p>
    </section>
  );
}
