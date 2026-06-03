import { useMemo } from 'react';
import { Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  MAV_MISSION_TYPE,
  type MissionDataType,
} from '@shared/types/mission';
import {
  selectActiveWaypoints,
  useMissionStore,
} from '@/features/mission/store/use-mission-store';

function missionMarkerClass(missionType: MissionDataType): string {
  switch (missionType) {
    case MAV_MISSION_TYPE.FENCE:
      return 'mission-wp-badge mission-wp-badge--fence';
    case MAV_MISSION_TYPE.RALLY:
      return 'mission-wp-badge mission-wp-badge--rally';
    default:
      return 'mission-wp-badge mission-wp-badge--mission';
  }
}

function waypointDivIcon(seq: number, missionType: MissionDataType): L.DivIcon {
  const label = seq + 1;
  const badgeClass = missionMarkerClass(missionType);
  return L.divIcon({
    className: 'mission-wp-leaflet-icon',
    html: `<div class="${badgeClass}" aria-label="Point ${label}">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function routePathOptions(missionType: MissionDataType): L.PolylineOptions {
  switch (missionType) {
    case MAV_MISSION_TYPE.FENCE:
      return {
        color: '#f87171',
        weight: 3,
        opacity: 0.9,
        dashArray: undefined,
      };
    case MAV_MISSION_TYPE.RALLY:
      return {
        color: '#4ade80',
        weight: 2,
        opacity: 0.65,
        dashArray: '4 10',
      };
    default:
      return {
        color: '#3d9eff',
        weight: 3,
        opacity: 0.85,
        dashArray: '6 8',
      };
  }
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
  const waypoints = useMissionStore(selectActiveWaypoints);
  const missionType = useMissionStore((s) => s.currentMissionType);
  const isEditMode = useMissionStore((s) => s.isEditMode);
  const updateWaypoint = useMissionStore((s) => s.updateWaypoint);

  if (waypoints.length === 0) return null;

  return (
    <>
      {waypoints.map((wp) => (
        <Marker
          key={`${missionType}-${wp.seq}`}
          position={[wp.lat, wp.lon]}
          icon={waypointDivIcon(wp.seq, missionType)}
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
  const waypoints = useMissionStore(selectActiveWaypoints);
  const missionType = useMissionStore((s) => s.currentMissionType);

  const positions = useMemo(() => {
    const pts = waypoints.map((wp) => [wp.lat, wp.lon] as [number, number]);
    if (missionType === MAV_MISSION_TYPE.FENCE && pts.length >= 3) {
      return [...pts, pts[0]];
    }
    return pts;
  }, [waypoints, missionType]);

  if (positions.length < 2) return null;

  return (
    <Polyline
      positions={positions}
      pathOptions={routePathOptions(missionType)}
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
