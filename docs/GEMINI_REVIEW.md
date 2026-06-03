# MDT GCS — Gemini Review Pack

> **Repo:** https://github.com/zhaot3065/mdt-gcs  
> **Branch:** `main`  
> **Purpose:** Paste this document (or sections) into Gemini when you cannot clone the repo.  
> **Last updated:** 2026-06-04 — + MISSION_ITEM handshake + map overlay layout fix

---

## 1. Project summary (one paragraph)

**MDT GCS** is an Electron + React GCS for ArduPilot with **dual datalinks** (SprintLink Ethernet + **H16 USB serial**), **MavlinkRouter**, **VehicleState** telemetry, **command egress**, hybrid map, and field panels for Ethernet/H16 connect, flight mode, and vehicle commands.

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Electron 36 |
| UI | React 19 + Vite 6 + **Tailwind CSS v4** |
| State | Zustand — `features/datalink`, `features/vehicle`, `features/map`, `features/mission` |
| Map | Leaflet + react-leaflet |
| Serial | `serialport` 13 (Main only) |
| Protocol | Hand-rolled MAVLink v1/v2 frame parse in Main |

**Run:** `npm install` → `npm run electron:dev` (runs `vite` only — `vite-plugin-electron` starts one Electron instance)

---

## 3. Repository layout (files that matter)

```
MDT_GCS/
├── docs/
│   ├── ARCHITECTURE.md
│   └── GEMINI_REVIEW.md          # This file
├── shared/types/
│   ├── datalink.ts               # DatalinkIpcPayload — change first for link IPC
│   ├── vehicle.ts                # VehicleState — telemetry IPC
│   ├── mission.ts                # WaypointItem, GcsMissionPayload — mission IPC
│   └── map.ts                    # Tile URLs, map mode constants
├── electron/connection/
│   ├── connection-manager.ts
│   ├── mavlink-router.ts         # Dedup + active link + rttSlotProvider
│   ├── timesync-rtt.ts           # GCS-initiated TIMESYNC #111 → per-link RTT
│   ├── mavlink-pack.ts           # Shared MAVLink v2 packer (Main egress)
│   ├── mavlink-mission.ts        # MISSION_COUNT (#44) encoder
│   ├── mission-egress.ts         # Mission upload stub (active-link guard)
│   ├── mavlink-parser.ts         # frame → VehicleState
│   ├── mavlink-command.ts        # COMMAND_LONG encoder
│   ├── command-egress.ts         # sendFrameOnActiveLink guard (shared)
│   ├── mavlink-frame.ts
│   ├── mavlink-stats.ts
│   └── udp / tcp / serial transports
└── src/features/
    ├── datalink/                 # useDatalinkFeatureStore, RouterStatusPanel
    ├── vehicle/                  # useVehicleStore, VehicleMonitorPanel
    ├── map/                      # useMapStore, MapDisplay, MapHudOverlay
    └── mission/                  # useMissionStore, MissionListPanel, upload confirm
```

```
electron/protocol/gcs-tiles-protocol.ts  # protocol.handle → userData/maps
```

**Preload:** `window.gcs.datalink.*` + `vehicle.onState` + `vehicle.sendCommand` + **`mission.upload`**

---

## 4. IPC contracts

### 4a. Datalink (`datalink:snapshot`, ~200 ms)

Payload: **`DatalinkIpcPayload`** = `{ links[2], router, updatedAt }`

- Each link: `metrics`, `health` (`isLive`, `isActiveRoute`, …)
- Router: `activeLinkId`, `selectionReason`, dedup metrics, `rtt` (`RttEstimate`: TIMESYNC preferred, `heartbeat_proxy` fallback)

Invoke:
- `ethernet:connect|disconnect` → `DatalinkIpcPayload`
- `h16:connect` → `SerialConnectOptions` `{ path, baudRate }` → `DatalinkIpcPayload`
- `h16:disconnect` → `DatalinkIpcPayload`
- `serial:list` → `SerialPortInfo[]` (not full payload)

Preload aliases: `getSerialPorts()` = `serial:list`, `connectH16`, `disconnectH16`.

**Egress invoke:** `datalink:send-command` → `GcsCommandRequest` → `GcsCommandResult`

