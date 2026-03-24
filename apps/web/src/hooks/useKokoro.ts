import { stripAsterisks } from '@/utils';
import { useEffect, useRef, useState } from 'react';

const worker = new Worker(
  new URL('../workers/kokoro.worker.ts', import.meta.url),
  {
    type: 'module',
  }
);

export const useKokoro = (voice = 'af_nicole') => {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    worker.onmessage = (e) => {
      const { type, wav } = e.data;

      if (type === 'ready') {
        setReady(true);
      }

      if (type === 'done') {
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const el = new Audio(url);
        el.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
        };
        el.play();
      }
    };

    workerRef.current = worker;
    worker.postMessage({ type: 'init' });
  }, []);

  const speak = (text: string) => {
    if (!workerRef.current || !ready || speaking) return;
    setSpeaking(true);
    const processedText = stripAsterisks(text);
    workerRef.current.postMessage({
      type: 'generate',
      text: processedText,
      voice,
    });
  };

  return { speak, ready, speaking };
};
