import { useEffect } from 'react';
import { DatalinkStatusBar } from '@/components/toolbar/DatalinkStatusBar';
import { EthernetConnectPanel } from '@/components/connection/EthernetConnectPanel';
import { RouterStatusPanel } from '@/features/datalink/components/RouterStatusPanel';
import { useDatalinkFeatureStore } from '@/features/datalink/store/use-datalink-store';

export default function App() {
  const subscribeIpc = useDatalinkFeatureStore((s) => s.subscribeIpc);

  useEffect(() => {
    const unsub = subscribeIpc();
    return unsub;
  }, [subscribeIpc]);

  return (
    <div className="app-shell">
      <DatalinkStatusBar />
      <main>
        <EthernetConnectPanel />
        <RouterStatusPanel />
      </main>
    </div>
  );
}
