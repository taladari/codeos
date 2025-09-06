import { describe, it, expect } from 'vitest'
import { loadConfig } from './index.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'

describe('core:loadConfig', () => {
  it('loads default config when missing', async () => {
    const cfg = await loadConfig('/tmp/does-not-exist-xyz')
    expect(cfg.workflow).toBe('build')
  })
  it('parses YAML and applies defaults', async () => {
    const cwd = path.join(process.cwd(), '.tmp-core-test')
    await fs.mkdir(cwd, { recursive: true })
    await fs.writeFile(path.join(cwd, 'codeos.yml'), 'workflow: build\nproviders:\n  llm: openai\n', 'utf8')
    const cfg = await loadConfig(cwd)
    expect(cfg.providers?.llm).toBe('openai')
    expect(cfg.workflows?.build?.steps?.length).toBeGreaterThan(0)
    try { await fs.rm(cwd, { recursive: true }) } catch {}
  })
})
