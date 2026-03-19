// AI: client generico per provider OpenAI-compatible — nessuna dipendenza esterna.
// Usa fetch nativo con l'API /chat/completions, supportata da:
//   - Groq       (gratuito)  AI_BASE_URL=https://api.groq.com/openai/v1
//   - OpenAI     (a pagamento) AI_BASE_URL=https://api.openai.com/v1
//   - Ollama     (locale)    AI_BASE_URL=http://localhost:11434/v1  (no key)
//   - OpenRouter (multi-model) AI_BASE_URL=https://openrouter.ai/api/v1
//
// Variabili d'ambiente (server-only — non NEXT_PUBLIC_):
//   AI_BASE_URL  — endpoint base  (default: https://api.groq.com/openai/v1)
//   AI_API_KEY   — chiave API     (non necessaria per Ollama locale)
//   AI_MODEL     — modello        (default: llama-3.1-8b-instant)

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * @description Legge la configurazione AI dalle variabili d'ambiente.
 * Eseguita esclusivamente server-side (API routes).
 */
export function getAiConfig(): AiConfig {
  return {
    baseUrl: process.env.AI_BASE_URL ?? 'https://api.groq.com/openai/v1',
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'llama-3.1-8b-instant',
  };
}

/**
 * @description True se l'AI è configurata e utilizzabile.
 * Ollama locale non richiede API key.
 */
export function isAiEnabled(): boolean {
  const { baseUrl, apiKey } = getAiConfig();
  const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  return isLocal || !!apiKey;
}

/**
 * @description Invia una chat completion al provider configurato.
 * Usa l'endpoint OpenAI-compatible POST /chat/completions.
 *
 * @example
 * const text = await chatComplete([
 *   { role: 'system', content: 'Sei un mediatore culturale...' },
 *   { role: 'user', content: 'Descrivi questo dipinto...' },
 * ]);
 */
export async function chatComplete(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const { baseUrl, apiKey, model } = getAiConfig();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options?.maxTokens ?? 300,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API ${res.status}: ${err}`);
  }

  // AI: estrai il testo dalla risposta OpenAI-compatible
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI: risposta vuota');
  return content.trim();
}
