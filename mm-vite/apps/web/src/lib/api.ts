export const API_BASE = ""

export interface LMModel {
  id: string
  object: string
}

export async function fetchModels(): Promise<LMModel[]> {
  const res = await fetch(`${API_BASE}/v1/models`)
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`)
  const data = await res.json()
  return data.data as LMModel[]
}

export async function* streamChat(
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, stream: true }),
    signal,
  })

  if (!res.ok) throw new Error(`API error: ${res.status}`)
  if (!res.body) throw new Error("No response body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const payload = line.slice(6).trim()
      if (payload === "[DONE]") return
      try {
        const json = JSON.parse(payload)
        const token: string | undefined = json.choices?.[0]?.delta?.content
        if (token) yield token
      } catch {
        // skip malformed lines
      }
    }
  }
}
