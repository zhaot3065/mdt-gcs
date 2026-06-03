import { useState } from 'react';
import { useDatalinkFeatureStore } from '@/features/datalink/store/use-datalink-store';
import { useMissionStore } from '../store/use-mission-store';
import { mavCommandLabel } from '../utils/command-label';
import { MissionUploadConfirmModal } from './MissionUploadConfirmModal';

const LINK_LABEL: Record<string, string> = {
  ethernet: 'SprintLink (Ethernet)',
  h16_rf: 'H16 RF',
};

export function MissionListPanel() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const isEditMode = useMissionStore((s) => s.isEditMode);
  const uploadBusy = useMissionStore((s) => s.uploadBusy);
  const lastUploadResult = useMissionStore((s) => s.lastUploadResult);
  const toggleEditMode = useMissionStore((s) => s.toggleEditMode);
  const updateWaypoint = useMissionStore((s) => s.updateWaypoint);
  const removeWaypoint = useMissionStore((s) => s.removeWaypoint);
  const clearWaypoints = useMissionStore((s) => s.clearWaypoints);
  const uploadMission = useMissionStore((s) => s.uploadMission);
  const activeLinkId = useDatalinkFeatureStore((s) => s.router.activeLinkId);

  const [confirmUpload, setConfirmUpload] = useState(false);

  const activeRouteLabel = activeLinkId ? LINK_LABEL[activeLinkId] ?? activeLinkId : null;
  const canUpload = waypoints.length > 0 && !uploadBusy && !!activeLinkId;

  const handleAltChange = (seq: number, raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return;
    updateWaypoint(seq, { alt: parsed });
  };

  const handleConfirmUpload = async () => {
    setConfirmUpload(false);
    await uploadMission();
  };

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
              {waypoints.length} waypoint{waypoints.length === 1 ? '' : 's'}
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

        {waypoints.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-700 bg-slate-900/50 px-3 py-4 text-center text-xs text-slate-500">
            Edit 모드를 켜고 지도를 클릭하여 웨이포인트를 추가하세요.
          </p>
        ) : (
          <div className="max-h-52 overflow-y-auto rounded-md border border-slate-700">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Seq</th>
                  <th className="px-2 py-1.5 font-semibold">Cmd</th>
                  <th className="px-2 py-1.5 font-semibold">Alt (m)</th>
                  <th className="px-2 py-1.5 font-semibold" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {waypoints.map((wp) => (
                  <tr
                    key={wp.seq}
                    className="border-t border-slate-800 hover:bg-slate-900/80"
                  >
                    <td className="px-2 py-1.5 font-mono font-semibold text-sky-300">
                      {wp.seq + 1}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-300">
                      {mavCommandLabel(wp.command)}
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={waypoints.length === 0 || uploadBusy}
            onClick={() => {
              if (window.confirm('모든 웨이포인트를 삭제하시겠습니까?')) clearWaypoints();
            }}
            className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear All
          </button>
          <button
            type="button"
            disabled={!canUpload}
            onClick={() => setConfirmUpload(true)}
            className="flex-1 rounded-md bg-sky-600 px-3 py-2 text-xs font-bold text-white ring-1 ring-sky-400 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Upload Mission
          </button>
        </div>

        {!activeLinkId && waypoints.length > 0 && (
          <p className="mt-2 text-[10px] text-amber-500/90">
            활성 datalink route가 없으면 업로드할 수 없습니다.
          </p>
        )}

        {lastUploadResult && (
          <p
            className={`mt-2 text-xs font-mono ${
              lastUploadResult.ok ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {lastUploadResult.ok
              ? `OK · ${lastUploadResult.activeLinkId} · MISSION_COUNT (${lastUploadResult.missionItemCount} wp) · ${lastUploadResult.bytesSent} B`
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
