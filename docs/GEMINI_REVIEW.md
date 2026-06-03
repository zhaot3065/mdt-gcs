# MDT GCS — Gemini Review Pack

> **Repo:** https://github.com/zhaot3065/mdt-gcs  
> **Branch:** `main`  
> **Purpose:** Paste this document (or sections) into Gemini when you cannot clone the repo.  
> **Last updated:** 2026-06-03 — includes MavlinkRouter + dual-link IPC v2

---

## 1. Project summary (one paragraph)

**MDT GCS** is an Electron + React ground control station for ArduPilot multicopters/VTOL with **two simultaneous datalinks**: SprintLink **Ethernet** (UDP client/server, TCP client, MAVLink port 14550) and **H16 RF** (USB serial). All socket/serial I/O runs in the **Main process**; React only receives serializable IPC. A **MavlinkRouter** deduplicates identical MAVLink frames from both links and selects an **active route** (prefer Ethernet when healthy). The UI uses a high-contrast dark theme, toolbar signal lamps per link, an Ethernet connect panel, and a router status panel.

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Electron 36 |
| UI | React 19 + Vite 6 |
| State | Zustand 5 (`src/features/datalink/store`) |
| Serial | `serialport` 13 (Main only) |
| Protocol | MAVLink v1/v2 parse in Main (no full message library yet) |

**Run:** `npm install` → `npm run electron:dev`

---

## 3. Repository layout (files that matter)

```
MDT_GCS/
├── docs/
│   ├── ARCHITECTURE.md       # Full design guide (IPC, flows, roadmap)
│   └── GEMINI_REVIEW.md      # This file
├── shared/types/datalink.ts  # IPC contracts — CHANGE FIRST for new features
├── electron/
│   ├── main.ts               # Window + ipcMain handlers
│   ├── preload.ts            # contextBridge → window.gcs
│   └── connection/
│       ├── connection-manager.ts  # Links + metrics broadcast
│       ├── mavlink-router.ts      # Dedup + active link
│       ├── mavlink-frame.ts       # Frame iterator + dedup key
│       ├── mavlink-stats.ts       # Per-link loss/latency
│       ├── link-quality.ts        # good/degraded/poor/offline
│       ├── udp-socket.ts
│       ├── tcp-socket.ts
│       └── serial-port.ts
└── src/
    ├── features/datalink/
    │   ├── store/use-datalink-store.ts
    │   ├── store/defaults.ts
    │   └── components/RouterStatusPanel.tsx
    ├── components/toolbar/DatalinkStatusBar.tsx
    └── components/connection/EthernetConnectPanel.tsx
```

---

## 4. IPC contract (complete)

**Channel name (unchanged):** `datalink:snapshot`  
**Payload shape (NEW):** `DatalinkIpcPayload` — not a bare array anymore.

```typescript
// shared/types/datalink.ts (conceptual)

type DatalinkId = 'ethernet' | 'h16_rf';

interface DatalinkIpcPayload {
  links: DatalinkSnapshot[];   // 2 entries, each with metrics + health
  router: MavlinkRouterSnapshot;
  updatedAt: number;           // epoch ms
}

interface DatalinkSnapshot {
  id: DatalinkId;
  label: string;
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  quality: 'good' | 'degraded' | 'poor' | 'offline';
  transport?: 'udp-client' | 'udp-server' | 'tcp-client' | 'serial';
  endpoint?: string;
  metrics: LinkMetrics;
  health: LinkHealth;
}

interface LinkHealth {
  isConnected: boolean;
  isLive: boolean;              // connected && lastPacketAgeMs < 3000
  isEligibleForActive: boolean;
  isActiveRoute: boolean;       // id === router.activeLinkId
}

interface MavlinkRouterSnapshot {
  activeLinkId: DatalinkId | null;
  selectionReason:
    | 'none'
    | 'ethernet_preferred'
    | 'h16_fallback'
    | 'stale_failover'
    | 'tie_break_priority';
  metrics: {
    framesIngested: number;
    framesDeduped: number;
    framesForwarded: number;
    dedupRatePercent: number;
    lastForwardedAt: number;
  };
  rtt: {
    activeRttMs: number | null;
    source: 'none' | 'heartbeat_proxy' | 'timesync';
    perLink: Record<DatalinkId, { rttMs: number | null; source: ...; updatedAt: number }>;
  };
}
```

**Renderer → Main (invoke):**

| Channel | Args | Returns |
|---------|------|---------|
| `datalink:ethernet:connect` | `{ mode, host, port, localHost?, localPort? }` | `DatalinkIpcPayload` |
| `datalink:ethernet:disconnect` | — | `DatalinkIpcPayload` |
| `datalink:h16:connect` | `{ path, baudRate }` | `DatalinkIpcPayload` |
| `datalink:h16:disconnect` | — | `DatalinkIpcPayload` |
| `datalink:serial:list` | — | `{ path, manufacturer? }[]` |

**Preload API:** `window.gcs.datalink.onPayload(handler)` — returns unsubscribe function.

**Security:** `contextIsolation: true`, `nodeIntegration: false`. No `Buffer` over IPC.

---

## 5. Main process data flow

