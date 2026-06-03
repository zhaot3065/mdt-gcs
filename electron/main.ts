import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { ConnectionManager } from './connection/connection-manager';
import { MavlinkTelemetryParser } from './connection/mavlink-parser';
import {
  registerGcsTilesScheme,
  setupGcsTilesHandler,
  ensureOfflineMapsDir,
} from './protocol/gcs-tiles-protocol';
import {
  IPC_CHANNELS,
  type EthernetConnectOptions,
  type GcsCommandRequest,
  type SerialConnectOptions,
} from '../shared/types/datalink';
import { VEHICLE_BROADCAST_MS } from '../shared/types/vehicle';

registerGcsTilesScheme();

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
const connectionManager = new ConnectionManager();
const telemetryParser = new MavlinkTelemetryParser(connectionManager.getRouter());

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0c10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    connectionManager.stopMetricsBroadcast();
    telemetryParser.stopBroadcast();
  });

  connectionManager.stopMetricsBroadcast();
  telemetryParser.stopBroadcast();
  connectionManager.startMetricsBroadcast(() => mainWindow);
  telemetryParser.startBroadcast(() => mainWindow, VEHICLE_BROADCAST_MS);
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.ETHERNET_CONNECT, async (_e, opts: EthernetConnectOptions) => {
    await connectionManager.connectEthernet(opts);
    return connectionManager.getPayload();
  });

  ipcMain.handle(IPC_CHANNELS.ETHERNET_DISCONNECT, async () => {
    await connectionManager.disconnectEthernet();
    return connectionManager.getPayload();
  });

  ipcMain.handle(IPC_CHANNELS.H16_CONNECT, async (_e, opts: SerialConnectOptions) => {
    await connectionManager.connectH16(opts);
    return connectionManager.getPayload();
  });

  ipcMain.handle(IPC_CHANNELS.H16_DISCONNECT, async () => {
    await connectionManager.disconnectH16();
    return connectionManager.getPayload();
  });

  ipcMain.handle(IPC_CHANNELS.LIST_SERIAL_PORTS, () => connectionManager.listSerialPorts());

  ipcMain.handle(IPC_CHANNELS.SEND_COMMAND, (_e, request: GcsCommandRequest) => {
    return connectionManager.sendGcsCommand(request);
  });
}

app.whenReady().then(async () => {
  await ensureOfflineMapsDir();
  setupGcsTilesHandler();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  connectionManager.stopMetricsBroadcast();
  telemetryParser.stopBroadcast();
  telemetryParser.dispose();
  if (process.platform !== 'darwin') app.quit();
});
