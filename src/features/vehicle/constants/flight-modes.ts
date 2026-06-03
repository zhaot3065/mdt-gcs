import type { VehicleTypeCategory } from '@shared/types/vehicle';

export interface FlightModeOption {
  customMode: number;
  label: string;
  /** UI grouping */
  group: 'multicopter' | 'vtol_quad' | 'vtol_plane';
}

/** Multicopter / common ArduCopter modes */
export const COPTER_FLIGHT_MODES: FlightModeOption[] = [
  { customMode: 0, label: 'STABILIZE', group: 'multicopter' },
  { customMode: 2, label: 'ALT_HOLD', group: 'multicopter' },
  { customMode: 3, label: 'AUTO', group: 'multicopter' },
  { customMode: 5, label: 'LOITER', group: 'multicopter' },
  { customMode: 6, label: 'RTL', group: 'multicopter' },
];

/** QuadPlane VTOL (multicopter phase) */
export const VTOL_QUAD_FLIGHT_MODES: FlightModeOption[] = [
  { customMode: 17, label: 'QSTABILIZE', group: 'vtol_quad' },
  { customMode: 18, label: 'QHOVER', group: 'vtol_quad' },
  { customMode: 19, label: 'QLOITER', group: 'vtol_quad' },
];

/** QuadPlane fixed-wing phase */
export const VTOL_PLANE_FLIGHT_MODES: FlightModeOption[] = [
  { customMode: 5, label: 'FBWA', group: 'vtol_plane' },
  { customMode: 7, label: 'CRUISE', group: 'vtol_plane' },
];

export function flightModesForVehicle(
  vehicleType: VehicleTypeCategory,
): FlightModeOption[] {
  switch (vehicleType) {
    case 'vtol':
      return [...COPTER_FLIGHT_MODES, ...VTOL_QUAD_FLIGHT_MODES, ...VTOL_PLANE_FLIGHT_MODES];
    case 'multicopter':
      return [...COPTER_FLIGHT_MODES];
    default:
      return [...COPTER_FLIGHT_MODES];
  }
}

export function findFlightModeLabel(
  customMode: number,
  vehicleType: VehicleTypeCategory,
): string | undefined {
  return flightModesForVehicle(vehicleType).find((m) => m.customMode === customMode)?.label;
}
