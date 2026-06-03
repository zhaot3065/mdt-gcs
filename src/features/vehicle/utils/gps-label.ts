/** Human-readable GPS_FIX_TYPE for operator UI */
export function gpsFixTypeLabel(fixType: number): string {
  switch (fixType) {
    case 3:
      return '3D Fix';
    case 4:
      return 'DGPS';
    case 5:
      return 'RTK Float';
    case 6:
      return 'RTK Fixed';
    case 2:
      return '2D Fix';
    case 0:
    case 1:
      return 'No Fix';
    default:
      return 'Bad GPS';
  }
}

/** Tailwind text color class for HDOP quality indicator */
export function hdopQualityClass(hdop: number | null): string {
  if (hdop == null || !Number.isFinite(hdop)) return 'text-slate-400';
  if (hdop <= 1.0) return 'text-emerald-400';
  if (hdop >= 2.0) return 'text-orange-400';
  return 'text-amber-300';
}

export function formatHdop(hdop: number | null): string {
  if (hdop == null || !Number.isFinite(hdop)) return '—';
  return hdop.toFixed(1);
}
