import { useMapStore } from '../store/use-map-store';
import type { MapTileMode } from '@shared/types/map';

const MODES: { id: MapTileMode; label: string; hint: string }[] = [
  { id: 'online', label: 'Online', hint: 'OSM via Starlink / internet' },
  { id: 'offline', label: 'Offline', hint: 'Local userData/maps tiles' },
];

export function MapLayerToggle() {
  const tileMode = useMapStore((s) => s.tileMode);
  const setTileMode = useMapStore((s) => s.setTileMode);

  return (
    <div
      className="map-layer-toggle flex flex-col gap-1 rounded-lg border border-slate-600 bg-slate-900/95 p-2 shadow-lg backdrop-blur-sm"
      role="group"
      aria-label="Map tile source"
    >
      <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Map source
      </span>
      <div className="flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.hint}
            onClick={() => setTileMode(m.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tileMode === m.id
                ? m.id === 'online'
                  ? 'bg-sky-600 text-white ring-1 ring-sky-400'
                  : 'bg-amber-600 text-white ring-1 ring-amber-400'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="max-w-[180px] px-1 text-[10px] leading-tight text-slate-500">
        {tileMode === 'online'
          ? 'OpenStreetMap tiles'
          : 'gcs-tiles:// from app maps folder'}
      </p>
    </div>
  );
}
