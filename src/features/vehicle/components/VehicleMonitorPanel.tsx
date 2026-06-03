import { useVehicleStore } from '../store/use-vehicle-store';
import { VehicleCommandControls } from './VehicleCommandControls';
import { FlightModeSelector } from './FlightModeSelector';
import { formatHdop, gpsFixTypeLabel, hdopQualityClass } from '../utils/gps-label';
function fmtCoord(value: number | null, decimals = 6): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(decimals);
}

function fmtNum(value: number | null, unit: string, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)} ${unit}`;
}

function GaugeBar({
  label,
  value,
  max,
  unit,
  colorClass,
}: {
  label: string;
  value: number | null;
  max: number;
  unit: string;
  colorClass: string;
}) {
  const pct =
    value != null && Number.isFinite(value)
      ? Math.min(100, Math.max(0, (value / max) * 100))
      : 0;
  const display =
    value != null && Number.isFinite(value) ? `${value.toFixed(1)} ${unit}` : '—';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-200">{display}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-600">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function VehicleMonitorPanel() {
  const v = useVehicleStore((s) => s.vehicle);
  const { heartbeat, position, battery, gps, vfrHud } = v;

  const armedClass = heartbeat.isArmed
    ? 'bg-red-500/20 text-red-400 ring-red-500/50'
    : 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/50';

  return (
    <section
      className="m-4 max-w-lg rounded-lg border border-slate-600 bg-slate-900/90 p-4 shadow-lg shadow-black/40"
      aria-label="Vehicle telemetry"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400">
          Vehicle Telemetry
        </h2>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ${
            v.connected
              ? 'bg-sky-500/20 text-sky-300 ring-sky-500/40'
              : 'bg-slate-700 text-slate-400 ring-slate-600'
          }`}
        >
          {v.connected ? 'LINK OK' : 'NO DATA'}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FlightModeSelector />
        </div>
        <div className={`rounded-md p-2 ring-1 ${armedClass}`}>
          <p className="text-xs opacity-80">Armed</p>
          <p className="font-mono text-lg font-semibold">
            {heartbeat.isArmed ? 'ARMED' : 'DISARMED'}
          </p>
        </div>
        <div className="col-span-2 rounded-md bg-slate-800/80 p-2 ring-1 ring-slate-700">
          <p className="text-xs text-slate-500">Vehicle type</p>
          <p className="font-mono text-slate-200">
            {heartbeat.vehicleType}
            <span className="ml-2 text-slate-500">(MAV_TYPE {heartbeat.mavlinkType})</span>
          </p>
        </div>
      </div>

      <div className="mb-4 space-y-1 font-mono text-sm text-slate-200">
        <p>
          <span className="text-slate-500">LAT </span>
          {fmtCoord(position.lat)}
        </p>
        <p>
          <span className="text-slate-500">LON </span>
          {fmtCoord(position.lon)}
        </p>
        <p>
          <span className="text-slate-500">ALT (rel) </span>
          {fmtNum(position.relativeAltM, 'm')}
          <span className="ml-3 text-slate-500">HDG </span>
          {position.headingDeg != null ? `${position.headingDeg.toFixed(0)}°` : '—'}
        </p>
      </div>

      <div className="mb-4 rounded-md border border-slate-700 bg-slate-800/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-400/90">
          GPS Reception
        </p>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Satellites</p>
            <p className="font-mono text-slate-100">
              <span aria-hidden>🛰️ </span>
              {gps.satellitesVisible > 0 ? `${gps.satellitesVisible} sats` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">HDOP</p>
            <p className={`font-mono font-semibold ${hdopQualityClass(gps.hdop)}`}>
              {gps.hdop != null ? `HDOP: ${formatHdop(gps.hdop)}` : 'HDOP: —'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Fix</p>
            <p
              className={`font-mono font-semibold ${
                gps.fixType >= 3 ? 'text-emerald-400' : 'text-orange-400'
              }`}
            >
              {gpsFixTypeLabel(gps.fixType)}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-3">        <GaugeBar
          label="Battery voltage"
          value={battery.voltageV}
          max={25.2}
          unit="V"
          colorClass="bg-gradient-to-r from-amber-500 to-emerald-400"
        />
        <GaugeBar
          label="Battery remaining"
          value={battery.percent}
          max={100}
          unit="%"
          colorClass="bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400"
        />
      </div>

      <VehicleCommandControls />

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700 pt-3 text-center text-xs">
        <div>
          <p className="text-slate-500">Airspeed</p>
          <p className="font-mono text-slate-200">{fmtNum(vfrHud.airspeedMs, 'm/s')}</p>
        </div>
        <div>
          <p className="text-slate-500">Ground</p>
          <p className="font-mono text-slate-200">{fmtNum(vfrHud.groundspeedMs, 'm/s')}</p>
        </div>
        <div>
          <p className="text-slate-500">Climb</p>
          <p className="font-mono text-slate-200">{fmtNum(vfrHud.climbMs, 'm/s')}</p>
        </div>
      </div>
    </section>
  );
}
