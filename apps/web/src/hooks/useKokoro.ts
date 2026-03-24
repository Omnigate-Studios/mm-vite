import { stripAsterisks } from '@/utils';
import { useEffect, useState } from 'react';

const worker = new Worker(
  new URL('../workers/kokoro.worker.ts', import.meta.url),
  { type: 'module' }
);

let onReadyCallback: (() => void) | null = null;
let onDoneCallback: ((wav: ArrayBuffer) => void) | null = null;

worker.onmessage = (e) => {
  const { type, wav } = e.data;
  if (type === 'ready') onReadyCallback?.();
  if (type === 'done') onDoneCallback?.(wav);
};

worker.onerror = (e) => console.error('Worker error:', e);

worker.postMessage({ type: 'init' });

export const useKokoro = (voice = 'af_nicole') => {
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    onReadyCallback = () => setReady(true);
    onDoneCallback = (wav) => {
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const el = new Audio(url);
      el.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      el.play();
    };
  }, []);

  const speak = (text: string) => {
    if (!ready || speaking) return;
    setSpeaking(true);
    const processedText = stripAsterisks(text);
    worker.postMessage({ type: 'generate', text: processedText, voice });
  };

  return { speak, ready, speaking };
};
