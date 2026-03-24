import { stripAsterisks } from '@/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

const worker = new Worker(
  new URL('../workers/kokoro.worker.ts', import.meta.url),
  { type: 'module' }
);

let isReady = false;
let onReadyCallback: (() => void) | null = null;
let onChunkCallback:
  | ((wav: ArrayBuffer, sentence: string, messageId: string) => void)
  | null = null;

worker.onmessage = (e) => {
  const { type, wav, sentence, messageId } = e.data;
  if (type === 'ready') {
    isReady = true;
    onReadyCallback?.();
  }
  if (type === 'chunk') onChunkCallback?.(wav, sentence, messageId);
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
  const audioQueue = useRef<
    { url: string; sentence: string; messageId: string }[]
  >([]);
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
      const { url, sentence, messageId } = audioQueue.current.shift()!;
      setActiveSentence(sentence);
      setActiveMessageId(messageId);
      const el = new Audio(url);
      el.muted = mutedRef.current;
      el.onended = () => {
        URL.revokeObjectURL(url);
        playNextRef.current();
      };
      el.play();
    };

    onReadyCallback = () => setReady(true);
    onChunkCallback = (wav, sentence, messageId) => {
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      audioQueue.current.push({ url, sentence, messageId });
      if (!isPlaying.current) playNextRef.current();
    };
  }, []);

  const enqueue = useCallback(
    (text: string, messageId: string) => {
      if (!ready) return;
      worker.postMessage({
        type: 'generate',
        text: stripAsterisks(text),
        rawText: text,
        voice,
        messageId,
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
