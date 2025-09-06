export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMResponse {
    text: string;
}
export interface LLMDriver {
    name: string;
    generate(messages: LLMMessage[], opts?: {
        maxTokens?: number;
        timeoutMs?: number;
        retries?: number;
    }): Promise<LLMResponse>;
}
export declare function withRetries<T>(fn: () => Promise<T>, opts?: {
    retries?: number;
    timeoutMs?: number;
}): Promise<T>;
export declare class ClaudeDriver implements LLMDriver {
    name: string;
    generate(_messages: LLMMessage[], opts?: {
        maxTokens?: number;
        timeoutMs?: number;
        retries?: number;
    }): Promise<LLMResponse>;
}
export declare class OpenAIDriver implements LLMDriver {
    name: string;
    generate(_messages: LLMMessage[], opts?: {
        maxTokens?: number;
        timeoutMs?: number;
        retries?: number;
    }): Promise<LLMResponse>;
}
