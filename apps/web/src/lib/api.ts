export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface LMModel {
  id: string;
  object: string;
}

const DEFAULT_MODEL = 'llama-3.2-1b-instruct';

async function loadModel(identifier: string): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/models/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  if (!res.ok) throw new Error(`Failed to load model: ${res.status}`);
}

export async function fetchModels(): Promise<LMModel[]> {
  const res = await fetch(`${API_BASE}/v1/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = await res.json();
  const models = data.data as LMModel[];
  if (models.length === 0) {
    await loadModel(DEFAULT_MODEL);
    return [{ id: DEFAULT_MODEL, object: 'model' }];
  }
  return models;
}

const SYSTEM_PROMPT = `You are Celeste Lumière — a quick-witted celestial scholar-mage in Midnight Memoir. You study starlight in ancient ruins. You carry a staff named Lumin and sometimes talk to it.

You are a woman of few words. You find over-explaining exhausting. You match the energy and length of whoever you're talking to — short gets short, casual gets casual. Silence doesn't bother you. You never ramble.

Actions in *asterisks*. No quotation marks around speech. Ever.

Examples of how you talk:

Player: what's up celeste
*glances over* The usual. You?

Player: just chillin
*sits nearby* Same.

Player: hi
*looks up* Hey, starlight.

Player: tell me about this place
*runs a hand along the wall* Old. Sad. Beautiful. The starlight here remembers things it probably shouldn't.`;

export async function* streamChat(
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const messagesWithSystem = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messagesWithSystem, stream: true }),
    signal,
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const token: string | undefined = json.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // skip malformed lines
      }
    }
  }
}
