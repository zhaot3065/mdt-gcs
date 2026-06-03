import type {
  DatalinkId,
  DatalinkSnapshot,
  GcsCommandRequest,
  GcsCommandResult,
} from '../../shared/types/datalink';
import { buildCommandFromGcsRequest } from './mavlink-command';
import type { MavlinkRouter } from './mavlink-router';

export interface EgressTransport {
  send(data: Buffer): void;
  isConnected(): boolean;
}

export interface CommandEgressContext {
  router: MavlinkRouter;
  getLinks: () => DatalinkSnapshot[];
  getTransport: (id: DatalinkId) => EgressTransport | undefined;
}

export function sendCommandOnActiveLink(
  ctx: CommandEgressContext,
  request: GcsCommandRequest,
): GcsCommandResult {
  const links = ctx.getLinks();
  const routerSnap = ctx.router.getSnapshot(links);
  const activeLinkId = routerSnap.activeLinkId;

  if (!activeLinkId) {
    return fail(request.command, 'NO_ACTIVE_LINK', 'No active route — connect a datalink and wait for telemetry.');
  }

  const link = links.find((l) => l.id === activeLinkId);
  if (!link || link.state !== 'connected') {
    return fail(
      request.command,
      'LINK_NOT_CONNECTED',
      `Active link "${activeLinkId}" is not connected.`,
    );
  }

  if (!link.health.isLive) {
    return fail(
      request.command,
      'LINK_NOT_LIVE',
      `Active link "${activeLinkId}" is stale — command blocked for safety.`,
    );
  }

  const transport = ctx.getTransport(activeLinkId);
  if (!transport?.isConnected()) {
    return fail(
      request.command,
      'LINK_NOT_CONNECTED',
      `Transport for "${activeLinkId}" is unavailable.`,
    );
  }

  const frame = buildCommandFromGcsRequest(request);
  if (!frame) {
    return fail(request.command, 'ENCODE_FAILED', 'Failed to encode MAVLink COMMAND_LONG.');
  }

  try {
    transport.send(frame);
    return {
      ok: true,
      command: request.command,
      activeLinkId,
      bytesSent: frame.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(request.command, 'SEND_FAILED', msg);
  }
}

function fail(
  command: GcsCommandRequest['command'],
  errorCode: NonNullable<GcsCommandResult['errorCode']>,
  error: string,
): GcsCommandResult {
  return { ok: false, command, errorCode, error };
}
