# MDT GCS — Gemini Review Pack

> **Repo:** https://github.com/zhaot3065/mdt-gcs  
> **Branch:** `main`  
> **Purpose:** Paste this document (or sections) into Gemini when you cannot clone the repo.  
> **Last updated:** 2026-06-03 — MavlinkRouter + Vehicle telemetry pipeline

---

## 1. Project summary (one paragraph)

**MDT GCS** is an Electron + React ground control station for ArduPilot multicopters/VTOL with **dual datalinks** (SprintLink Ethernet + H16 USB serial). All I/O and MAVLink processing run in **Main**; React consumes IPC only. **MavlinkRouter** deduplicates frames and picks an active link. **MavlinkTelemetryParser** subscribes to router `frame` events, decodes HEARTBEAT / GLOBAL_POSITION_INT / SYS_STATUS / VFR_HUD into **`VehicleState`**, and broadcasts to the UI every **150 ms**. UI: dark theme, link signal lamps, router panel, **VehicleMonitorPanel** (Tailwind gauges).

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Electron 36 |
| UI | React 19 + Vite 6 + **Tailwind CSS v4** |
| State | Zustand 5 — `features/datalink`, `features/vehicle` |
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
│   └── vehicle.ts                # VehicleState — change first for telemetry IPC
├── electron/connection/
│   ├── connection-manager.ts
│   ├── mavlink-router.ts         # Dedup + active link + 'frame' event
│   ├── mavlink-parser.ts         # frame → VehicleState
│   ├── mavlink-frame.ts
│   ├── mavlink-stats.ts
│   └── udp / tcp / serial transports
└── src/features/
    ├── datalink/                 # useDatalinkFeatureStore, RouterStatusPanel
    └── vehicle/                  # useVehicleStore, VehicleMonitorPanel
```

**Preload:** `window.gcs.datalink.*` + `window.gcs.vehicle.onState(cb)`

---

## 4. IPC contracts

### 4a. Datalink (`datalink:snapshot`, ~200 ms)

Payload: **`DatalinkIpcPayload`** = `{ links[2], router, updatedAt }`

- Each link: `metrics`, `health` (`isLive`, `isActiveRoute`, …)
- Router: `activeLinkId`, `selectionReason`, dedup metrics, `rtt` (heartbeat_proxy; TIMESYNC hook ready)

Invoke: `ethernet:connect|disconnect`, `h16:connect|disconnect`, `serial:list` → returns `DatalinkIpcPayload`.

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

---

## 6. Renderer stores

| Store | File | IPC |
|-------|------|-----|
| Datalink | `useDatalinkFeatureStore` | `gcs.datalink.onPayload` |
| Vehicle | `useVehicleStore` | `gcs.vehicle.onState` |

`App.tsx` mounts both subscriptions on load.

**UI:** `DatalinkStatusBar`, `EthernetConnectPanel`, `RouterStatusPanel`, `VehicleMonitorPanel` (Tailwind).

---

## 7. Commit phases

| Phase | Content |
|-------|---------|
| v0.1 | Electron scaffold, dual transport, link metrics UI |
| Router | MavlinkRouter, DatalinkIpcPayload, features/datalink |
| Telemetry | vehicle.ts, mavlink-parser, features/vehicle, Tailwind |

---

## 8. Implemented vs not implemented

| Done | Not yet |
|------|---------|
| Dual link + router + dedup | Command egress on active link only |
| Telemetry parser (4 msg types) | Full MAVLink dialect / mission protocol |
| Vehicle IPC + monitor UI | H16 connect UI panel |
| ArduPilot flight mode strings | TIMESYNC RTT |
| Tailwind vehicle gauges | Map, HUD, mission planner |
| TIMESYNC hook on router (`rttProvider`) | Wired |

---

## 9. Suggested next prompts for Gemini

**A. Command egress (priority)**

> Use `MavlinkRouter.getActiveLinkId()` and active transport in ConnectionManager to send COMMAND_LONG / MISSION_ITEM only on the active link. Extend `shared/types/datalink.ts` if UI needs manual override.

**B. H16 connect UI**

> `H16ConnectPanel` with `datalink:serial:list` + `h16:connect`, same dark theme as Ethernet panel.

**C. TIMESYNC RTT**

> Parse TIMESYNC in Main, inject `MavlinkRouter({ rttProvider })`, surface in `MavlinkRouterSnapshot.rtt`.

**D. Map / HUD**

> Consume `useVehicleStore` in `src/features/map` or `hud` — lat/lon/heading/alt/battery; keep IPC read-only in Renderer.

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
Stack: Electron+React+Zustand+Tailwind. ArduPilot GCS, dual link (ethernet + h16_rf).

IPC:
- datalink:snapshot → DatalinkIpcPayload (links + router), 200ms
- vehicle:state → VehicleState, 150ms throttled

Main: ConnectionManager → stats + MavlinkRouter (dedup) → MavlinkTelemetryParser (HB/GPS_INT/SYS_STATUS/VFR_HUD)

Renderer: useDatalinkFeatureStore, useVehicleStore, VehicleMonitorPanel

Next: active-link command egress, H16 UI, TIMESYNC, map/HUD.
Full detail: docs/GEMINI_REVIEW.md in repo.
```

---

*Cross-LLM handoff (Gemini ↔ Cursor). Maintainer: zhaot3065/mdt-gcs.*
