import { useCallback, useRef, useState } from 'react';
import { streamChat } from '@/lib/api';
import type { Message } from '@/components/chat/MessageBubble';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const history = [...messagesRef.current, userMsg].map(
        ({ role, content }) => ({ role, content })
      );

      for await (const token of streamChat(history, abortRef.current.signal)) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + token } : m
          )
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, sendMessage, isStreaming, error, stop };
}
