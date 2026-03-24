import { stripAsterisks } from '@/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

const worker = new Worker(
  new URL('../workers/kokoro.worker.ts', import.meta.url),
  { type: 'module' }
);

let isReady = false;
let onReadyCallback: (() => void) | null = null;
let onChunkCallback: ((wav: ArrayBuffer) => void) | null = null;

worker.onmessage = (e) => {
  const { type, wav } = e.data;
  if (type === 'ready') {
    isReady = true;
    onReadyCallback?.();
  }
  if (type === 'chunk') onChunkCallback?.(wav);
};

worker.onerror = (e) => console.error('Worker error:', e);
worker.postMessage({ type: 'init' });

export const useKokoro = (voice = 'af_nicole') => {
  const [ready, setReady] = useState(isReady);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeSentence, setActiveSentence] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const mutedRef = useRef(false);
  const audioQueue = useRef<string[]>([]);
  const sentenceQueue = useRef<{ text: string; messageId: string }[]>([]);
  const isPlaying = useRef(false);
  const playNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    playNextRef.current = () => {
      if (audioQueue.current.length === 0) {
        isPlaying.current = false;
        setSpeaking(false);
        setActiveSentence(null);
        setActiveMessageId(null);
        return;
      }
      isPlaying.current = true;
      setSpeaking(true);
      const url = audioQueue.current.shift()!;
      const entry = sentenceQueue.current.shift();
      setActiveSentence(entry?.text ?? null);
      setActiveMessageId(entry?.messageId ?? null);
      const el = new Audio(url);
      el.muted = mutedRef.current;
      el.onended = () => {
        URL.revokeObjectURL(url);
        playNextRef.current();
      };
      el.play();
    };

    onReadyCallback = () => setReady(true);
    onChunkCallback = (wav) => {
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      audioQueue.current.push(url);
      if (!isPlaying.current) playNextRef.current();
    };
  }, []);

  const enqueue = useCallback(
    (text: string, messageId: string) => {
      if (!ready) return;
      sentenceQueue.current.push({ text, messageId });
      worker.postMessage({
        type: 'generate',
        text: stripAsterisks(text),
        voice,
      });
    },
    [ready, voice]
  );

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };

  return {
    enqueue,
    ready,
    speaking,
    muted,
    toggleMute,
    activeSentence,
    activeMessageId,
  };
};
