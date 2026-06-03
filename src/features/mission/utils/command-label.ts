import { MAV_CMD } from '@shared/types/mission';

export function mavCommandLabel(command: number): string {
  switch (command) {
    case MAV_CMD.NAV_WAYPOINT:
      return 'WAYPOINT';
    case MAV_CMD.NAV_TAKEOFF:
      return 'TAKEOFF';
    case MAV_CMD.NAV_LAND:
      return 'LAND';
    case MAV_CMD.NAV_RETURN_TO_LAUNCH:
      return 'RTL';
    default:
      return `CMD ${command}`;
  }
}
