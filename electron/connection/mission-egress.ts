import type { GcsCommandResult } from '../../shared/types/datalink';
import type { GcsMissionPayload } from '../../shared/types/mission';
import { encodeMissionCount } from './mavlink-mission';
import {
  type CommandEgressContext,
  sendFrameOnActiveLink,
} from './command-egress';

/**
 * Mission upload stub: active-link guard + MISSION_COUNT (#44) only.
 * MISSION_ITEM_INT request/response loop — next phase.
 */
export function uploadMissionOnActiveLink(
  ctx: CommandEgressContext,
  payload: GcsMissionPayload,
): GcsCommandResult {
  const items = payload.items ?? [];
  if (items.length === 0) {
    return {
      ok: false,
      command: 'mission_upload',
      errorCode: 'ENCODE_FAILED',
      error: 'Mission has no waypoints to upload.',
    };
  }

  const targetSystem = payload.targetSystem ?? 1;
  const targetComponent = payload.targetComponent ?? 1;

  const frame = encodeMissionCount({
    targetSystem,
    targetComponent,
    count: items.length,
    missionType: payload.missionType,
  });

  return sendFrameOnActiveLink(ctx, frame, 'mission_upload', {
    missionItemCount: items.length,
  });
}
