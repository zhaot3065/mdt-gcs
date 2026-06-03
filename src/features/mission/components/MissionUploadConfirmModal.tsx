interface Props {
  waypointCount: number;
  activeRouteLabel: string | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MissionUploadConfirmModal({
  waypointCount,
  activeRouteLabel,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-upload-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-700">
        <h3 id="mission-upload-modal-title" className="text-lg font-bold text-white">
          미션 업로드 확인
        </h3>
        <p className="mt-2 text-sm font-semibold text-amber-400">
          총 {waypointCount}개의 웨이포인트 미션
        </p>
        <p className="mt-2 text-sm text-slate-300">
          드론으로 미션을 업로드합니다. MISSION_COUNT → MISSION_ITEM_INT → MISSION_ACK
          핸드셰이크가 활성 링크로 수행됩니다.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          활성 링크로만 전송됩니다:{' '}
          <span className="font-mono text-sky-400">{activeRouteLabel ?? '없음'}</span>
        </p>
        <p className="mt-4 text-center text-sm font-medium text-slate-200">
          총 {waypointCount}개의 웨이포인트 미션을 드론으로 업로드하시겠습니까?
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy || !activeRouteLabel || waypointCount === 0}
            onClick={onConfirm}
            className="flex-1 rounded-md bg-sky-600 px-4 py-2 text-sm font-bold text-white ring-1 ring-sky-400 hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? '업로드 중…' : '미션 업로드'}
          </button>
        </div>
      </div>
    </div>
  );
}
