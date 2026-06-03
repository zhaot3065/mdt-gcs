import { useEffect } from 'react';
import { DatalinkStatusBar } from '@/components/toolbar/DatalinkStatusBar';
import { EthernetConnectPanel } from '@/components/connection/EthernetConnectPanel';
import { useDatalinkStore } from '@/stores/datalink-store';

export default function App() {
  const subscribeIpc = useDatalinkStore((s) => s.subscribeIpc);

  useEffect(() => {
    const unsub = subscribeIpc();
    return unsub;
  }, [subscribeIpc]);

  return (
    <div className="app-shell">
      <DatalinkStatusBar />
      <main>
        <EthernetConnectPanel />
        <p className="placeholder">
          Map / HUD / mission planner modules plug in below the connection layer.
        </p>
      </main>
    </div>
  );
}
