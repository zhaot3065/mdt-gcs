import { useMemo } from 'react';
import { Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useMissionStore } from '@/features/mission/store/use-mission-store';

function waypointDivIcon(seq: number): L.DivIcon {
  const label = seq + 1;
  return L.divIcon({
    className: 'mission-wp-leaflet-icon',
    html: `<div class="mission-wp-badge" aria-label="Waypoint ${label}">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function MissionMapClickHandler() {
  const isEditMode = useMissionStore((s) => s.isEditMode);
  const addWaypoint = useMissionStore((s) => s.addWaypoint);

  useMapEvents({
    click(e) {
      if (!isEditMode) return;
      addWaypoint(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

function MissionWaypointMarkers() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const isEditMode = useMissionStore((s) => s.isEditMode);
  const updateWaypoint = useMissionStore((s) => s.updateWaypoint);

  if (waypoints.length === 0) return null;

  return (
    <>
      {waypoints.map((wp) => (
        <Marker
          key={wp.seq}
          position={[wp.lat, wp.lon]}
          icon={waypointDivIcon(wp.seq)}
          draggable={isEditMode}
          zIndexOffset={500 + wp.seq}
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              updateWaypoint(wp.seq, { lat, lon: lng });
            },
          }}
        />
      ))}
    </>
  );
}

function MissionRoutePolyline() {
  const waypoints = useMissionStore((s) => s.waypoints);

  const positions = useMemo(
    () => waypoints.map((wp) => [wp.lat, wp.lon] as [number, number]),
    [waypoints],
  );

  if (positions.length < 2) return null;

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#3d9eff',
        weight: 3,
        opacity: 0.85,
        dashArray: '6 8',
      }}
    />
  );
}

export function MissionMapLayers() {
  return (
    <>
      <MissionMapClickHandler />
      <MissionRoutePolyline />
      <MissionWaypointMarkers />
    </>
  );
}
