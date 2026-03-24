import { stripAsterisks } from '@/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

const worker = new Worker(
  new URL('../workers/kokoro.worker.ts', import.meta.url),
  { type: 'module' }
);

let isReady = false;
let onReadyCallback: (() => void) | null = null;
let onChunkCallback:
  | ((
      wav: ArrayBuffer,
      sentence: string,
      messageId: string,
      startIndex: number
    ) => void)
  | null = null;

worker.onmessage = (e) => {
  const { type, wav, sentence, messageId, startIndex } = e.data;
  if (type === 'ready') {
    isReady = true;
    onReadyCallback?.();
  }
  if (type === 'chunk') onChunkCallback?.(wav, sentence, messageId, startIndex);
};

worker.onerror = (e) => console.error('Worker error:', e);
worker.postMessage({ type: 'init' });

export const useKokoro = (voice = 'af_heart') => {
  const [ready, setReady] = useState(isReady);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeSentence, setActiveSentence] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [activeStartIndex, setActiveStartIndex] = useState<number>(-1);
  const mutedRef = useRef(false);
  const audioQueue = useRef<
    { url: string; sentence: string; messageId: string; startIndex: number }[]
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
        setActiveStartIndex(-1);
        return;
      }
      isPlaying.current = true;
      setSpeaking(true);
      const { url, sentence, messageId, startIndex } =
        audioQueue.current.shift()!;
      setActiveSentence(sentence);
      setActiveMessageId(messageId);
      setActiveStartIndex(startIndex);
      const el = new Audio(url);
      el.muted = mutedRef.current;
      el.onended = () => {
        URL.revokeObjectURL(url);
        playNextRef.current();
      };
      el.play();
    };

    onReadyCallback = () => setReady(true);
    onChunkCallback = (wav, sentence, messageId, startIndex) => {
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      audioQueue.current.push({ url, sentence, messageId, startIndex });
      if (!isPlaying.current) playNextRef.current();
    };
  }, []);

  const enqueue = useCallback(
    (text: string, messageId: string, startIndex: number) => {
      if (!ready) return;
      const cleaned = stripAsterisks(text);
      if (!cleaned.trim()) {
        const actionText = text.replace(/\*([^*]*)\*/g, '$1').trim();
        if (actionText) {
          worker.postMessage({
            type: 'generate',
            text: actionText,
            rawText: text,
            voice: 'bm_lewis',
            messageId,
            startIndex,
          });
        }
        return;
      }
      worker.postMessage({
        type: 'generate',
        text: cleaned,
        rawText: text,
        voice,
        messageId,
        startIndex,
      });
    },
    [ready, voice]
  );

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };

  const speakAs = useCallback(
    (text: string, voice: string) => {
      if (!ready) return;
      const cleaned = stripAsterisks(text);
      if (!cleaned.trim()) return;
      worker.postMessage({
        type: 'generate',
        text: cleaned,
        rawText: text,
        voice,
        messageId: '__user__',
        startIndex: -1,
      });
    },
    [ready]
  );

  return {
    enqueue,
    speakAs,
    ready,
    speaking,
    muted,
    toggleMute,
    activeSentence,
    activeMessageId,
    activeStartIndex,
  };
};
