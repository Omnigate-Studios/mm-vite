import { stripAsterisks } from '@/utils';
import { cn } from '@workspace/ui/lib/utils';
import { Bot, User } from 'lucide-react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

interface MessageBubbleProps {
  message: Message;
  activeSentence?: string | null;
  activeMessageId?: string | null;
}

const roleConfig: Record<
  MessageRole,
  { icon: React.ReactNode; label: string; align: string; bubble: string }
> = {
  user: {
    icon: <User size={16} />,
    label: 'You',
    align: 'items-end',
    bubble: 'bg-primary text-primary-foreground',
  },
  assistant: {
    icon: <Bot size={16} />,
    label: 'Assistant',
    align: 'items-start',
    bubble: 'bg-muted text-foreground',
  },
};

function Markdown({ children }: { children?: ReactNode }) {
  return <span className="block">{children}</span>;
}

function withHighlight(content: string, activeSentence: string) {
  const stripped = stripAsterisks(content);
  const idx = stripped.indexOf(activeSentence);
  if (idx === -1) return content;
  const before = stripped.slice(0, idx);
  const after = stripped.slice(idx + activeSentence.length);
  return `${before}<mark>${activeSentence}</mark>${after}`;
}

export function MessageBubble({
  message,
  activeSentence,
  activeMessageId,
}: MessageBubbleProps) {
  const { icon, label, align, bubble } = roleConfig[message.role];
  const isActive = activeMessageId === message.id && !!activeSentence;

  const classes = [
    '[&_em]:italic',
    '[&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]',
    '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
    '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
    '[&_p]:mb-2 [&_p]:last:mb-0',
    '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/10 [&_pre]:p-3',
  ];

  return (
    <div
      className={cn(
        'flex max-w-[75%] flex-col gap-1',
        align,
        message.role === 'user' && 'self-end'
      )}
    >
      <span className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <div
        className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          bubble
        )}
      >
        <div className={cn('flex flex-col gap-4 wrap-break-word', ...classes)}>
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            rehypePlugins={[rehypeRaw]}
            components={{
              p: Markdown,
              mark: ({ children }) => (
                <mark className="rounded bg-primary/20 text-foreground not-italic">
                  {children}
                </mark>
              ),
            }}
          >
            {isActive
              ? withHighlight(message.content, activeSentence!)
              : message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
