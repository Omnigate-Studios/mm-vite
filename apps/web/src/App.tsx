import { Chat } from '@/components/chat/Chat';
import { VRMViewer } from './components/vrm/vrm-viewer';
import { useKokoro } from './hooks/useKokoro';

export function App() {
  const { lipSync, ...rest } = useKokoro();

  return (
    <>
      <Chat kokoroProps={rest} />
      <VRMViewer lipSync={lipSync} />
    </>
  );
}
