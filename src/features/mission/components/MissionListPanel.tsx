import { useRef, useState } from 'react';
import { useDatalinkFeatureStore } from '@/features/datalink/store/use-datalink-store';
import { useVehicleStore } from '@/features/vehicle/store/use-vehicle-store';
import { MISSION_CMD_OPTIONS, MISSION_DATA_TYPE_LABELS, MISSION_DATA_TYPE_TABS } from '@shared/types/mission';
import { selectActiveWaypoints, useMissionStore } from '../store/use-mission-store';
import { downloadMissionJson, readMissionJsonFile } from '../utils/mission-file-io';
import { MissionUploadConfirmModal } from './MissionUploadConfirmModal';

const LINK_LABEL: Record<string, string> = {
  ethernet: 'SprintLink (Ethernet)',
  h16_rf: 'H16 RF',
};

export function MissionListPanel() {
  const waypoints = useMissionStore(selectActiveWaypoints);
  const currentMissionType = useMissionStore((s) => s.currentMissionType);
  const setCurrentMissionType = useMissionStore((s) => s.setCurrentMissionType);
  const isEditMode = useMissionStore((s) => s.isEditMode);
  const uploadBusy = useMissionStore((s) => s.uploadBusy);
  const downloadBusy = useMissionStore((s) => s.downloadBusy);
  const lastUploadResult = useMissionStore((s) => s.lastUploadResult);
  const lastDownloadResult = useMissionStore((s) => s.lastDownloadResult);
  const toggleEditMode = useMissionStore((s) => s.toggleEditMode);
  const updateWaypoint = useMissionStore((s) => s.updateWaypoint);
  const removeWaypoint = useMissionStore((s) => s.removeWaypoint);
  const reorderWaypoint = useMissionStore((s) => s.reorderWaypoint);
  const setWaypointCommand = useMissionStore((s) => s.setWaypointCommand);
  const clearWaypoints = useMissionStore((s) => s.clearWaypoints);
  const importWaypoints = useMissionStore((s) => s.importWaypoints);
  const uploadMission = useMissionStore((s) => s.uploadMission);
  const downloadMission = useMissionStore((s) => s.downloadMission);
  const activeLinkId = useDatalinkFeatureStore((s) => s.router.activeLinkId);
  const vehicleConnected = useVehicleStore((s) => s.vehicle.connected);
  const homeLat = useVehicleStore((s) => s.vehicle.position.lat);
  const homeLon = useVehicleStore((s) => s.vehicle.position.lon);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmUpload, setConfirmUpload] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const activeRouteLabel = activeLinkId ? LINK_LABEL[activeLinkId] ?? activeLinkId : null;
  const canUpload = waypoints.length > 0 && !uploadBusy && !downloadBusy && !!activeLinkId;
  const canDownload = !uploadBusy && !downloadBusy && !!activeLinkId && vehicleConnected;

  const handleAltChange = (seq: number, raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return;
    updateWaypoint(seq, { alt: parsed });
  };

  const handleConfirmUpload = async () => {
    setConfirmUpload(false);
    await uploadMission({ missionType: currentMissionType });
  };

  const handleDownloadMission = async () => {
    const typeLabel = MISSION_DATA_TYPE_LABELS[currentMissionType];
    if (
      waypoints.length > 0 &&
      !window.confirm(
        `기체 ${typeLabel} 데이터를 다운로드하면 현재 편집 중인 항목이 덮어씌워집니다. 계속하시겠습니까?`,
      )
    ) {
      return;
    }
    await downloadMission({ missionType: currentMissionType });
  };

  const handleSaveMission = () => {
    if (waypoints.length === 0) return;
    downloadMissionJson(waypoints);
  };

  const handleLoadClick = () => {
    setFileError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const items = await readMissionJsonFile(file);
      importWaypoints(items);
      setFileError(null);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to load mission file');
    }
  };

  const homeLabel =
    vehicleConnected && homeLat != null && homeLon != null
      ? `${homeLat.toFixed(6)}, ${homeLon.toFixed(6)}`
      : 'Set HOME on autopilot · telemetry pending';

  const typeLabel = MISSION_DATA_TYPE_LABELS[currentMissionType];
  const pointLabel =
    currentMissionType === 0 ? 'waypoint' : currentMissionType === 1 ? 'fence point' : 'rally point';

  return (
    <>
      <section
        className="border-b border-slate-700 bg-slate-950/40 p-3"
        aria-label="Mission planner"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400">
              Mission planner
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {typeLabel} · {waypoints.length} {pointLabel}
              {waypoints.length === 1 ? '' : 's'}
              {isEditMode ? ' · map click to add' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleEditMode}
            className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 transition-colors ${
              isEditMode
                ? 'bg-amber-600 text-white ring-amber-400'
                : 'bg-slate-800 text-slate-400 ring-slate-600 hover:bg-slate-700'
            }`}
          >
            {isEditMode ? 'Edit ON' : 'Edit OFF'}
          </button>
        </div>

        <div
          className="mb-3 flex rounded-lg border border-slate-700 bg-slate-900/80 p-0.5"
          role="tablist"
          aria-label="Mission data type"
        >
          {MISSION_DATA_TYPE_TABS.map((tab) => {
            const active = currentMissionType === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCurrentMissionType(tab.value)}
                className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  active
                    ? tab.value === 1
                      ? 'bg-red-950 text-red-200 ring-1 ring-red-500/50'
                      : tab.value === 2
                        ? 'bg-emerald-950 text-emerald-200 ring-1 ring-emerald-500/50'
                        : 'bg-sky-950 text-sky-200 ring-1 ring-sky-500/50'
                    : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            disabled={waypoints.length === 0}
            onClick={handleSaveMission}
            className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Mission
          </button>
          <button
            type="button"
            onClick={handleLoadClick}
            className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
          >
            Load Mission
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
        </div>

        {fileError && (
          <p className="mb-2 text-[10px] text-red-400" role="alert">
            {fileError}
          </p>
        )}

        <div className="max-h-56 overflow-y-auto rounded-md border border-slate-700">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-[1] bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-1 py-1.5 font-semibold" aria-label="Reorder" />
                <th className="px-2 py-1.5 font-semibold">Seq</th>
                <th className="px-2 py-1.5 font-semibold">Cmd</th>
                <th className="px-2 py-1.5 font-semibold">Alt (m)</th>
                <th className="px-2 py-1.5 font-semibold" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-emerald-900/50 bg-emerald-950/20">
                <td className="px-1 py-1.5 text-center text-slate-600">—</td>
                <td className="px-2 py-1.5 font-mono font-bold text-emerald-400">HOME</td>
                <td className="px-2 py-1.5 text-[10px] text-emerald-300/90" colSpan={3}>
                  ArduPilot home reference · {homeLabel}
                </td>
              </tr>

              {waypoints.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                    Edit ON → 지도 클릭으로 웨이포인트 추가
                  </td>
                </tr>
              ) : (
                waypoints.map((wp, index) => (
                  <tr
                    key={wp.seq}
                    className="border-t border-slate-800 hover:bg-slate-900/80"
                  >
                    <td className="px-1 py-1">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => reorderWaypoint(index, index - 1)}
                          className="rounded border border-slate-700 bg-slate-900 px-1 text-[10px] leading-none text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                          aria-label={`Move waypoint ${wp.seq + 1} up`}
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={index === waypoints.length - 1}
                          onClick={() => reorderWaypoint(index, index + 1)}
                          className="rounded border border-slate-700 bg-slate-900 px-1 text-[10px] leading-none text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                          aria-label={`Move waypoint ${wp.seq + 1} down`}
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 font-mono font-semibold text-sky-300">
                      {wp.seq + 1}
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={wp.command}
                        onChange={(e) =>
                          setWaypointCommand(wp.seq, Number.parseInt(e.target.value, 10))
                        }
                        className="w-full max-w-[7rem] rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-[10px] font-semibold text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        aria-label={`Command for waypoint ${wp.seq + 1}`}
                      >
                        {MISSION_CMD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={wp.alt}
                        onChange={(e) => handleAltChange(wp.seq, e.target.value)}
                        className="w-16 rounded border border-slate-600 bg-slate-950 px-1.5 py-0.5 font-mono text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        aria-label={`Altitude for waypoint ${wp.seq + 1}`}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeWaypoint(wp.seq)}
                        className="rounded border border-red-900/60 bg-red-950/40 px-2 py-0.5 text-[10px] font-semibold text-red-400 hover:bg-red-900/40"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={waypoints.length === 0 || uploadBusy || downloadBusy}
            onClick={() => {
              if (window.confirm('모든 웨이포인트를 삭제하시겠습니까?')) clearWaypoints();
            }}
            className="flex-1 min-w-[7rem] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear All
          </button>
          <button
            type="button"
            disabled={!canDownload}
            onClick={() => void handleDownloadMission()}
            className="flex-1 min-w-[7rem] rounded-md border border-violet-500/60 bg-violet-950 px-3 py-2 text-xs font-bold text-violet-100 ring-1 ring-violet-500/40 hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {downloadBusy ? 'Downloading…' : 'Download Mission'}
          </button>
          <button
            type="button"
            disabled={!canUpload}
            onClick={() => setConfirmUpload(true)}
            className="flex-1 min-w-[7rem] rounded-md bg-sky-600 px-3 py-2 text-xs font-bold text-white ring-1 ring-sky-400 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Upload Mission
          </button>
        </div>

        {!activeLinkId && (waypoints.length > 0 || downloadBusy) && (
          <p className="mt-2 text-[10px] text-amber-500/90">
            활성 datalink route가 없으면 미션 송수신을 할 수 없습니다.
          </p>
        )}

        {!vehicleConnected && activeLinkId && (
          <p className="mt-2 text-[10px] text-amber-500/90">
            기체 HEARTBEAT 수신 후 다운로드할 수 있습니다.
          </p>
        )}

        {lastDownloadResult && (
          <p
            className={`mt-2 text-xs font-mono ${
              lastDownloadResult.ok ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {lastDownloadResult.ok
              ? `DOWNLOAD OK · ${typeLabel} · ${lastDownloadResult.waypoints?.length ?? 0} items`
              : `DOWNLOAD FAIL · ${lastDownloadResult.error}`}
          </p>
        )}

        {lastUploadResult && (
          <p
            className={`mt-2 text-xs font-mono ${
              lastUploadResult.ok ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {lastUploadResult.ok
              ? `OK · ${lastUploadResult.activeLinkId} · ${lastUploadResult.missionItemCount} wp · ${lastUploadResult.bytesSent} B`
              : `FAIL · ${lastUploadResult.errorCode}: ${lastUploadResult.error}`}
          </p>
        )}
      </section>

      {confirmUpload && (
        <MissionUploadConfirmModal
          waypointCount={waypoints.length}
          activeRouteLabel={activeRouteLabel}
          busy={uploadBusy}
          onConfirm={() => void handleConfirmUpload()}
          onCancel={() => setConfirmUpload(false)}
        />
      )}
    </>
  );
}
