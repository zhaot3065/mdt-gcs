import type { WaypointItem } from '@shared/types/mission';
import { buildMissionFileDocument, parseMissionFileDocument } from '@shared/types/mission';

function missionFilenameDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function downloadMissionJson(waypoints: WaypointItem[]): void {
  const doc = buildMissionFileDocument(waypoints);
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mdt-mission-${missionFilenameDate()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function readMissionJsonFile(file: File): Promise<WaypointItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        if (typeof text !== 'string') {
          reject(new Error('Failed to read mission file'));
          return;
        }
        resolve(parseMissionFileDocument(JSON.parse(text) as unknown));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read mission file'));
    reader.readAsText(file);
  });
}
