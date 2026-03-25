import { Chat } from '@/components/chat/Chat';
import { VRMViewer } from './components/vrm/vrm-viewer';
import { useKokoro } from './hooks/useKokoro';

export function App() {
  const { lipSync } = useKokoro();

  return (
    <>
      <Chat />
      <VRMViewer lipSync={lipSync} />
    </>
  );
}
