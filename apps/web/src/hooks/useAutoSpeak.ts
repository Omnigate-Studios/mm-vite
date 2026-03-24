import type { Message } from '@/components/chat/MessageBubble';
import { stripAsterisks } from '@/utils';
import { useEffect, useRef } from 'react';

export const useAutoSpeak = (
  messages: Message[],
  isStreaming: boolean,
  enqueue: (text: string) => void,
  ready: boolean
) => {
  const spokenUpTo = useRef(0);
  const lastMessageId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;

    if (last.id !== lastMessageId.current) {
      lastMessageId.current = last.id;
      spokenUpTo.current = 0;
    }

    const content = stripAsterisks(last.content);
    const unspoken = content.slice(spokenUpTo.current);

    if (!isStreaming) {
      if (unspoken.trim()) {
        enqueue(unspoken.trim());
        spokenUpTo.current = content.length;
      }
      return;
    }

    const sentences = unspoken.match(/[^.!?]+[.!?]+/g);
    if (!sentences) return;

    for (const sentence of sentences) {
      enqueue(sentence.trim());
      spokenUpTo.current += sentence.length;
    }
  }, [messages, isStreaming, ready, enqueue]);
};
