import { useEffect, useRef } from "react"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { useChat } from "@/hooks/useChat"
import { useModels } from "@/hooks/useModels"
import { MessageBubble } from "./MessageBubble"
import { ChatInput } from "./ChatInput"

export function Chat() {
  const { messages, sendMessage, isStreaming, error, stop } = useChat()
  const { data: models } = useModels()
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeModel = models?.[0]?.id ?? "LM Studio"

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex h-svh flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-sm font-medium">Chat</h1>
        <p className="text-muted-foreground text-xs">{activeModel}</p>
      </header>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <p className="text-muted-foreground mt-8 text-center text-sm">
              Start a conversation below.
            </p>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {error && (
            <p className="text-destructive text-center text-xs">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput onSend={sendMessage} onStop={stop} isStreaming={isStreaming} />
    </div>
  )
}
