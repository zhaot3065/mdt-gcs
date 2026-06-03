import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import type { VehicleState } from '../../shared/types/vehicle';
import {
  MAVLINK_MSG_ID,
  VEHICLE_IPC_CHANNELS,
  VEHICLE_STALE_MS,
  createInitialVehicleState,
} from '../../shared/types/vehicle';
import { MAVLINK_V1_STX, MAVLINK_V2_STX } from './mavlink-frame';
import type { MavlinkRouter, ForwardedMavlinkFrame } from './mavlink-router';

const MAV_MODE_FLAG_SAFETY_ARMED = 128;
const MAV_AUTOPILOT_ARDUPILOTMEGA = 3;
const HEADING_UNKNOWN = 65535;

const ARDUCOPTER_MODE_NAMES: Record<number, string> = {
  0: 'STABILIZE',
  1: 'ACRO',
  2: 'ALT_HOLD',
  3: 'AUTO',
  4: 'GUIDED',
  5: 'LOITER',
  6: 'RTL',
  7: 'CIRCLE',
  9: 'LAND',
  11: 'DRIFT',
  13: 'SPORT',
  14: 'FLIP',
  15: 'AUTOTUNE',
  16: 'POSHOLD',
  17: 'BRAKE',
  18: 'THROW',
  19: 'AVOID_ADSB',
  20: 'GUIDED_NOGPS',
  21: 'SMART_RTL',
  22: 'FLOWHOLD',
  23: 'FOLLOW',
  24: 'ZIGZAG',
  25: 'SYSTEMID',
  26: 'AUTOROTATE',
  27: 'AUTO_RTL',
};

const ARDUPLANE_MODE_NAMES: Record<number, string> = {
  0: 'MANUAL',
  1: 'CIRCLE',
  2: 'STABILIZE',
  3: 'TRAINING',
  4: 'ACRO',
  5: 'FBWA',
  6: 'FBWB',
  7: 'CRUISE',
  8: 'AUTOTUNE',
  10: 'AUTO',
  11: 'RTL',
  12: 'LOITER',
  13: 'TAKEOFF',
  14: 'AVOID_ADSB',
  15: 'GUIDED',
  17: 'QSTABILIZE',
  18: 'QHOVER',
  19: 'QLOITER',
  20: 'QLAND',
  21: 'QRTL',
  22: 'QAUTOTUNE',
  23: 'QACRO',
};

const COPTER_MAV_TYPES = new Set([2, 3, 4, 13, 14, 15, 29]);
const VTOL_MAV_TYPES = new Set([19, 20, 21, 22, 23, 24, 25]);

export class MavlinkTelemetryParser extends EventEmitter {
  private state: VehicleState = createInitialVehicleState();
  private dirty = false;
  private broadcastTimer: NodeJS.Timeout | null = null;
  private boundOnFrame: (evt: ForwardedMavlinkFrame) => void;

  constructor(private router: MavlinkRouter) {
    super();
    this.boundOnFrame = (evt) => this.onFrame(evt);
    this.router.on('frame', this.boundOnFrame);
  }

  dispose(): void {
    this.stopBroadcast();
    this.router.off('frame', this.boundOnFrame);
  }

  getState(): VehicleState {
    return this.snapshot();
  }

  startBroadcast(getWindow: () => BrowserWindow | null, intervalMs = 150): void {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setInterval(() => {
      if (!this.dirty) return;
      const win = getWindow();
      if (!win || win.isDestroyed()) return;
      const payload = this.snapshot();
      win.webContents.send(VEHICLE_IPC_CHANNELS.VEHICLE_STATE, payload);
      this.dirty = false;
    }, intervalMs);
  }

