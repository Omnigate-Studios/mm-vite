import { Chat } from '@/components/chat/Chat';
import { VRMViewer } from './components/vrm/vrm-viewer';
import { useKokoro } from './hooks/useKokoro';

export function App() {
  const { lipSync, ...rest } = useKokoro();

  return (
    <div className="bg-[radial-gradient(ellipse_at_bottom,color-mix(in_srgb,var(--card)_66%,background),color-mix(in_srgb,var(--card)_95%,background))]">
      <Chat kokoroProps={rest} />
      <VRMViewer lipSync={lipSync} />
    </div>
  );
}
