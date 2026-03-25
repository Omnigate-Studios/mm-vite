import { stripAsterisks } from '@/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

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
      sentence: string;
      messageId: string;
      startIndex: number;
    }[]
  >([]);
  const isPlaying = useRef(false);
  const playNextRef = useRef<() => void>(() => {});
  const audioCtx = useRef<AudioContext | null>(null);
  const gainNode = useRef<GainNode | null>(null);

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
      const { buffer, sentence, messageId, startIndex } =
        audioQueue.current.shift()!;
      setActiveSentence(sentence);
      setActiveMessageId(messageId);
      setActiveStartIndex(startIndex);
      const source = audioCtx.current!.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode.current!);
      source.onended = () => playNextRef.current();
      source.start();
    };
  }, []);

  const fetchAndEnqueue = useCallback(
    async (
      text: string,
      voiceId: string,
      messageId: string,
      startIndex: number
    ) => {
      try {
        if (!audioCtx.current) {
          audioCtx.current = new AudioContext();
          gainNode.current = audioCtx.current.createGain();
          gainNode.current.connect(audioCtx.current.destination);
          gainNode.current.gain.value = mutedRef.current ? 0 : 1;
        }
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
        if (!response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const errorText = new TextDecoder().decode(arrayBuffer);
          console.log('raw response:', errorText);
          console.log('audio buffer size:', arrayBuffer.byteLength);
          const errText = new TextDecoder().decode(arrayBuffer);
          throw new Error(`TTS error: ${errText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const errorText = new TextDecoder().decode(arrayBuffer);
        console.log('raw response:', errorText);
        await audioCtx.current.resume();
        const decoded = await audioCtx.current.decodeAudioData(arrayBuffer);
        audioQueue.current.push({
          buffer: decoded,
          sentence: text,
          messageId,
          startIndex,
        });
        if (!isPlaying.current) playNextRef.current();
      } catch (err) {
        console.error('TTS fetch failed:', err);
      }
    },
    []
  );

  const enqueue = useCallback(
    (text: string, messageId: string, startIndex: number) => {
      const cleaned = stripAsterisks(text);
      if (!cleaned.trim()) {
        const actionText = text.replace(/\*([^*]*)\*/g, '$1').trim();
        if (actionText)
          fetchAndEnqueue(actionText, 'bm_lewis', messageId, startIndex);
        return;
      }
      fetchAndEnqueue(cleaned, voice, messageId, startIndex);
    },
    [voice, fetchAndEnqueue]
  );

  const speakAs = useCallback(
    (text: string, speakVoice: string) => {
      const cleaned = stripAsterisks(text);
      if (!cleaned.trim()) return;
      fetchAndEnqueue(cleaned, speakVoice, '__user__', -1);
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
  };
};
