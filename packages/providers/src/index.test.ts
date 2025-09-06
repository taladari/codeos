import { describe, it, expect } from 'vitest'
import { ClaudeDriver, OpenAIDriver } from './index'

describe('providers', () => {
  it('stubs respond', async () => {
    const claude = new ClaudeDriver()
    const out = await claude.generate([{role:'user', content:'hi'}])
    expect(out.text).toContain('stubbed')
  })
})
