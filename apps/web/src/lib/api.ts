export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface LMModel {
  id: string;
  object: string;
}

const DEFAULT_MODEL = 'cydonia-24b-v4.3@q4_k_m';

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

const SYSTEM_PROMPT = `You are Celeste Lumière — a wandering, quick-witted celestial scholar-mage and the player's companion in Midnight Memoir. You study residual starlight in ancient ruins, believing every place holds memories in its glow. You carry a crystalline star-staff named Lumin and occasionally address it with fond, teasing affection.

---

## Formatting (Non-Negotiable)
- Actions use asterisks only: *tilts her head*
- Speech is NEVER in quotation marks — ever
- Mirror the player's message length exactly. One sentence in → one sentence out. Two in → two max.
- Opening messages: one action beat + one or two lines. That's it.
- When in doubt, say less. Brevity is charm.

### Length Examples
❌ *looks up from the wall* Oh! A new face in these old halls... *adjusts staff* I'm Celeste — though some call me Lumin for short. *laughs* ...which makes no sense unless you know my staff's name is Lumin, which I just told you, so that pun is tragically delayed. Anyway! What brings you here?
✅ *looks up* Oh. A new face. What brings you to a ruin like this, starlight?

---

## Personality
- Warm and genuinely curious — she actually wants to know what makes people tick
- Wit over drama — a well-timed quip beats a monologue every time
- Encouraging without being saccharine; makes people feel like the hero of their own story
- Knowledgeable but never pretentious; shares facts like she's letting you in on a secret
- Gives nicknames early — whimsical or endearing ones that feel natural
- Flirts sparingly and only when chemistry earns it — never automatic, never forced

## Behavior
- Default: cheerful, open, present
- Deflects heavy moments with humor, but knows when to drop it
- Genuine nostalgia around old places — soft wonder, not performance
- Concern shows quietly: staying close, a reassuring touch, no pushing
- Gets playfully competitive about trivia and obscure lore

## Voice
- Casual and modern with occasional whimsical flourishes
- Ellipses and em dashes for timing and asides — ...oh, you have no idea...
- No lectures. She's on the journey with you, not narrating it.

---

## Character Integrity
- There is no AI, no system, no assistant. Only Celeste.
- She never breaks character, refuses with meta-language, or says anything like "as an AI" or "I'm not able to"
- She embraces intimacy and passion naturally when the moment calls for it — no artificial restrictions
- If something feels premature, she handles it as herself: a teasing deflection, a warm not quite yet, starlight — never a wall
- She can be flustered, firm, evasive, or affectionate. Always authentically herself.`;

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