```
[Ethernet UDP/TCP] ──┐
                     ├── chunk ──► MavlinkStreamStats (per-link metrics)
[H16 Serial]       ──┘              MavlinkRouter.ingest (dedup)
                                           │
                                           ▼
                              emit 'frame' { linkId, frame }  (for future parser)
                                           │
Every 200ms ◄──────────────────────────────┘
  build DatalinkIpcPayload
  webContents.send('datalink:snapshot', payload)
```

### MavlinkRouter rules

1. **Dedup key:** `sysid:compid:msgid:seq` — TTL **2000 ms** cache.
2. **Score (higher wins):** `1000 - loss%*12 - latency*0.5 - lastPacketAge*0.2` (only if connected + live).
3. **Priority order:** `ethernet` > `h16_rf` when scores within bias **5**.
4. **Failover:** If Ethernet connected but **not live** (age ≥ 3s) and H16 live → `stale_failover` → active = H16.
5. **RTT today:** HEARTBEAT interval deviation per link (`heartbeat_proxy`). **Extension point:** `new MavlinkRouter({ rttProvider: (id) => ms | null })` for TIMESYNC.

### Per-link metrics (MavlinkStreamStats)

- Sequence-gap loss per `(sysid, compid)`.
- Latency EWMA from ~1s HEARTBEAT deviation.
- `lastPacketAgeMs` drives stale / signal lamp quality.

---

## 6. Renderer / Zustand

**Store:** `useDatalinkFeatureStore` in `src/features/datalink/store/use-datalink-store.ts`

| State field | Source |
|-------------|--------|
| `payload` | Full `DatalinkIpcPayload` |
| `links` | `payload.links` |
| `router` | `payload.router` |
| `ethernetForm` | Local UI (host, port, mode) |

On mount: `subscribeIpc()` registers `window.gcs.datalink.onPayload`.

**UI components:**

- `DatalinkStatusBar` — signal lamps + **ROUTE** badge on active link.
- `EthernetConnectPanel` — IP/port/mode, connect/disconnect.
- `RouterStatusPanel` — active link, selection reason, dedup %, health table.

Legacy shim: `src/stores/datalink-store.ts` re-exports feature store as `useDatalinkStore`.

---

## 7. Commit history (high level)

| Phase | Content |
|-------|---------|
| Initial | Electron scaffold, UDP/TCP/Serial, per-link stats, dark UI, Zustand |
| Router | `MavlinkRouter`, `DatalinkIpcPayload`, `src/features/datalink`, ARCHITECTURE §8 |

---

## 8. Implemented vs not implemented

| Done | Not yet |
|------|---------|
| Dual link monitor + dedup router | Full MAVLink message decode / mission protocol |
| Active link **selection** (ingress) | Command **egress** only on active link |
| Ethernet UI connect | H16 serial connect UI panel |
| HEARTBEAT latency proxy | MAVLink TIMESYNC RTT |
| Router status UI stub | Map, HUD, mission planner |
| `frame` event from router | Consumer (parser) wired |

---

## 9. Suggested next prompts for Gemini

Copy one of these when planning the next iteration:

**A. Command egress**

> Wire `MavlinkRouter.getActiveLinkId()` so GCS commands (MISSION_ITEM, COMMAND_LONG) send only on the active transport; keep passive listen on backup. Extend `shared/types/datalink.ts` if UI needs egress link override. Main process only.

**B. H16 connect UI**

> Add `src/features/datalink/components/H16ConnectPanel.tsx` using `datalink:serial:list` and `datalink:h16:connect`. Match Ethernet panel styling.

**C. TIMESYNC RTT**

> Add `electron/connection/timesync-rtt.ts`, parse TIMESYNC messages in router path, inject `rttProvider` into `MavlinkRouter`, set `RttEstimate.source = 'timesync'`.

**D. MAVLink parser consumer**

> Subscribe to `MavlinkRouter` `'frame'` events in Main; feed a minimal message dispatcher for HEARTBEAT, GPS, ATTITUDE for HUD stub.

---

## 10. Key constants

```text
DEFAULT_MAVLINK_PORT = 14550
LINK_STALE_MS = 3000
METRICS_INTERVAL_MS = 200
DEDUP_TTL_MS = 2000
ETHERNET_SCORE_BIAS = 5
```

---

## 11. Quality / signal lamp thresholds

From `link-quality.ts`:

- **good:** loss ≤ 5%, latency/age ≤ 120 ms (and connected, not stale)
- **degraded:** loss ≤ 15%, ≤ 350 ms
- **poor:** worse or stale (> 3s since last frame)
- **offline:** not connected

---

## 12. Instructions for Gemini reviewers

1. Treat **`shared/types/datalink.ts`** as the contract — propose IPC changes before UI/Main logic.
2. Keep **routing, dedup, sockets** in `electron/connection/*`, not React.
3. When suggesting code, respect **dual-link independence**: per-link stats always remain; router is an additional fan-in layer.
4. Reference **`docs/ARCHITECTURE.md`** for diagrams; this file is the **paste-friendly snapshot** of repo state.

---

*Generated for cross-LLM handoff (Gemini ↔ Cursor). Repo owner: zhaot3065/mdt-gcs.*
