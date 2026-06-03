import type { DatalinkId, GcsCommandResult } from '../../shared/types/datalink';
import {
  normalizeMissionType,
  type GcsMissionPayload,
  type WaypointItem,
} from '../../shared/types/mission';
import {
  encodeMissionCount,
  encodeMissionItemInt,
  extractMavlinkPayload,
  MAV_MISSION_ACCEPTED,
  MSG_ID_MISSION_ACK,
  MSG_ID_MISSION_REQUEST,
  MSG_ID_MISSION_REQUEST_INT,
  parseMissionAck,
  parseMissionRequest,
  parseMissionRequestInt,
} from './mavlink-mission';
import {
  type CommandEgressContext,
  sendFrameOnActiveLink,
} from './command-egress';
import type { ForwardedMavlinkFrame, MavlinkRouter } from './mavlink-router';
import { handleMissionDownloadFrame, isMissionDownloadInProgress } from './mission-download';
import {
  acquireMissionLock,
  getMissionLockHolder,
  releaseMissionLock,
} from './mission-transaction-lock';

/** Per-step handshake timeout (ms) */
const HANDSHAKE_STEP_TIMEOUT_MS = 5000;

interface MissionUploadSession {
  payload: GcsMissionPayload;
  items: WaypointItem[];
  targetSystem: number;
  targetComponent: number;
  missionType: number;
  activeLinkId: DatalinkId;
  getContext: () => CommandEgressContext;
  resolve: (result: GcsCommandResult) => void;
  timeoutTimer: NodeJS.Timeout | null;
  bytesSent: number;
  itemsResponded: number;
}

let activeSession: MissionUploadSession | null = null;
let routerBound = false;

function missionFail(
  errorCode: NonNullable<GcsCommandResult['errorCode']>,
  error: string,
  partial?: Partial<GcsCommandResult>,
): GcsCommandResult {
  return { ok: false, command: 'mission_upload', errorCode, error, ...partial };
}

function finishSession(result: GcsCommandResult): void {
  if (!activeSession) return;
  if (activeSession.timeoutTimer) {
    clearTimeout(activeSession.timeoutTimer);
  }
  const { resolve } = activeSession;
  activeSession = null;
  releaseMissionLock('upload');
  resolve(result);
}

function armStepTimeout(session: MissionUploadSession, stage: string): void {
  if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
  session.timeoutTimer = setTimeout(() => {
    if (activeSession !== session) return;
    finishSession(
      missionFail(
        'SEND_FAILED',
        `MISSION_UPLOAD_TIMEOUT (${stage})`,
        { activeLinkId: session.activeLinkId },
      ),
    );
  }, HANDSHAKE_STEP_TIMEOUT_MS);
}

function matchesSessionVehicle(
  session: MissionUploadSession,
  sysid: number,
  compid: number,
): boolean {
  if (sysid !== session.targetSystem) return false;
  if (compid !== session.targetComponent) return false;
  return true;
}

function respondWithMissionItem(session: MissionUploadSession, seq: number): void {
  if (seq < 0 || seq >= session.items.length) {
    finishSession(
      missionFail(
        'ENCODE_FAILED',
        `Invalid MISSION_REQUEST seq ${seq} (count ${session.items.length})`,
        { activeLinkId: session.activeLinkId },
      ),
    );
    return;
  }

  const item = session.items[seq];
  const frame = encodeMissionItemInt({
    item,
    targetSystem: session.targetSystem,
    targetComponent: session.targetComponent,
    missionType: session.missionType,
    current: seq === 0 ? 1 : 0,
  });

  const sendResult = sendFrameOnActiveLink(
    session.getContext(),
    frame,
    'mission_upload',
  );

  if (!sendResult.ok) {
    finishSession(sendResult);
    return;
  }

  session.bytesSent += sendResult.bytesSent ?? frame.length;
  session.itemsResponded += 1;
  armStepTimeout(session, `MISSION_REQUEST seq=${seq + 1} or MISSION_ACK`);
}

function handleMissionAck(session: MissionUploadSession, ackType: number): void {
  if (ackType === MAV_MISSION_ACCEPTED) {
    finishSession({
      ok: true,
      command: 'mission_upload',
      activeLinkId: session.activeLinkId,
      bytesSent: session.bytesSent,
      missionItemCount: session.items.length,
    });
    return;
  }

  finishSession(
    missionFail(
      'SEND_FAILED',
      `MISSION_REJECTED_${ackType}`,
      { activeLinkId: session.activeLinkId },
    ),
  );
}

