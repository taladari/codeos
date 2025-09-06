export interface LLMMessage { role: 'system'|'user'|'assistant'; content: string; }
export interface LLMResponse { text: string; }
export interface LLMDriver {
  name: string;
  generate(messages: LLMMessage[], opts?: {maxTokens?: number}): Promise<LLMResponse>;
}

export class ClaudeDriver implements LLMDriver {
  name = 'claude';
  async generate(_messages: LLMMessage[]): Promise<LLMResponse> {
    return { text: '[stubbed-claude-response]' };
  }
}

export class OpenAIDriver implements LLMDriver {
  name = 'openai';
  async generate(_messages: LLMMessage[]): Promise<LLMResponse> {
    return { text: '[stubbed-openai-response]' };
  }
}
