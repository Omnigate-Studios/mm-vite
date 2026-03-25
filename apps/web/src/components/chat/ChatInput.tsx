import { useRef } from 'react';
import { Button } from '@workspace/ui/components/button';
import { Textarea } from '@workspace/ui/components/textarea';
import { SendHorizontal, Square } from 'lucide-react';

interface ChatInputProps {
  onSend: (value: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const value = ref.current?.value.trim();
    if (!value || isStreaming) return;
    onSend(value);
    if (ref.current) ref.current.value = '';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="z-1 w-full border-t bg-background px-4 py-3">
      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          placeholder="Message… (Enter to send, Shift+Enter for newline)"
          className="max-h-40 min-h-10 flex-1 resize-none"
          rows={1}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="outline"
            onClick={onStop}
            aria-label="Stop"
          >
            <Square size={16} />
          </Button>
        ) : (
          <Button size="icon" onClick={handleSend} aria-label="Send">
            <SendHorizontal size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