```typescript
type GcsCommandType = 'arm' | 'disarm' | 'rtl' | 'set_mode' | 'mission_upload';
interface GcsCommandRequest {
  command: GcsCommandType;  // vehicle panel uses arm|disarm|rtl|set_mode only
  customMode?: number;
  targetSystem?: number;
  targetComponent?: number;
}
interface GcsCommandResult {
  ok: boolean;
  command: GcsCommandType;
  activeLinkId?: DatalinkId;
  bytesSent?: number;
  missionItemCount?: number;  // set when command === 'mission_upload'
  error?: string;
  errorCode?: 'NO_ACTIVE_LINK' | 'LINK_NOT_CONNECTED' | 'LINK_NOT_LIVE' | 'ENCODE_FAILED' | 'SEND_FAILED';
}
```

**Mission egress invoke:** `datalink:mission:upload` → `GcsMissionPayload` → `GcsCommandResult` (`command: 'mission_upload'`)

```typescript
// shared/types/mission.ts
interface WaypointItem {
  seq: number;
  command: number;   // e.g. MAV_CMD_NAV_WAYPOINT = 16
  lat: number;
  lon: number;
  alt: number;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
}
interface GcsMissionPayload {
  items: WaypointItem[];
  targetSystem?: number;      // default 1
  targetComponent?: number;   // default 1
  missionType?: number;       // default 0 (MAV_MISSION_TYPE_MISSION)
}
```

Preload: `window.gcs.mission.upload(payload)`.

