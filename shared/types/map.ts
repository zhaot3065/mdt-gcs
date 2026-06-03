/**
 * Map layer configuration (Renderer-local; no IPC required for tile mode).
 */

export type MapTileMode = 'online' | 'offline';

/** Default online tiles — OpenStreetMap (Starlink / internet) */
export const ONLINE_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const ONLINE_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Electron custom protocol — resolved in Main from userData/maps/ */
export const OFFLINE_TILE_URL = 'gcs-tiles://{z}/{x}/{y}.png';

export const DEFAULT_MAP_CENTER: [number, number] = [37.5665, 126.978];
export const DEFAULT_MAP_ZOOM = 15;
