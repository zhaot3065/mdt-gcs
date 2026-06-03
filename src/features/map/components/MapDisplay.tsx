import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  OFFLINE_TILE_URL,
  ONLINE_TILE_ATTRIBUTION,
  ONLINE_TILE_URL,
} from '@shared/types/map';
import { useMapStore } from '../store/use-map-store';
import { useVehicleStore } from '@/features/vehicle/store/use-vehicle-store';
import { VehicleIcon } from './VehicleIcon';
import { MapLayerToggle } from './MapLayerToggle';
import { MapHudOverlay } from './MapHudOverlay';
import { MissionMapLayers } from './MissionMapLayers';
import { useMissionStore } from '@/features/mission/store/use-mission-store';
import 'leaflet/dist/leaflet.css';
import './MapDisplay.css';

function MapEditModeCursor() {
  const isEditMode = useMissionStore((s) => s.isEditMode);
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    el.style.cursor = isEditMode ? 'crosshair' : '';
    return () => {
      el.style.cursor = '';
    };
  }, [isEditMode, map]);

  return null;
}

function MapFollowVehicle() {
  const connected = useVehicleStore((s) => s.vehicle.connected);
  const lat = useVehicleStore((s) => s.vehicle.position.lat);
  const lon = useVehicleStore((s) => s.vehicle.position.lon);
  const map = useMap();

  useEffect(() => {
    if (!connected || lat == null || lon == null) return;
    map.panTo([lat, lon], { animate: true, duration: 0.15 });
  }, [connected, lat, lon, map]);

  return null;
}

function VehicleMarkerLayer() {
  const lat = useVehicleStore((s) => s.vehicle.position.lat);
  const lon = useVehicleStore((s) => s.vehicle.position.lon);
  const heading = useVehicleStore((s) => s.vehicle.position.headingDeg);
  const vehicleType = useVehicleStore((s) => s.vehicle.heartbeat.vehicleType);
  const isArmed = useVehicleStore((s) => s.vehicle.heartbeat.isArmed);
  const markerRef = useRef<L.Marker>(null);

  const headingDeg = heading ?? 0;

  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'vehicle-leaflet-icon',
        html: renderToStaticMarkup(
          <VehicleIcon
            vehicleType={vehicleType}
            headingDeg={headingDeg}
            isArmed={isArmed}
          />,
        ),
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
    [vehicleType, headingDeg, isArmed],
  );

  useEffect(() => {
    if (lat == null || lon == null) return;
    markerRef.current?.setLatLng([lat, lon]);
    markerRef.current?.setIcon(icon);
  }, [lat, lon, icon]);

  if (lat == null || lon == null) return null;

  return (
    <Marker
      ref={markerRef}
      position={[lat, lon]}
      icon={icon}
      zIndexOffset={1000}
    />
  );
}

export function MapDisplay() {
  const tileMode = useMapStore((s) => s.tileMode);
  const connected = useVehicleStore((s) => s.vehicle.connected);
  const lat = useVehicleStore((s) => s.vehicle.position.lat);
  const lon = useVehicleStore((s) => s.vehicle.position.lon);
  const isEditMode = useMissionStore((s) => s.isEditMode);

  const center: [number, number] =
    lat != null && lon != null ? [lat, lon] : DEFAULT_MAP_CENTER;

  const tileUrl = tileMode === 'online' ? ONLINE_TILE_URL : OFFLINE_TILE_URL;
  const attribution = tileMode === 'online' ? ONLINE_TILE_ATTRIBUTION : 'MDT GCS offline tiles';

  return (
    <section className="map-display relative min-h-[420px] flex-1" aria-label="Tactical map">
      <MapContainer
        center={center}
        zoom={DEFAULT_MAP_ZOOM}
        className="map-leaflet h-full min-h-[420px] w-full rounded-lg"
        zoomControl
        attributionControl
      >
        <TileLayer
          key={tileMode}
          url={tileUrl}
          attribution={attribution}
          subdomains={tileMode === 'online' ? 'abc' : undefined}
          maxZoom={19}
          errorTileUrl=""
        />
        <MapFollowVehicle />
        <MapEditModeCursor />
        <VehicleMarkerLayer />
        <MissionMapLayers />
      </MapContainer>

      <MapLayerToggle />
      <MapHudOverlay />

      {!connected && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-md bg-slate-900/90 px-2 py-1 text-xs text-slate-400 ring-1 ring-slate-600">
          Waiting for vehicle telemetry…
        </div>
      )}

      {isEditMode && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-[1000] rounded-md border border-amber-600/60 bg-amber-950/90 px-2 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/40">
          Mission edit — click map to add waypoint · drag markers to move
        </div>
      )}
    </section>
  );
}
