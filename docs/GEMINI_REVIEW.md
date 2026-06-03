# MDT GCS — Gemini Review Pack

> **Repo:** https://github.com/zhaot3065/mdt-gcs  
> **Branch:** `main`  
> **Purpose:** Paste this document (or sections) into Gemini when you cannot clone the repo.  
> **Last updated:** 2026-06-03 — + Command egress (active-link only)

---

## 1. Project summary (one paragraph)

**MDT GCS** is an Electron + React GCS for ArduPilot with dual datalinks, **MavlinkRouter**, **VehicleState** telemetry (150 ms), **command egress** (ARM/DISARM/RTL on active link only via `datalink:send-command`), and a **hybrid map** (OSM online / `gcs-tiles://` offline). Leaflet shows live position/heading; vehicle panel uses a confirm modal before sending commands.

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
│   ├── mavlink-router.ts         # Dedup + active link + 'frame' event
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

**Preload:** `window.gcs.datalink.*` + `window.gcs.vehicle.onState` + `vehicle.sendCommand`

---

## 4. IPC contracts

### 4a. Datalink (`datalink:snapshot`, ~200 ms)

Payload: **`DatalinkIpcPayload`** = `{ links[2], router, updatedAt }`

- Each link: `metrics`, `health` (`isLive`, `isActiveRoute`, …)
- Router: `activeLinkId`, `selectionReason`, dedup metrics, `rtt` (heartbeat_proxy; TIMESYNC hook ready)

Invoke: `ethernet:connect|disconnect`, `h16:connect|disconnect`, `serial:list` → returns `DatalinkIpcPayload`.

**Egress invoke:** `datalink:send-command` → `GcsCommandRequest` → `GcsCommandResult`

```typescript
type GcsCommandType = 'arm' | 'disarm' | 'rtl';
interface GcsCommandRequest { command: GcsCommandType; targetSystem?: number; targetComponent?: number; }
interface GcsCommandResult { ok: boolean; command; activeLinkId?; bytesSent?; error?; errorCode?; }
```

Preload: `window.gcs.vehicle.sendCommand(request)`. Main: `COMMAND_LONG` on active link only.

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

**UI:** `MapDisplay` (main), `DatalinkStatusBar`, `VehicleMonitorPanel` (+ ARM/DISARM/RTL), `EthernetConnectPanel`, `RouterStatusPanel`, `MapLayerToggle`.

---

## 7. Commit phases

| Phase | Content |
|-------|---------|
| v0.1 | Electron scaffold, dual transport, link metrics UI |
| Router | MavlinkRouter, DatalinkIpcPayload, features/datalink |
| Telemetry | vehicle.ts, mavlink-parser, features/vehicle, Tailwind |
| Map | gcs-tiles protocol, Leaflet, features/map |
| Egress | send-command IPC, COMMAND_LONG arm/disarm/rtl |

---

## 8. Implemented vs not implemented

| Done | Not yet |
|------|---------|
| Dual link + router + dedup | Flight mode change commands |
| Command egress (arm/disarm/rtl) | Mission upload / geo-fence |
| Telemetry parser (4 msg types) | Full MAVLink dialect / mission protocol |
| Vehicle IPC + monitor UI | H16 connect UI panel |
| ArduPilot flight mode strings | TIMESYNC RTT |
| Tailwind vehicle gauges | Mission planner |
| Hybrid map (OSM + gcs-tiles) | H16 connect UI |
| Leaflet + vehicle marker | Mission planner |
| TIMESYNC hook on router (`rttProvider`) | Wired |

---

## 9. Suggested next prompts for Gemini

**A. Flight mode change**

> Extend `GcsCommandType` + `mavlink-command.ts` for DO_SET_MODE / ArduPilot custom_mode. Confirm modal pattern from VehicleCommandControls.

**B. H16 connect UI**

> `H16ConnectPanel` with `datalink:serial:list` + `h16:connect`, same dark theme as Ethernet panel.

**C. TIMESYNC RTT**

> Parse TIMESYNC in Main, inject `MavlinkRouter({ rttProvider })`, surface in `MavlinkRouterSnapshot.rtt`.

**D. HUD overlay**

> Add attitude/airspeed HUD overlay on map using `useVehicleStore` vfrHud + future ATTITUDE parse.

**E. Extend telemetry**

> Add ATTITUDE, GPS_RAW_INT to `mavlink-parser.ts`; extend `VehicleState` in `shared/types/vehicle.ts` first.

---

## 10. Key constants

```text
DEFAULT_MAVLINK_PORT = 14550
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
- datalink:send-command → { command: arm|disarm|rtl } → GcsCommandResult
- Preload: window.gcs.vehicle.sendCommand
- Sends MAVLink COMMAND_LONG on router active link only; blocks if stale/offline

Map: Online OSM / Offline gcs-tiles:// → userData/maps/{z}/{x}/{y}.png

Main: transport → router (dedup) → telemetry parser → vehicle:state
     + send-command → active transport.send only

Renderer: datalink/vehicle/map stores, MapDisplay, VehicleCommandControls (confirm modal)

Next: flight mode command, H16 UI, TIMESYNC, HUD overlay.
Paste full spec: docs/GEMINI_REVIEW.md
```

---

*Cross-LLM handoff (Gemini ↔ Cursor). Maintainer: zhaot3065/mdt-gcs.*