**Main today:** encodes **MISSION_COUNT (#44)** only — announces `items.length`. Full `MISSION_REQUEST` / `MISSION_ITEM_INT` handshake is **next phase**.

**MAVLink encoding (Main):**
| command | MAV_CMD | params |
|---------|---------|--------|
| arm | 400 | param1=1 |
| disarm | 400 | param1=0 |
| rtl | 20 | — |
| set_mode | 176 DO_SET_MODE | param1=1 (CUSTOM_MODE_ENABLED), param2=customMode |

Preload: `window.gcs.vehicle.sendCommand(request)`. Active link only; blocks if stale.

### 4b. Vehicle (`vehicle:state`, ~150 ms throttled)

Payload: **`VehicleState`** from `shared/types/vehicle.ts`:

```typescript
interface VehicleState {
  connected: boolean;           // HEARTBEAT within 5s
  lastHeardAt: number;
  updatedAt: number;
  heartbeat: {
    vehicleType: 'multicopter' | 'vtol' | 'fixed_wing' | 'unknown';
    mavlinkType: number;
    flightMode: string;         // ArduPilot mode names when autopilot=3
    customMode: number;
    isArmed: boolean;
    autopilot: number;
    lastUpdatedAt: number;
  };
  position: {
    lat: number | null;         // degrees
    lon: number | null;
    relativeAltM: number | null;
    headingDeg: number | null;
    lastUpdatedAt: number;
  };
  battery: {
    voltageV: number | null;
    currentA: number | null;
    percent: number | null;     // BATTERY_STATUS #147 preferred; SYS_STATUS #1 fallback
    lastUpdatedAt: number;
  };
  gps: {
    fixType: number;            // GPS_FIX_TYPE (GPS_RAW_INT #24)
    satellitesVisible: number;
    hdop: number | null;        // eph / 100; null if eph=65535
    lastUpdatedAt: number;
  };
  vfrHud: { airspeedMs, groundspeedMs, climbMs, lastUpdatedAt };
  attitude: { rollDeg, pitchDeg, yawDeg, lastUpdatedAt };  // msg 30 ATTITUDE
}
```

**Preload:** `window.gcs.vehicle.onState(handler)` → unsubscribe fn.

**Security:** No `Buffer` over IPC. `contextIsolation: true`.

### 4c. Hybrid map (no IPC — custom protocol only)

| Mode | Leaflet tile URL | Backend |
|------|------------------|---------|
| Online | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Internet (Starlink) |
| Offline | `gcs-tiles://{z}/{x}/{y}.png` | Main `protocol.handle` |

**Main setup (`electron/main.ts`):**

1. `registerGcsTilesScheme()` — before `app.whenReady()`
2. `ensureOfflineMapsDir()` + `setupGcsTilesHandler()` — inside ready

**Tile files:** `{userData}/maps/{z}/{x}/{y}.png` (Windows: `%APPDATA%/mdt-gcs/maps/...`). Missing file → dark placeholder PNG.

**Renderer:** `useMapStore.tileMode` (`online` | `offline`), `MapDisplay` + `MapLayerToggle`, marker from `useVehicleStore` (lat/lon/heading, SVG rotate 150ms).

**Constants:** `shared/types/map.ts`

---

## 5. Main process pipelines

### Pipeline A — Dual link + router

```
Transport data → MavlinkStreamStats (per link)
              → MavlinkRouter.ingest → dedup → emit 'frame'
              → every 200ms: DatalinkIpcPayload → datalink:snapshot
```

### Pipeline B — Telemetry (NEW)

```
MavlinkRouter 'frame' → MavlinkTelemetryParser
  msg 0  HEARTBEAT           → heartbeat.*
  msg 33 GLOBAL_POSITION_INT → position.*
  msg 1  SYS_STATUS          → battery.voltage/current/percent (fallback)
  msg 24 GPS_RAW_INT         → gps.fixType, satellitesVisible, hdop (eph/100)
  msg 30 ATTITUDE            → attitude.roll/pitch/yaw (deg)
  msg 74 VFR_HUD             → vfrHud.* (+ heading fallback)
  msg 147 BATTERY_STATUS     → battery.percent (priority over SYS_STATUS)
  → dirty flag → 150ms throttle → vehicle:state
```

**Router dedup:** `sysid:compid:msgid:seq`, TTL 2s.  
**Active link:** score + Ethernet priority; stale failover to H16.

### Pipeline C — Command egress

```
Renderer: window.gcs.vehicle.sendCommand({ command: 'arm'|'disarm'|'rtl' })
  → ipc invoke datalink:send-command
  → ConnectionManager.sendGcsCommand
  → command-egress: validate activeLinkId + link live
  → mavlink-command: encode COMMAND_LONG (MAVLink v2)
  → active transport.send(buffer) ONLY (never backup link)
```

**Safety blocks:** `NO_ACTIVE_LINK`, `LINK_NOT_CONNECTED`, `LINK_NOT_LIVE`, `ENCODE_FAILED`, `SEND_FAILED`.

**UI:** `VehicleCommandControls` + confirm modal before send.

### Pipeline D — Mission upload (full handshake)

```
Renderer: useMissionStore.uploadMission()  [Promise — awaits ACK]
  → window.gcs.mission.upload(GcsMissionPayload)
  → ipc invoke datalink:mission:upload
  → ConnectionManager.uploadMission (async)
  → mission-egress MissionUploadSession:
      1. sendFrameOnActiveLink → MISSION_COUNT (#44)
      2. router 'frame' → MISSION_REQUEST (#40) / MISSION_REQUEST_INT (#51)
         guard: sysid/compid match target vehicle
      3. sendFrameOnActiveLink → MISSION_ITEM_INT (#38) per seq
         lat/lon × 1e7 int32, alt float, MAV_FRAME_GLOBAL_RELATIVE_ALT
      4. MISSION_ACK (#47) type=0 → resolve { ok: true, missionItemCount }
      5. Step timeout 5s → MISSION_UPLOAD_TIMEOUT
  → egress always on active link; ingress ACK/REQUEST on any deduped frame from vehicle
```

**Map mission editor:**
- `useMissionStore.isEditMode`, `MissionMapLayers`, `MissionListPanel`, upload confirm modal
- Map overlay: `map-overlay-top-right` stacks Map source + HUD (no overlap)

---

## 6. Renderer stores

| Store | File | IPC |
|-------|------|-----|
| Datalink | `useDatalinkFeatureStore` | `gcs.datalink.onPayload` |
| Vehicle | `useVehicleStore` | `gcs.vehicle.onState` |
| Map | `useMapStore` | (local — tile mode) |
| Mission | `useMissionStore` | `gcs.mission.upload` (invoke) |

`App.tsx` mounts datalink + vehicle IPC on load.

**UI:** `MapDisplay` (+ `MissionMapLayers`, `MapHudOverlay`), `MissionListPanel`, `DatalinkStatusBar`, `VehicleMonitorPanel`, connect panels, `RouterStatusPanel`, `MapLayerToggle`.

**Flight modes UI:** `src/features/vehicle/constants/flight-modes.ts` — Copter + VTOL Q/Plane modes; confirm modal on change.

---

## 7. Commit phases

| Phase | Content |
|-------|---------|
| v0.1 | Electron scaffold, dual transport, link metrics UI |
| Router | MavlinkRouter, DatalinkIpcPayload, features/datalink |
| Telemetry | vehicle.ts, mavlink-parser, features/vehicle, Tailwind |
| Map | gcs-tiles protocol, Leaflet, features/map |
| Egress | send-command IPC, COMMAND_LONG arm/disarm/rtl/set_mode |
| Flight mode UI | FlightModeSelector + DO_SET_MODE |
| H16 UI | H16ConnectPanel + SerialPort.list |
| TIMESYNC RTT | `timesync-rtt.ts` + router `rttSlotProvider` + UI RTT display |
| Electron build | `main.cjs` / `preload.cjs`; `serialport` external + CJS lib format |
| Map HUD | `MapHudOverlay` + ATTITUDE parse |
| Mission foundation | `mission.ts`, `useMissionStore`, MISSION_COUNT |
| Map mission editor | Edit mode, markers, polyline, list panel, upload confirm |
| Mission handshake | `MissionUploadSession` — COUNT→REQUEST→ITEM_INT→ACK |
| Dev fix | `electron:dev` = `vite` only |
| Map UI | HUD + map source stacked top-right |
| Mission UX | Reorder ▲/▼, command dropdown, HOME row, JSON save/load (renderer-only) |
| Telemetry ext | GPS_RAW_INT #24 + BATTERY_STATUS #147; toolbar GPS/batt badges |

**Build note:** `package.json` has `"type":"module"` — Main/Preload must be **`.cjs`** + `lib.formats: ['cjs']` in `vite.config.ts` so `serialport` native bindings and `__dirname` work.

---

## 8. Implemented vs not implemented

| Done | Not yet |
|------|---------|
| Dual link + router + dedup + TIMESYNC RTT | Geo-fence / rally missions |
| Command egress + mission upload handshake | Full MAVLink dialect |
| Map mission editor + MISSION_ITEM_INT Main | Full MAVLink dialect |
| Map HUD (SPD/ALT/HDG/VS + attitude horizon) | Geo-fence / rally mission types |
| Mission UX: reorder, MAV_CMD select, HOME row | Mission download from autopilot |
| Mission JSON export/import (`MissionFileDocument`) | SITL integration tests in CI |
| GPS_RAW_INT + BATTERY_STATUS → `VehicleGps` + battery priority | |
| Toolbar badges: 🛰 sats + 🔋 %; GPS section in VehicleMonitorPanel | |
| H16 + Ethernet connect UI | |
| Vehicle telemetry + commands | |

---

## 9. Suggested next prompts for Gemini

**A. Mission download / advanced types (priority)**

> MISSION_REQUEST_LIST from autopilot; geo-fence / rally via `MAV_MISSION_TYPE`.

**B. SITL CI**

> Headless Electron or parser unit tests against recorded MAVLink captures.

---

## 10. Key constants

```text
DEFAULT_MAVLINK_PORT = 14550
DEFAULT_H16_BAUD_RATE = 57600
LINK_STALE_MS = 3000
VEHICLE_STALE_MS = 5000
METRICS_INTERVAL_MS = 200
VEHICLE_BROADCAST_MS = 150
DEDUP_TTL_MS = 2000
```

---

## 11. Rules for Gemini

1. **Contract first:** `shared/types/datalink.ts`, `shared/types/vehicle.ts`, or **`shared/types/mission.ts`** before Main/UI code.
2. **Parsing / routing / sockets** stay in `electron/connection/*`.
3. **Renderer** only subscribes via preload — never `require('dgram')` in React.
4. Per-link stats remain independent; router + parser are layers on top.

---

## 12. Short paste block (minimal handoff)

```text
Repo: https://github.com/zhaot3065/mdt-gcs (main)
Stack: Electron+React+Zustand+Tailwind+Leaflet. ArduPilot GCS, dual link (ethernet + h16_rf).

IPC in:
- datalink:snapshot → DatalinkIpcPayload, 200ms (router.rtt: TIMESYNC preferred)
- vehicle:state → VehicleState, 150ms (attitude HUD + gps + battery)

IPC out:
- datalink:send-command → arm|disarm|rtl|set_mode
- datalink:mission:upload → GcsMissionPayload → Promise<GcsCommandResult>
  (MISSION_COUNT → MISSION_ITEM_INT* → MISSION_ACK handshake)

Renderer: mission editor + MissionListPanel; HUD; GPS/battery badges in toolbar; VehicleMonitorPanel GPS section

Done: TIMESYNC RTT, mission handshake, map editor, mission UX, GPS_RAW_INT + BATTERY_STATUS telemetry.
Next: mission download, geo-fence/rally, SITL CI.

Paste: docs/GEMINI_REVIEW.md + docs/ARCHITECTURE.md
```

---

*Cross-LLM handoff (Gemini ↔ Cursor). Maintainer: zhaot3065/mdt-gcs.*
