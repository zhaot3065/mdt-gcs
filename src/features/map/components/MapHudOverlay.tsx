import { useVehicleStore } from '@/features/vehicle/store/use-vehicle-store';
import './MapHudOverlay.css';

function fmtNum(value: number | null, digits: number, suffix = ''): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}${suffix}`;
}

export function MapHudOverlay() {
  const connected = useVehicleStore((s) => s.vehicle.connected);
  const attitude = useVehicleStore((s) => s.vehicle.attitude);
  const position = useVehicleStore((s) => s.vehicle.position);
  const vfr = useVehicleStore((s) => s.vehicle.vfrHud);
  const heartbeat = useVehicleStore((s) => s.vehicle.heartbeat);

  const roll = attitude.rollDeg ?? 0;
  const pitch = attitude.pitchDeg ?? 0;
  const pitchPx = Math.max(-40, Math.min(40, pitch * 2.2));

  const speed =
    vfr.airspeedMs != null && vfr.airspeedMs > 0
      ? vfr.airspeedMs
      : vfr.groundspeedMs;
  const heading = position.headingDeg ?? attitude.yawDeg;

  const hasAttitude = attitude.lastUpdatedAt > 0;

  return (
    <aside
      className="map-hud-overlay"
      aria-label="Vehicle HUD"
      data-connected={connected}
      data-has-attitude={hasAttitude}
    >
      <div
        className="hud-horizon"
        style={{ transform: `rotate(${-roll}deg)` }}
        aria-hidden
      >
        <div className="hud-pitch-ladder" style={{ transform: `translateY(${pitchPx}px)` }}>
          <div className="hud-sky" />
          <div className="hud-ground" />
          <div className="hud-roll-index" />
        </div>
      </div>

      <div className="hud-readouts">
        <div className="hud-readout">
          <span className="hud-label">SPD</span>
          <span className="hud-value mono">{fmtNum(speed, 1, ' m/s')}</span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">ALT</span>
          <span className="hud-value mono">{fmtNum(position.relativeAltM, 1, ' m')}</span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">HDG</span>
          <span className="hud-value mono">{fmtNum(heading, 0, '°')}</span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">VS</span>
          <span className="hud-value mono">{fmtNum(vfr.climbMs, 1, ' m/s')}</span>
        </div>
        <div className="hud-mode" title="Flight mode">
          {heartbeat.flightMode}
          {heartbeat.isArmed && <span className="hud-armed">ARM</span>}
        </div>
      </div>
    </aside>
  );
}
