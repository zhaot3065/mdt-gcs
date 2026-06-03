import { useEffect } from 'react';
import { DatalinkStatusBar } from '@/components/toolbar/DatalinkStatusBar';
import { EthernetConnectPanel } from '@/components/connection/EthernetConnectPanel';
import { RouterStatusPanel } from '@/features/datalink/components/RouterStatusPanel';
import { VehicleMonitorPanel } from '@/features/vehicle/components/VehicleMonitorPanel';
import { useDatalinkFeatureStore } from '@/features/datalink/store/use-datalink-store';
import { useVehicleStore } from '@/features/vehicle/store/use-vehicle-store';

export default function App() {
  const subscribeDatalink = useDatalinkFeatureStore((s) => s.subscribeIpc);
  const subscribeVehicle = useVehicleStore((s) => s.subscribeIpc);

  useEffect(() => {
    const unsubDatalink = subscribeDatalink();
    const unsubVehicle = subscribeVehicle();
    return () => {
      unsubDatalink();
      unsubVehicle();
    };
  }, [subscribeDatalink, subscribeVehicle]);

  return (
    <div className="app-shell">
      <DatalinkStatusBar />
      <main className="flex flex-wrap gap-0">
        <div className="min-w-0 flex-1">
          <EthernetConnectPanel />
          <RouterStatusPanel />
        </div>
        <VehicleMonitorPanel />
      </main>
    </div>
  );
}
