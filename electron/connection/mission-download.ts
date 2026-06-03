import type { DatalinkId } from '../../shared/types/datalink';
import {
  reindexWaypointItems,
  type GcsMissionDownloadPayload,
  type GcsMissionDownloadResult,
  type WaypointItem,
} from '../../shared/types/mission';
import {
  type CommandEgressContext,
  sendFrameOnActiveLink,
} from './command-egress';
import {
  encodeMissionAck,
  encodeMissionRequestInt,
  encodeMissionRequestList,
  extractMavlinkPayload,
  MAV_MISSION_ACCEPTED,
  MSG_ID_MISSION_COUNT,
  MSG_ID_MISSION_ITEM_INT,
  parseMissionCount,
  parseMissionItemInt,
} from './mavlink-mission';
import type { ForwardedMavlinkFrame } from './mavlink-router';
import {
  acquireMissionLock,
  getMissionLockHolder,
  releaseMissionLock,
} from './mission-transaction-lock';

const HANDSHAKE_STEP_TIMEOUT_MS = 5000;

interface MissionDownloadSession {
  targetSystem: number;
  targetComponent: number;
  missionType: number;
  activeLinkId: DatalinkId;
  getContext: () => CommandEgressContext;
  resolve: (result: GcsMissionDownloadResult) => void;
  timeoutTimer: NodeJS.Timeout | null;
  totalCount: number | null;
  nextRequestSeq: number;
  receivedItems: WaypointItem[];
}

let activeSession: MissionDownloadSession | null = null;

function downloadFail(error: string): GcsMissionDownloadResult {
  return { ok: false, error };
}

function finishSession(result: GcsMissionDownloadResult): void {
  if (!activeSession) return;
  if (activeSession.timeoutTimer) {
    clearTimeout(activeSession.timeoutTimer);
  }
  const { resolve } = activeSession;
  activeSession = null;
  releaseMissionLock('download');
  resolve(result);
}

function armStepTimeout(session: MissionDownloadSession, stage: string): void {
  if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
  session.timeoutTimer = setTimeout(() => {
    if (activeSession !== session) return;
    finishSession(downloadFail(`MISSION_DOWNLOAD_TIMEOUT (${stage})`));
  }, HANDSHAKE_STEP_TIMEOUT_MS);
}

function matchesSessionVehicle(
  session: MissionDownloadSession,
  sysid: number,
  compid: number,
): boolean {
  return sysid === session.targetSystem && compid === session.targetComponent;
}

function sendMissionAck(session: MissionDownloadSession): GcsMissionDownloadResult | null {
  const frame = encodeMissionAck({
    targetSystem: session.targetSystem,
    targetComponent: session.targetComponent,
    type: MAV_MISSION_ACCEPTED,
    missionType: session.missionType,
  });
  const sendResult = sendFrameOnActiveLink(
    session.getContext(),
    frame,
    'mission_download',
  );
  if (!sendResult.ok) {
    return downloadFail(sendResult.error ?? 'Failed to send MISSION_ACK.');
  }
  return null;
}

function completeDownload(session: MissionDownloadSession): void {
  const ackError = sendMissionAck(session);
  if (ackError) {
    finishSession(ackError);
    return;
  }
  finishSession({
    ok: true,
    waypoints: reindexWaypointItems(session.receivedItems),
  });
}

function requestMissionItem(session: MissionDownloadSession, seq: number): void {
  if (session.totalCount != null && seq >= session.totalCount) {
    completeDownload(session);
    return;
  }

  const frame = encodeMissionRequestInt({
    targetSystem: session.targetSystem,
    targetComponent: session.targetComponent,
    seq,
    missionType: session.missionType,
  });

  const sendResult = sendFrameOnActiveLink(
    session.getContext(),
    frame,
    'mission_download',
  );

  if (!sendResult.ok) {
    finishSession(downloadFail(sendResult.error ?? `MISSION_REQUEST_INT seq=${seq} failed.`));
    return;
  }

  session.nextRequestSeq = seq;
  armStepTimeout(session, `MISSION_ITEM_INT seq=${seq}`);
}

