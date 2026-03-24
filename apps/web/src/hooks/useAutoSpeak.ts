import type { Message } from '@/components/chat/MessageBubble';
import { useEffect, useRef } from 'react';

export const useAutoSpeak = (
  messages: Message[],
  isStreaming: boolean,
  enqueue: (text: string, messageId: string, startIndex: number) => void,
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

    const content = last.content;
    const unspoken = content.slice(spokenUpTo.current);

    if (!isStreaming) {
      if (unspoken.trim() && !finalFlushed.current) {
        finalFlushed.current = true;
        const remaining = unspoken.match(/[^.!?\n]+[.!?]+|[^.!?\n]*\n+/g) ?? [];
        let offset = spokenUpTo.current;
        for (const sentence of remaining) {
          enqueue(sentence, last.id, offset);
          offset += sentence.length;
        }
        const alreadyCovered = remaining.reduce((acc, s) => acc + s.length, 0);
        const leftover = unspoken.slice(alreadyCovered).trim();
        if (leftover) enqueue(leftover, last.id, offset);
        spokenUpTo.current = content.length;
      }
      return;
    }

    const sentences = unspoken.match(/[^.!?\n]+[.!?]+|[^.!?\n]*\n+/g) ?? [];
    if (!sentences.length) return;

    for (const sentence of sentences) {
      enqueue(sentence, last.id, spokenUpTo.current);
      spokenUpTo.current += sentence.length;
    }
  }, [messages, isStreaming, ready, enqueue]);
};
