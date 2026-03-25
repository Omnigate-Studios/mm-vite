import { stripAsterisks } from '@/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Lipsync } from 'wawa-lipsync';

export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export const useKokoro = (voice = 'af_heart') => {
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeSentence, setActiveSentence] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [activeStartIndex, setActiveStartIndex] = useState<number>(-1);
  const mutedRef = useRef(false);
  const audioQueue = useRef<
    {
      buffer: AudioBuffer;
      blobUrl: string;
      sentence: string;
      messageId: string;
      startIndex: number;
      useLipSync: boolean;
    }[]
  >([]);
  const isPlaying = useRef(false);
  const playNextRef = useRef<() => void>(() => {});
  const audioCtx = useRef<AudioContext | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const lipSync = useRef<Lipsync | null>(null);
  const fetchQueue = useRef<Promise<void>>(Promise.resolve());

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
      const { buffer, blobUrl, useLipSync } = audioQueue.current.shift()!;

      if (useLipSync && lipSync.current) {
        const audioEl = new Audio();
        audioEl.src = blobUrl;
        lipSync.current.connectAudio(audioEl);
        audioEl.onended = () => {
          URL.revokeObjectURL(blobUrl);
          playNextRef.current();
        };
        audioEl.play();
      } else {
        const source = audioCtx.current!.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode.current!);
        source.onended = () => {
          URL.revokeObjectURL(blobUrl);
          playNextRef.current();
        };
        source.start();
      }
    };
  }, []);

  const fetchAndEnqueue = useCallback(
    (
      text: string,
      voiceId: string,
      messageId: string,
      startIndex: number,
      useLipSync = true
    ) => {
      fetchQueue.current = fetchQueue.current.then(async () => {
        try {
          if (!audioCtx.current) {
            audioCtx.current = new AudioContext();
            gainNode.current = audioCtx.current.createGain();
            gainNode.current.connect(audioCtx.current.destination);
            gainNode.current.gain.value = mutedRef.current ? 0 : 1;
            lipSync.current = new Lipsync();
          }
          await audioCtx.current.resume();
          const response = await fetch(`${API_BASE}/tts/v1/audio/speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'kokoro',
              input: text,
              voice: voiceId,
              response_format: 'wav',
              speed: 1,
              stream: false,
            }),
          });
          const arrayBuffer = await response.arrayBuffer();
          if (!response.ok) {
            const errText = new TextDecoder().decode(arrayBuffer);
            throw new Error(`TTS error: ${errText}`);
          }
          const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
          const blobUrl = URL.createObjectURL(blob);
          const decoded = await audioCtx.current.decodeAudioData(
            arrayBuffer.slice(0)
          );
          audioQueue.current.push({
            buffer: decoded,
            blobUrl,
            sentence: text,
            messageId,
            startIndex,
            useLipSync,
          });
          if (!isPlaying.current) playNextRef.current();
        } catch (err) {
          console.error('TTS fetch failed:', err);
        }
      });
    },
    []
  );

  const enqueue = useCallback(
    (text: string, messageId: string, startIndex: number) => {
      const cleaned = stripAsterisks(text);
      if (!cleaned.trim()) {
        const actionText = text.replace(/\*([^*]*)\*/g, '$1').trim();
        if (actionText)
          fetchAndEnqueue(actionText, 'bm_lewis', messageId, startIndex, false);
        return;
      }
      fetchAndEnqueue(cleaned, voice, messageId, startIndex, true);
    },
    [voice, fetchAndEnqueue]
  );

  const speakAs = useCallback(
    (text: string, speakVoice: string) => {
      const cleaned = stripAsterisks(text);
      if (!cleaned.trim()) return;
      fetchAndEnqueue(cleaned, speakVoice, '__user__', -1, false);
    },
    [fetchAndEnqueue]
  );

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (gainNode.current)
      gainNode.current.gain.value = mutedRef.current ? 0 : 1;
  };

  return {
    enqueue,
    speakAs,
    ready: true,
    speaking,
    muted,
    toggleMute,
    activeSentence,
    activeMessageId,
    activeStartIndex,
    lipSync,
  };
};
