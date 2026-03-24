import type { Message } from '@/components/chat/MessageBubble';
import { stripAsterisks } from '@/utils';
import { useEffect, useRef } from 'react';

export const useAutoSpeak = (
  messages: Message[],
  isStreaming: boolean,
  enqueue: (text: string, messageId: string) => void,
  ready: boolean
) => {
  const spokenUpTo = useRef(0);
  const lastMessageId = useRef<string | null>(null);
  const finalFlushed = useRef(false);

  useEffect(() => {
    if (!ready) return;

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;

    if (last.id !== lastMessageId.current) {
      lastMessageId.current = last.id;
      spokenUpTo.current = 0;
      finalFlushed.current = false;
    }

    const content = stripAsterisks(last.content);
    const unspoken = content.slice(spokenUpTo.current);

    if (!isStreaming) {
      if (unspoken.trim() && !finalFlushed.current) {
        finalFlushed.current = true;
        enqueue(unspoken.trim(), last.id);
        spokenUpTo.current = content.length;
      }
      return;
    }

    const sentences = unspoken.match(/[^.!?]+[.!?]+/g);
    if (!sentences) return;

    for (const sentence of sentences) {
      enqueue(sentence.trim(), last.id);
      spokenUpTo.current += sentence.length;
    }
  }, [messages, isStreaming, ready, enqueue]);
};
