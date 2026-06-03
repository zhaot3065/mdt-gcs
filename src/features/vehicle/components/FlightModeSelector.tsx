import { useMemo, useState } from 'react';
import type { GcsCommandRequest } from '@shared/types/datalink';
import { useDatalinkFeatureStore } from '@/features/datalink/store/use-datalink-store';
import { useVehicleStore } from '../store/use-vehicle-store';
import { flightModesForVehicle } from '../constants/flight-modes';
import { CommandConfirmModal } from './CommandConfirmModal';

const LINK_LABEL: Record<string, string> = {
  ethernet: 'SprintLink (Ethernet)',
  h16_rf: 'H16 RF',
};

const SELECT_PLACEHOLDER = '';

export function FlightModeSelector() {
  const connected = useVehicleStore((s) => s.vehicle.connected);
  const commandBusy = useVehicleStore((s) => s.commandBusy);
  const sendCommand = useVehicleStore((s) => s.sendCommand);
  const heartbeat = useVehicleStore((s) => s.vehicle.heartbeat);
  const activeLinkId = useDatalinkFeatureStore((s) => s.router.activeLinkId);

  const [pending, setPending] = useState<{
    request: GcsCommandRequest;
    modeLabel: string;
  } | null>(null);

  const modes = useMemo(
    () => flightModesForVehicle(heartbeat.vehicleType),
    [heartbeat.vehicleType],
  );

  const currentCustom = heartbeat.customMode;
  const selectValue = pending
    ? String(pending.request.customMode)
    : currentCustom !== undefined
      ? String(currentCustom)
      : SELECT_PLACEHOLDER;

  const activeRouteLabel = activeLinkId ? LINK_LABEL[activeLinkId] ?? activeLinkId : null;
  const disabled = !connected || commandBusy;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    if (raw === SELECT_PLACEHOLDER || raw === String(currentCustom)) {
      return;
    }
    const customMode = Number(raw);
    const option = modes.find((m) => m.customMode === customMode);
    if (!option) return;

    setPending({
      request: { command: 'set_mode', customMode },
      modeLabel: option.label,
    });
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const req = pending.request;
    setPending(null);
    await sendCommand(req);
  };

  const grouped = useMemo(() => {
    const order = ['multicopter', 'vtol_quad', 'vtol_plane'] as const;
    const labels = {
      multicopter: 'Multicopter / common',
      vtol_quad: 'VTOL — Quad',
      vtol_plane: 'VTOL — Fixed-wing',
    };
    return order
      .map((g) => ({
        group: g,
        label: labels[g],
        items: modes.filter((m) => m.group === g),
      }))
      .filter((x) => x.items.length > 0);
  }, [modes]);

  return (
    <>
      <div className="rounded-md bg-slate-800/80 p-2 ring-1 ring-slate-700">
        <label htmlFor="flight-mode-select" className="text-xs text-slate-500">
          Flight mode
        </label>
        <p className="mb-1 font-mono text-sm text-slate-400">
          Current:{' '}
          <span className="font-semibold text-white">{heartbeat.flightMode}</span>
          <span className="ml-1 text-slate-500">(cmode {currentCustom})</span>
        </p>
        <select
          id="flight-mode-select"
          value={selectValue}
          disabled={disabled}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm font-mono font-semibold text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value={SELECT_PLACEHOLDER} disabled>
            Change mode…
          </option>
          {grouped.map((section) => (
            <optgroup key={section.group} label={section.label}>
              {section.items.map((m) => (
                <option key={`${section.group}-${m.customMode}`} value={m.customMode}>
                  {m.label} ({m.customMode})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-slate-500">
          선택 시 확인 모달 후 활성 링크로 전송
        </p>
      </div>

      {pending && (
        <CommandConfirmModal
          command="set_mode"
          displayName={pending.modeLabel}
          activeRouteLabel={activeRouteLabel}
          busy={commandBusy}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
