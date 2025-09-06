export async function withRetries(fn, opts = {}) {
    const { retries = 0, timeoutMs } = opts;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const p = fn();
            const v = timeoutMs ? await promiseWithTimeout(p, timeoutMs) : await p;
            return v;
        }
        catch (e) {
            lastErr = e;
            if (attempt === retries)
                break;
        }
    }
    throw lastErr;
}
async function promiseWithTimeout(p, ms) {
    return await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms);
        p.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
    });
}
export class ClaudeDriver {
    constructor() {
        this.name = 'claude';
    }
    async generate(_messages, opts) {
        return withRetries(async () => ({ text: '[stubbed-claude-response]' }), opts);
    }
}
export class OpenAIDriver {
    constructor() {
        this.name = 'openai';
    }
    async generate(_messages, opts) {
        return withRetries(async () => ({ text: '[stubbed-openai-response]' }), opts);
    }
}
