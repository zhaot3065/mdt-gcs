import { app, protocol } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const SCHEME = 'gcs-tiles';

/** 1×1 dark slate PNG — scaled by Leaflet per tile */
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Must run before app.whenReady().
 * @see https://www.electronjs.org/docs/latest/api/protocol#protocolregisterschemesasprivilegedcustomschemes
 */
export function registerGcsTilesScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

export function getOfflineMapsRoot(): string {
  return path.join(app.getPath('userData'), 'maps');
}

export async function ensureOfflineMapsDir(): Promise<void> {
  const root = getOfflineMapsRoot();
  await fs.mkdir(root, { recursive: true });
  const readme = path.join(root, 'README.txt');
  try {
    await fs.access(readme);
  } catch {
    await fs.writeFile(
      readme,
      [
        'MDT GCS offline map tiles',
        'Place PNG tiles at: {z}/{x}/{y}.png',
        'Example: maps/14/13952/6342.png',
        '',
      ].join('\n'),
      'utf8',
    );
  }
}

/**
 * Register protocol.handle — call once inside app.whenReady().
 * URL forms supported:
 *   gcs-tiles://{z}/{x}/{y}.png   (Leaflet default substitution)
 *   gcs-tiles://tile/{z}/{x}/{y}.png
 */
export function setupGcsTilesHandler(): void {
  protocol.handle(SCHEME, async (request) => {
    try {
      const parsed = parseTileUrl(request.url);
      if (!parsed) {
        return pngResponse(PLACEHOLDER_PNG, 400);
      }

      const { z, x, y } = parsed;
      const tilePath = path.join(getOfflineMapsRoot(), z, x, `${y}.png`);

      try {
        const data = await fs.readFile(tilePath);
        return pngResponse(data, 200);
      } catch {
        return pngResponse(PLACEHOLDER_PNG, 404);
      }
    } catch (err) {
      console.error('[gcs-tiles] handler error:', err);
      return pngResponse(PLACEHOLDER_PNG, 500);
    }
  });
}

function parseTileUrl(url: string): { z: string; x: string; y: string } | null {
  const u = new URL(url);

  const pathMatch = u.pathname.match(/^\/(\d+)\/(\d+)\/(\d+)\.png$/i);
  if (pathMatch) {
    return { z: pathMatch[1], x: pathMatch[2], y: pathMatch[3] };
  }

  if (u.hostname && /^\d+$/.test(u.hostname)) {
    const parts = u.pathname.replace(/^\//, '').split('/');
    if (parts.length >= 2) {
      return {
        z: u.hostname,
        x: parts[0],
        y: parts[1].replace(/\.png$/i, ''),
      };
    }
  }

  return null;
}

function pngResponse(body: Buffer, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/** Leaflet tile URL template for offline layer */
export const GCS_TILES_URL_TEMPLATE = `${SCHEME}://{z}/{x}/{y}.png`;
