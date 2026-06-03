import type { GcsCommandType } from '@shared/types/datalink';

const LABELS: Record<GcsCommandType, { title: string; detail: string; confirm: string }> = {
  arm: {
    title: '시동 (ARM)',
    detail: '프로펠러가 회전할 수 있습니다. 주변 안전을 확인하세요.',
    confirm: 'ARM 전송',
  },
  disarm: {
    title: '시동 해제 (DISARM)',
    detail: '모터 출력이 차단됩니다.',
    confirm: 'DISARM 전송',
  },
  rtl: {
    title: '비상 RTL',
    detail: '기체가 홈 위치로 복귀합니다. 주변 장애물을 확인하세요.',
    confirm: 'RTL 전송',
  },
};

interface Props {
  command: GcsCommandType;
  activeRouteLabel: string | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CommandConfirmModal({
  command,
  activeRouteLabel,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const copy = LABELS[command];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmd-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-700">
        <h3 id="cmd-modal-title" className="text-lg font-bold text-white">
          명령 전송 확인
        </h3>
        <p className="mt-2 text-sm font-semibold text-amber-400">{copy.title}</p>
        <p className="mt-2 text-sm text-slate-300">{copy.detail}</p>
        <p className="mt-3 text-xs text-slate-500">
          활성 링크로만 전송됩니다:{' '}
          <span className="font-mono text-sky-400">{activeRouteLabel ?? '없음'}</span>
        </p>
        <p className="mt-4 text-center text-sm font-medium text-slate-200">
          정말 명령을 전송하시겠습니까?
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
            disabled={busy || !activeRouteLabel}
            onClick={onConfirm}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${
              command === 'rtl'
                ? 'bg-amber-600 hover:bg-amber-500 ring-1 ring-amber-400'
                : command === 'arm'
                  ? 'bg-red-600 hover:bg-red-500 ring-1 ring-red-400'
                  : 'bg-emerald-700 hover:bg-emerald-600 ring-1 ring-emerald-500'
            }`}
          >
            {busy ? '전송 중…' : copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
