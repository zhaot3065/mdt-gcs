import { useEffect } from 'react';
import { DatalinkStatusBar } from '@/components/toolbar/DatalinkStatusBar';
import { EthernetConnectPanel } from '@/components/connection/EthernetConnectPanel';
import { H16ConnectPanel } from '@/features/datalink/components/H16ConnectPanel';
import { RouterStatusPanel } from '@/features/datalink/components/RouterStatusPanel';
import { VehicleMonitorPanel } from '@/features/vehicle/components/VehicleMonitorPanel';
import { MapDisplay } from '@/features/map/components/MapDisplay';
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
    <div className="app-shell flex min-h-screen flex-col">
      <DatalinkStatusBar />
      <main className="flex min-h-0 flex-1 flex-col gap-0 p-2 lg:flex-row">
        <div className="flex min-h-[420px] min-w-0 flex-1 flex-col">
          <MapDisplay />
        </div>
        <aside className="flex w-full shrink-0 flex-col overflow-y-auto lg:w-[380px]">
          <VehicleMonitorPanel />
          <EthernetConnectPanel />
          <H16ConnectPanel />
          <RouterStatusPanel />
        </aside>
      </main>
    </div>
  );
}
