/** Ensures only one mission upload or download handshake runs at a time. */
export type MissionTransactionKind = 'upload' | 'download';

let holder: MissionTransactionKind | null = null;

export function acquireMissionLock(kind: MissionTransactionKind): boolean {
  if (holder !== null) return false;
  holder = kind;
  return true;
}

export function releaseMissionLock(kind: MissionTransactionKind): void {
  if (holder === kind) holder = null;
}

export function getMissionLockHolder(): MissionTransactionKind | null {
  return holder;
}
