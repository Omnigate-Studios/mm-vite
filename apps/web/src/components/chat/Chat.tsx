import { useEffect, useRef } from 'react';
import { ScrollArea } from '@workspace/ui/components/scroll-area';
import { useChat } from '@/hooks/useChat';
import { useModels } from '@/hooks/useModels';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { Button } from '@workspace/ui/components/button';
import { Volume2, VolumeX } from 'lucide-react';
import { useAutoSpeak } from '@/hooks/useAutoSpeak';

export function Chat({
  kokoroProps,
}: {
  kokoroProps: {
    enqueue: (text: string, messageId: string, startIndex: number) => void;
    speakAs: (text: string, speakVoice: string) => void;
    ready: boolean;
    speaking: boolean;
    muted: boolean;
    toggleMute: () => void;
    activeSentence: string | null;
    activeMessageId: string | null;
    activeStartIndex: number;
  };
}) {
  const { messages, sendMessage, isStreaming, error, stop } = useChat();
  const {
    enqueue,
    muted,
    speakAs,
    toggleMute,
    activeSentence,
    activeMessageId,
    activeStartIndex,
  } = kokoroProps;
  const { data: models } = useModels();
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeModel = models?.[0]?.id ?? 'LM Studio';

  useAutoSpeak(messages, isStreaming, enqueue);

  const handleSend = (content: string) => {
    sendMessage(content);
    speakAs(content, 'bm_george');
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-svh flex-col">
      <header className="fixed top-0 z-1 w-full border-b bg-black/2.5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-medium">Chat</h1>
            <p className="text-xs text-muted-foreground">{activeModel}</p>
          </div>
          <Button onClick={toggleMute} variant="ghost" size="icon">
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </div>
      </header>

      <ScrollArea
        className="z-1 flex-1 px-4 py-20"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 50%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 50%)',
        }}
      >
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Start a conversation below.
            </p>
          )}
          {messages.map((msg) => (
            <div className="flex flex-col gap-2" key={msg.id}>
              <MessageBubble
                message={msg}
                activeSentence={activeSentence}
                activeMessageId={activeMessageId}
                activeStartIndex={activeStartIndex}
              />
            </div>
          ))}
          {error && (
            <p className="text-center text-xs text-destructive">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput onSend={handleSend} onStop={stop} isStreaming={isStreaming} />
    </div>
  );
}