function handleRouterFrame(evt: ForwardedMavlinkFrame): void {
  handleMissionDownloadFrame(evt);

  const session = activeSession;
  if (!session) return;

  const { frame } = evt;
  const { sysid, compid, msgId } = frame.header;
  if (!matchesSessionVehicle(session, sysid, compid)) return;

  const payload = extractMavlinkPayload(frame.raw);
  if (!payload) return;

  switch (msgId) {
    case MSG_ID_MISSION_REQUEST: {
      const parsed = parseMissionRequest(payload);
      if (!parsed) return;
      if (parsed.missionType !== session.missionType) return;
      respondWithMissionItem(session, parsed.seq);
      break;
    }
    case MSG_ID_MISSION_REQUEST_INT: {
      const parsed = parseMissionRequestInt(payload);
      if (!parsed) return;
      if (parsed.missionType !== session.missionType) return;
      respondWithMissionItem(session, parsed.seq);
      break;
    }
    case MSG_ID_MISSION_ACK: {
      const ack = parseMissionAck(payload);
      if (!ack) return;
      if (ack.missionType !== session.missionType) return;
      handleMissionAck(session, ack.type);
      break;
    }
    default:
      break;
  }
}

/**
 * Subscribe once to deduplicated router frames for mission upload handshake.
 */
export function bindMissionUploadToRouter(router: MavlinkRouter): void {
  if (routerBound) return;
  router.on('frame', handleRouterFrame);
  routerBound = true;
}

/**
 * Full mission upload: MISSION_COUNT → MISSION_REQUEST* → MISSION_ITEM_INT* → MISSION_ACK.
 */
export function uploadMissionOnActiveLink(
  ctx: CommandEgressContext,
  payload: GcsMissionPayload,
): Promise<GcsCommandResult> {
  if (activeSession) {
    return Promise.resolve(
      missionFail('SEND_FAILED', 'Mission upload already in progress.'),
    );
  }

  if (isMissionDownloadInProgress() || getMissionLockHolder() === 'download') {
    return Promise.resolve(
      missionFail('SEND_FAILED', 'Mission download in progress — try again later.'),
    );
  }

  const items = payload.items ?? [];
  if (items.length === 0) {
    return Promise.resolve(
      missionFail('ENCODE_FAILED', 'Mission has no waypoints to upload.'),
    );
  }

  if (!acquireMissionLock('upload')) {
    return Promise.resolve(
      missionFail('SEND_FAILED', 'Another mission transaction is in progress.'),
    );
  }

  const targetSystem = payload.targetSystem ?? 1;
  const targetComponent = payload.targetComponent ?? 1;
  const missionType = normalizeMissionType(payload.missionType);

  const countFrame = encodeMissionCount({
    targetSystem,
    targetComponent,
    count: items.length,
    missionType,
  });

  return new Promise((resolve) => {
    const sendResult = sendFrameOnActiveLink(ctx, countFrame, 'mission_upload');
    if (!sendResult.ok) {
      releaseMissionLock('upload');
      resolve(sendResult);
      return;
    }

    if (!sendResult.activeLinkId) {
      releaseMissionLock('upload');
      resolve(missionFail('NO_ACTIVE_LINK', 'No active route after MISSION_COUNT send.'));
      return;
    }

    const session: MissionUploadSession = {
      payload,
      items,
      targetSystem,
      targetComponent,
      missionType,
      activeLinkId: sendResult.activeLinkId,
      getContext: () => ctx,
      resolve,
      timeoutTimer: null,
      bytesSent: sendResult.bytesSent ?? countFrame.length,
      itemsResponded: 0,
    };

    activeSession = session;
    armStepTimeout(session, 'MISSION_REQUEST after MISSION_COUNT');
  });
}

/** Abort in-flight upload (e.g. link teardown). */
export function abortMissionUpload(reason = 'Mission upload aborted.'): void {
  if (!activeSession) return;
  finishSession(
    missionFail('SEND_FAILED', reason, { activeLinkId: activeSession.activeLinkId }),
  );
}
