export interface LLMMessage { role: 'system'|'user'|'assistant'; content: string; }
export interface LLMResponse { text: string; }
export interface LLMDriver {
  name: string;
  generate(messages: LLMMessage[], opts?: {maxTokens?: number, timeoutMs?: number, retries?: number}): Promise<LLMResponse>;
}

export async function withRetries<T>(fn: () => Promise<T>, opts: { retries?: number, timeoutMs?: number } = {}): Promise<T> {
  const { retries = 0, timeoutMs } = opts
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const p = fn()
      const v = timeoutMs ? await promiseWithTimeout(p, timeoutMs) : await p
      return v
    } catch (e) {
      lastErr = e
      if (attempt === retries) break
    }
  }
  throw lastErr
}

async function promiseWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, err => { clearTimeout(t); reject(err) })
  })
}

export class ClaudeDriver implements LLMDriver {
  name = 'claude';
  async generate(_messages: LLMMessage[], opts?: {maxTokens?: number, timeoutMs?: number, retries?: number}): Promise<LLMResponse> {
    return withRetries(async () => ({ text: '[stubbed-claude-response]' }), opts)
  }
}

export class OpenAIDriver implements LLMDriver {
  name = 'openai';
  async generate(messages: LLMMessage[], opts?: {maxTokens?: number, timeoutMs?: number, retries?: number}): Promise<LLMResponse> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return withRetries(async () => ({ text: '[stubbed-openai-response]' }), opts)
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })
    const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
    return withRetries(async () => {
      const res = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: messages.map(m => ({ role: m.role, content: m.content })) as any,
        max_tokens: opts?.maxTokens ?? 800,
        temperature: 0
      })
      const text = res.choices?.[0]?.message?.content ?? ''
      return { text }
    }, opts)
  }
}