  stopBroadcast(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  private snapshot(): VehicleState {
    const now = Date.now();
    const connected =
      this.state.lastHeardAt > 0 && now - this.state.lastHeardAt < VEHICLE_STALE_MS;
    return {
      ...this.state,
      connected,
      updatedAt: now,
    };
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private onFrame({ frame }: ForwardedMavlinkFrame): void {
    const msgId = frame.header.msgId;
    const payload = extractPayload(frame.raw);
    if (!payload) return;

    switch (msgId) {
      case MAVLINK_MSG_ID.HEARTBEAT:
        this.parseHeartbeat(payload);
        break;
      case MAVLINK_MSG_ID.GLOBAL_POSITION_INT:
        this.parseGlobalPositionInt(payload);
        break;
      case MAVLINK_MSG_ID.SYS_STATUS:
        this.parseSysStatus(payload);
        break;
      case MAVLINK_MSG_ID.VFR_HUD:
        this.parseVfrHud(payload);
        break;
      default:
        return;
    }
    this.markDirty();
  }

  private parseHeartbeat(payload: Buffer): void {
    if (payload.length < 9) return;
    const now = Date.now();
    const customMode = payload.readUInt32LE(0);
    const mavlinkType = payload[4];
    const autopilot = payload[5];
    const baseMode = payload[6];

    this.state.lastHeardAt = now;
    this.state.heartbeat = {
      vehicleType: categorizeVehicleType(mavlinkType),
      mavlinkType,
      flightMode: resolveFlightMode(customMode, mavlinkType, autopilot),
      customMode,
      isArmed: (baseMode & MAV_MODE_FLAG_SAFETY_ARMED) !== 0,
      autopilot,
      lastUpdatedAt: now,
    };
  }

  private parseGlobalPositionInt(payload: Buffer): void {
    if (payload.length < 28) return;
    const now = Date.now();
    const lat = payload.readInt32LE(4) / 1e7;
    const lon = payload.readInt32LE(8) / 1e7;
    const relativeAltM = payload.readInt32LE(16) / 1000;
    const hdgRaw = payload.readUInt16LE(26);

    this.state.position = {
      lat,
      lon,
      relativeAltM,
      headingDeg: hdgRaw === HEADING_UNKNOWN ? this.state.position.headingDeg : hdgRaw / 100,
      lastUpdatedAt: now,
    };
  }

  private parseSysStatus(payload: Buffer): void {
    if (payload.length < 19) return;
    const now = Date.now();
    const voltageMv = payload.readUInt16LE(14);
    const currentCa = payload.readInt16LE(16);
    const remaining = payload.readInt8(18);

    this.state.battery = {
      voltageV: voltageMv === 65535 ? null : voltageMv / 1000,
      currentA: currentCa === -1 ? null : currentCa / 100,
      percent: remaining < 0 ? null : remaining,
      lastUpdatedAt: now,
    };
  }

  private parseVfrHud(payload: Buffer): void {
    if (payload.length < 20) return;
    const now = Date.now();
    const airspeed = payload.readFloatLE(0);
    const groundspeed = payload.readFloatLE(4);
    const heading = payload.readInt16LE(8);
    const climb = payload.readFloatLE(16);

    this.state.vfrHud = {
      airspeedMs: Number.isFinite(airspeed) ? airspeed : null,
      groundspeedMs: Number.isFinite(groundspeed) ? groundspeed : null,
      climbMs: Number.isFinite(climb) ? climb : null,
      lastUpdatedAt: now,
    };

    if (heading >= 0 && heading <= 360) {
      this.state.position = {
        ...this.state.position,
        headingDeg: heading,
        lastUpdatedAt: now,
      };
    }
  }
}

function extractPayload(raw: Buffer): Buffer | null {
  if (raw.length < 8) return null;
  const stx = raw[0];
  if (stx === MAVLINK_V1_STX) {
    const len = raw[1];
    if (raw.length < 6 + len + 2) return null;
    return raw.subarray(6, 6 + len);
  }
  if (stx === MAVLINK_V2_STX) {
    const len = raw[1];
    if (raw.length < 12 + len + 2) return null;
    return raw.subarray(12, 12 + len);
  }
  return null;
}

function categorizeVehicleType(mavlinkType: number): VehicleState['heartbeat']['vehicleType'] {
  if (VTOL_MAV_TYPES.has(mavlinkType)) return 'vtol';
  if (COPTER_MAV_TYPES.has(mavlinkType)) return 'multicopter';
  if (mavlinkType === 1) return 'fixed_wing';
  return 'unknown';
}

function resolveFlightMode(
  customMode: number,
  mavlinkType: number,
  autopilot: number,
): string {
  if (autopilot !== MAV_AUTOPILOT_ARDUPILOTMEGA) {
    return `MODE_${customMode}`;
  }
  if (COPTER_MAV_TYPES.has(mavlinkType)) {
    return ARDUCOPTER_MODE_NAMES[customMode] ?? `MODE_${customMode}`;
  }
  if (VTOL_MAV_TYPES.has(mavlinkType) || mavlinkType === 1) {
    return ARDUPLANE_MODE_NAMES[customMode] ?? `MODE_${customMode}`;
  }
  return `MODE_${customMode}`;
}
