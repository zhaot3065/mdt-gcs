import type { VehicleTypeCategory } from '@shared/types/vehicle';

interface Props {
  vehicleType: VehicleTypeCategory;
  headingDeg: number;
  isArmed: boolean;
}

/** Multicopter / VTOL SVG for Leaflet divIcon overlay */
export function VehicleIcon({ vehicleType, headingDeg, isArmed }: Props) {
  const isVtol = vehicleType === 'vtol';
  const stroke = isArmed ? '#ff6b6b' : '#3dff7a';

  return (
    <div
      className="vehicle-icon-root"
      style={{
        width: 44,
        height: 44,
        marginLeft: -22,
        marginTop: -22,
        transform: `rotate(${headingDeg}deg)`,
        transition: 'transform 0.15s ease-out',
      }}
    >
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden>
        {isVtol ? (
          <>
            <ellipse cx="22" cy="26" rx="14" ry="4" fill="none" stroke={stroke} strokeWidth="2" />
            <line x1="8" y1="26" x2="36" y2="26" stroke={stroke} strokeWidth="2" />
            <line x1="22" y1="8" x2="22" y2="22" stroke={stroke} strokeWidth="2" />
            <circle cx="22" cy="26" r="3" fill={stroke} />
            <line x1="8" y1="26" x2="4" y2="30" stroke={stroke} strokeWidth="1.5" />
            <line x1="36" y1="26" x2="40" y2="30" stroke={stroke} strokeWidth="1.5" />
          </>
        ) : (
          <>
            <line x1="22" y1="22" x2="8" y2="8" stroke={stroke} strokeWidth="2" />
            <line x1="22" y1="22" x2="36" y2="8" stroke={stroke} strokeWidth="2" />
            <line x1="22" y1="22" x2="8" y2="36" stroke={stroke} strokeWidth="2" />
            <line x1="22" y1="22" x2="36" y2="36" stroke={stroke} strokeWidth="2" />
            <circle cx="22" cy="22" r="5" fill="#0a0c10" stroke={stroke} strokeWidth="2" />
          </>
        )}
        <polygon points="22,4 19,12 25,12" fill={stroke} />
      </svg>
    </div>
  );
}
