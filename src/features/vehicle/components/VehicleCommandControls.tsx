import { useState } from 'react';
import type { GcsCommandType } from '@shared/types/datalink';
import { useDatalinkFeatureStore } from '@/features/datalink/store/use-datalink-store';
import { useVehicleStore } from '../store/use-vehicle-store';
import { CommandConfirmModal } from './CommandConfirmModal';

const LINK_LABEL: Record<string, string> = {
  ethernet: 'SprintLink (Ethernet)',
  h16_rf: 'H16 RF',
};

export function VehicleCommandControls() {
  const connected = useVehicleStore((s) => s.vehicle.connected);
  const isArmed = useVehicleStore((s) => s.vehicle.heartbeat.isArmed);
  const commandBusy = useVehicleStore((s) => s.commandBusy);
  const lastResult = useVehicleStore((s) => s.lastCommandResult);
  const sendCommand = useVehicleStore((s) => s.sendCommand);
  const activeLinkId = useDatalinkFeatureStore((s) => s.router.activeLinkId);

  const [pending, setPending] = useState<GcsCommandType | null>(null);

  const activeRouteLabel = activeLinkId ? LINK_LABEL[activeLinkId] ?? activeLinkId : null;
  const controlsDisabled = !connected || commandBusy;

  const openConfirm = (command: GcsCommandType) => {
    if (controlsDisabled) return;
    setPending(command);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const cmd = pending;
    setPending(null);
    await sendCommand({ command: cmd });
  };

  return (
    <>
      <div className="border-t border-slate-700 pt-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          Vehicle commands
        </p>
        <p className="mb-2 text-[10px] text-slate-500">
          Egress via active route only · 확인 모달 후 전송
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={controlsDisabled || isArmed}
            onClick={() => openConfirm('arm')}
            className="rounded-md bg-red-600/90 px-3 py-2 text-xs font-bold text-white ring-1 ring-red-500 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ARM
          </button>
          <button
            type="button"
            disabled={controlsDisabled || !isArmed}
            onClick={() => openConfirm('disarm')}
            className="rounded-md bg-emerald-700/90 px-3 py-2 text-xs font-bold text-white ring-1 ring-emerald-500 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            DISARM
          </button>
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => openConfirm('rtl')}
            className="col-span-2 rounded-md bg-amber-600/90 px-3 py-2 text-xs font-bold text-white ring-1 ring-amber-400 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            비상 RTL
          </button>
        </div>
        {lastResult && (
          <p
            className={`mt-2 text-xs font-mono ${
              lastResult.ok ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {lastResult.ok
              ? `OK · ${lastResult.activeLinkId} · ${lastResult.bytesSent} B`
              : `FAIL · ${lastResult.errorCode}: ${lastResult.error}`}
          </p>
        )}
      </div>

      {pending && (
        <CommandConfirmModal
          command={pending}
          activeRouteLabel={activeRouteLabel}
          busy={commandBusy}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