function handleMissionCount(session: MissionDownloadSession, count: number): void {
  session.totalCount = count;

  if (count === 0) {
    completeDownload(session);
    return;
  }

  requestMissionItem(session, 0);
}

function handleMissionItemInt(session: MissionDownloadSession, item: WaypointItem): void {
  if (session.totalCount == null) {
    finishSession(downloadFail('Received MISSION_ITEM_INT before MISSION_COUNT.'));
    return;
  }

  if (item.seq !== session.nextRequestSeq) {
    finishSession(
      downloadFail(
        `Unexpected MISSION_ITEM_INT seq ${item.seq} (expected ${session.nextRequestSeq}).`,
      ),
    );
    return;
  }

  session.receivedItems.push(item);

  if (session.receivedItems.length >= session.totalCount) {
    completeDownload(session);
    return;
  }

  requestMissionItem(session, item.seq + 1);
}

export function handleMissionDownloadFrame({ frame }: ForwardedMavlinkFrame): void {
  const session = activeSession;
  if (!session) return;

  const { sysid, compid, msgId } = frame.header;
  if (!matchesSessionVehicle(session, sysid, compid)) return;

  const payload = extractMavlinkPayload(frame.raw);
  if (!payload) return;

  switch (msgId) {
    case MSG_ID_MISSION_COUNT: {
      const parsed = parseMissionCount(payload);
      if (!parsed) return;
      handleMissionCount(session, parsed.count);
      break;
    }
    case MSG_ID_MISSION_ITEM_INT: {
      const item = parseMissionItemInt(payload);
      if (!item) return;
      handleMissionItemInt(session, item);
      break;
    }
    default:
      break;
  }
}

export function isMissionDownloadInProgress(): boolean {
  return activeSession !== null;
}

/**
 * Mission download: MISSION_REQUEST_LIST → MISSION_COUNT → MISSION_REQUEST_INT* → MISSION_ITEM_INT* → MISSION_ACK.
 */
export function downloadMissionOnActiveLink(
  ctx: CommandEgressContext,
  payload: GcsMissionDownloadPayload = {},
): Promise<GcsMissionDownloadResult> {
  if (activeSession) {
    return Promise.resolve(downloadFail('Mission download already in progress.'));
  }

  const holder = getMissionLockHolder();
  if (holder === 'upload') {
    return Promise.resolve(downloadFail('Mission upload in progress — try again later.'));
  }

  if (!acquireMissionLock('download')) {
    return Promise.resolve(downloadFail('Another mission transaction is in progress.'));
  }

  const targetSystem = payload.targetSystem ?? 1;
  const targetComponent = payload.targetComponent ?? 1;
  const missionType = payload.missionType ?? 0;

  const listFrame = encodeMissionRequestList({
    targetSystem,
    targetComponent,
    missionType,
  });

  return new Promise((resolve) => {
    const sendResult = sendFrameOnActiveLink(ctx, listFrame, 'mission_download');
    if (!sendResult.ok) {
      releaseMissionLock('download');
      resolve(downloadFail(sendResult.error ?? 'Failed to send MISSION_REQUEST_LIST.'));
      return;
    }

    if (!sendResult.activeLinkId) {
      releaseMissionLock('download');
      resolve(downloadFail('No active route after MISSION_REQUEST_LIST send.'));
      return;
    }

    const session: MissionDownloadSession = {
      targetSystem,
      targetComponent,
      missionType,
      activeLinkId: sendResult.activeLinkId,
      getContext: () => ctx,
      resolve,
      timeoutTimer: null,
      totalCount: null,
      nextRequestSeq: 0,
      receivedItems: [],
    };

    activeSession = session;
    armStepTimeout(session, 'MISSION_COUNT after MISSION_REQUEST_LIST');
  });
}

export function abortMissionDownload(reason = 'Mission download aborted.'): void {
  if (!activeSession) return;
  finishSession(downloadFail(reason));
}
