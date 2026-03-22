import { cn } from "@workspace/ui/lib/utils"
import { Bot, User } from "lucide-react"

export type MessageRole = "user" | "assistant"

export interface Message {
  id: string
  role: MessageRole
  content: string
}

interface MessageBubbleProps {
  message: Message
}

const roleConfig: Record<MessageRole, { icon: React.ReactNode; label: string; align: string; bubble: string }> = {
  user: {
    icon: <User size={16} />,
    label: "You",
    align: "items-end",
    bubble: "bg-primary text-primary-foreground",
  },
  assistant: {
    icon: <Bot size={16} />,
    label: "Assistant",
    align: "items-start",
    bubble: "bg-muted text-foreground",
  },
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { icon, label, align, bubble } = roleConfig[message.role]

  return (
    <div className={cn("flex flex-col gap-1 max-w-[75%]", align, message.role === "user" && "self-end")}>
      <span className="text-muted-foreground flex items-center gap-1 px-1 text-xs">
        {icon}
        {label}
      </span>
      <div className={cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap", bubble)}>
        {message.content}
      </div>
    </div>
  )
}
