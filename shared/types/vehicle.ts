/**
 * Vehicle telemetry IPC contract (Main → Renderer).
 * Populated by MavlinkTelemetryParser from deduplicated router frames.
 */

export type VehicleTypeCategory = 'multicopter' | 'vtol' | 'fixed_wing' | 'unknown';

export interface VehicleHeartbeat {
  vehicleType: VehicleTypeCategory;
  /** MAV_TYPE enum raw value */
  mavlinkType: number;
  flightMode: string;
  customMode: number;
  isArmed: boolean;
  autopilot: number;
  lastUpdatedAt: number;
}

export interface VehiclePosition {
  lat: number | null;
  lon: number | null;
  /** Meters above home / relative frame (GLOBAL_POSITION_INT.relative_alt) */
  relativeAltM: number | null;
  /** Degrees 0–360; null if unknown */
  headingDeg: number | null;
  lastUpdatedAt: number;
}

export interface VehicleBattery {
  voltageV: number | null;
  currentA: number | null;
  /** 0–100; null if unknown (MAVLink sends -1). BATTERY_STATUS #147 preferred over SYS_STATUS #1. */
  percent: number | null;
  lastUpdatedAt: number;
}

/** MAVLink GPS_RAW_INT (#24) — satellite reception quality */
export interface VehicleGps {
  /** GPS_FIX_TYPE enum (0=no fix, 3=3D, 6=RTK fixed, …) */
  fixType: number;
  satellitesVisible: number;
  /** Horizontal dilution of precision; null if eph unknown (65535) */
  hdop: number | null;
  lastUpdatedAt: number;
}

export interface VehicleVfrHud {
  airspeedMs: number | null;
  groundspeedMs: number | null;
  /** m/s — positive = climb */
  climbMs: number | null;
  lastUpdatedAt: number;
}

/** MAVLink ATTITUDE (#30) — degrees for UI */
export interface VehicleAttitude {
  rollDeg: number | null;
  pitchDeg: number | null;
  /** Yaw 0–360° (heading) */
  yawDeg: number | null;
  lastUpdatedAt: number;
}

export interface VehicleState {
  /** HEARTBEAT seen within stale window */
  connected: boolean;
  lastHeardAt: number;
  updatedAt: number;
  heartbeat: VehicleHeartbeat;
  position: VehiclePosition;
  battery: VehicleBattery;
  gps: VehicleGps;
  vfrHud: VehicleVfrHud;
  attitude: VehicleAttitude;
}

export const VEHICLE_STALE_MS = 5000;

export const VEHICLE_IPC_CHANNELS = {
  VEHICLE_STATE: 'vehicle:state',
} as const;

/** Default broadcast interval (Main throttle) */
export const VEHICLE_BROADCAST_MS = 150;

export const MAVLINK_MSG_ID = {
  HEARTBEAT: 0,
  SYS_STATUS: 1,
  GPS_RAW_INT: 24,
  ATTITUDE: 30,
  GLOBAL_POSITION_INT: 33,
  VFR_HUD: 74,
  BATTERY_STATUS: 147,
} as const;

export function createInitialVehicleState(now = 0): VehicleState {
  const emptyHeartbeat: VehicleHeartbeat = {
    vehicleType: 'unknown',
    mavlinkType: 0,
    flightMode: '—',
    customMode: 0,
    isArmed: false,
    autopilot: 0,
    lastUpdatedAt: 0,
  };
  return {
    connected: false,
    lastHeardAt: 0,
    updatedAt: now,
    heartbeat: { ...emptyHeartbeat },
    position: {
      lat: null,
      lon: null,
      relativeAltM: null,
      headingDeg: null,
      lastUpdatedAt: 0,
    },
    battery: {
      voltageV: null,
      currentA: null,
      percent: null,
      lastUpdatedAt: 0,
    },
    gps: {
      fixType: 0,
      satellitesVisible: 0,
      hdop: null,
      lastUpdatedAt: 0,
    },
    vfrHud: {
      airspeedMs: null,
      groundspeedMs: null,
      climbMs: null,
      lastUpdatedAt: 0,
    },
    attitude: {
      rollDeg: null,
      pitchDeg: null,
      yawDeg: null,
      lastUpdatedAt: 0,
    },
  };
}
