# MDT GCS — Gemini Review Pack

> **Repo:** https://github.com/zhaot3065/mdt-gcs  
> **Branch:** `main`  
> **Purpose:** Paste this document (or sections) into Gemini when you cannot clone the repo.  
> **Last updated:** 2026-06-04 — + TIMESYNC RTT + Electron CJS/serialport build fix

---

## 1. Project summary (one paragraph)

**MDT GCS** is an Electron + React GCS for ArduPilot with **dual datalinks** (SprintLink Ethernet + **H16 USB serial**), **MavlinkRouter**, **VehicleState** telemetry, **command egress**, hybrid map, and field panels for Ethernet/H16 connect, flight mode, and vehicle commands.

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Electron 36 |
| UI | React 19 + Vite 6 + **Tailwind CSS v4** |
| State | Zustand — `features/datalink`, `features/vehicle`, `features/map` |
| Map | Leaflet + react-leaflet |
| Serial | `serialport` 13 (Main only) |
| Protocol | Hand-rolled MAVLink v1/v2 frame parse in Main |

**Run:** `npm install` → `npm run electron:dev`

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
│   └── map.ts                    # Tile URLs, map mode constants
├── electron/connection/
│   ├── connection-manager.ts
│   ├── mavlink-router.ts         # Dedup + active link + rttSlotProvider
│   ├── timesync-rtt.ts           # GCS-initiated TIMESYNC #111 → per-link RTT
│   ├── mavlink-pack.ts           # Shared MAVLink v2 packer (Main egress)
│   ├── mavlink-parser.ts         # frame → VehicleState
│   ├── mavlink-command.ts        # COMMAND_LONG encoder
│   ├── command-egress.ts         # active-link send guard
│   ├── mavlink-frame.ts
│   ├── mavlink-stats.ts
│   └── udp / tcp / serial transports
└── src/features/
    ├── datalink/                 # useDatalinkFeatureStore, RouterStatusPanel
    ├── vehicle/                  # useVehicleStore, VehicleMonitorPanel
    └── map/                      # useMapStore, MapDisplay, gcs-tiles layer
```

```
electron/protocol/gcs-tiles-protocol.ts  # protocol.handle → userData/maps
```

**Preload:** `window.gcs.datalink.*` (incl. `getSerialPorts`, `connectH16`, `disconnectH16`) + `vehicle.onState` + `vehicle.sendCommand`

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
type GcsCommandType = 'arm' | 'disarm' | 'rtl' | 'set_mode';
interface GcsCommandRequest {
  command: GcsCommandType;
  customMode?: number;   // required for set_mode (ArduPilot custom_mode)
  targetSystem?: number;
  targetComponent?: number;
}
interface GcsCommandResult { ok: boolean; command; activeLinkId?; bytesSent?; error?; errorCode?; }
```

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
    percent: number | null;     // null if MAVLink -1
    lastUpdatedAt: number;
  };
  vfrHud: {
    airspeedMs: number | null;
    groundspeedMs: number | null;
    climbMs: number | null;
    lastUpdatedAt: number;
  };
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
  msg 1  SYS_STATUS          → battery.*
  msg 30 ATTITUDE             → attitude.roll/pitch/yaw (deg)
  msg 74 VFR_HUD             → vfrHud.* (+ heading fallback)
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

---

## 6. Renderer stores

| Store | File | IPC |
|-------|------|-----|
| Datalink | `useDatalinkFeatureStore` | `gcs.datalink.onPayload` |
| Vehicle | `useVehicleStore` | `gcs.vehicle.onState` |
| Map | `useMapStore` | (local only — tile mode toggle) |

`App.tsx` mounts datalink + vehicle IPC on load.

**UI:** `MapDisplay`, `DatalinkStatusBar`, `VehicleMonitorPanel`, `EthernetConnectPanel`, **`H16ConnectPanel`** (port refresh 🔄, baud 57600 default), `RouterStatusPanel`, `MapLayerToggle`.

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

**Build note:** `package.json` has `"type":"module"` — Main/Preload must be **`.cjs`** + `lib.formats: ['cjs']` in `vite.config.ts` so `serialport` native bindings and `__dirname` work.

---

## 8. Implemented vs not implemented

| Done | Not yet |
|------|---------|
| Dual link + router + dedup | Mission upload / geo-fence |
| Command egress (arm/disarm/rtl/set_mode) | Full MAVLink dialect |
| Flight mode dropdown + confirm | — |
| Telemetry parser (5 msg types incl. ATTITUDE) | Mission protocol |
| H16 serial connect UI | Mission planner |
| Vehicle IPC + monitor UI | — |
| Hybrid map (OSM + gcs-tiles) | — |
| Map HUD overlay (ATTITUDE + VFR readouts) | Mission planner |
| Leaflet + vehicle marker | — |
| TIMESYNC RTT (per-link, 1.5s ping, EWMA) | — |
| Router RTT in toolbar + RouterStatusPanel | — |

---

## 9. Suggested next prompts for Gemini

**A. HUD overlay on map (priority)**

> Add `VehicleAttitude` + ATTITUDE (#30) parse in Main; overlay on `MapDisplay` (airspeed, alt, heading, artificial horizon) via `useVehicleStore`.

**B. Mission planner**

> Mission items egress via same active-link guard; extend `GcsCommandType` as needed.

**C. Extend telemetry**

> Add GPS_RAW_INT, BATTERY_STATUS to `mavlink-parser.ts`; extend `shared/types/vehicle.ts` first.

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

1. **Contract first:** `shared/types/datalink.ts` or `shared/types/vehicle.ts` before Main/UI code.
2. **Parsing / routing / sockets** stay in `electron/connection/*`.
3. **Renderer** only subscribes via preload — never `require('dgram')` in React.
4. Per-link stats remain independent; router + parser are layers on top.

---

## 12. Short paste block (minimal handoff)

```text
Repo: https://github.com/zhaot3065/mdt-gcs (main)
Stack: Electron+React+Zustand+Tailwind+Leaflet. ArduPilot GCS, dual link (ethernet + h16_rf).

IPC in:
- datalink:snapshot → DatalinkIpcPayload, 200ms
- vehicle:state → VehicleState, 150ms

IPC out (egress):
- datalink:send-command → arm|disarm|rtl|set_mode (+ customMode) → GcsCommandResult
- Preload: window.gcs.vehicle.sendCommand
- Sends MAVLink COMMAND_LONG on router active link only; blocks if stale/offline

Map: Online OSM / Offline gcs-tiles:// → userData/maps/{z}/{x}/{y}.png

Main: transport → router (dedup) → telemetry parser → vehicle:state
     + send-command → active transport.send only

Renderer: H16ConnectPanel (getSerialPorts on mount), EthernetConnectPanel, FlightModeSelector, VehicleCommandControls

TIMESYNC RTT + map HUD done. Next: mission planner.
Paste full spec: docs/GEMINI_REVIEW.md
```

---

*Cross-LLM handoff (Gemini ↔ Cursor). Maintainer: zhaot3065/mdt-gcs.*
