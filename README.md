# MDT GCS

Web-based Ground Control Station for **ArduPilot** multicopters and VTOL, built with **Electron + React**.

Dual datalink support:

- **SprintLink** — Ethernet (UDP client/server, TCP client), default MAVLink port `14550`
- **H16** — Serial/USB RF link to the hand controller

## Features (v0.1 scaffold)

- Main-process connection layer with per-link MAVLink packet stats (loss rate, latency proxy)
- Real-time toolbar signal lamps (green / yellow / red) per datalink
- Field-friendly Ethernet connect mini-panel (IP, port, connect/disconnect)
- High-contrast dark theme for outdoor laptop use

## Quick start

```bash
git clone https://github.com/zhaot3065/mdt-gcs.git
cd mdt-gcs
npm install
npm run electron:dev
```

## Architecture

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for IPC flow, directory layout, and Zustand integration (intended for sharing with Gemini / co-design prompts).

## Project layout

```
electron/connection/   # UDP, TCP, Serial + MAVLink stats (Main)
src/stores/            # Zustand datalink store (Renderer)
shared/types/          # IPC contracts
```

## License

MIT
