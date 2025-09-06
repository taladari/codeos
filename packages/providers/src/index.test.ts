import { describe, it, expect } from 'vitest'
import { ClaudeDriver, OpenAIDriver, withRetries } from './index'

describe('providers', () => {
  it('stubs respond (claude)', async () => {
    const claude = new ClaudeDriver()
    const out = await claude.generate([{role:'user', content:'hi'}], { timeoutMs: 500, retries: 1 })
    expect(out.text).toContain('stubbed-claude')
  })

  it('stubs respond (openai)', async () => {
    const openai = new OpenAIDriver()
    const out = await openai.generate([{role:'user', content:'hi'}], { timeoutMs: 500, retries: 1 })
    expect(out.text).toContain('stubbed-openai')
  })

  it('retries then succeeds', async () => {
    let attempts = 0
    const out = await withRetries(async () => {
      attempts++
      if (attempts < 2) throw new Error('fail once')
      return 'ok'
    }, { retries: 2, timeoutMs: 200 })
    expect(out).toBe('ok')
  })
})
