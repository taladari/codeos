import { describe, it, expect } from 'vitest'
import { analyzeRepo, writeAnalyzeReport, detectFromDeps } from './analyzer.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'

describe('analyzer', () => {
  it('detects basic TS/Node and writes analyze.json', async () => {
    const root = process.cwd()
    const report = await analyzeRepo(root)
    expect(['typescript','javascript','unknown']).toContain(report.language)
    const out = await writeAnalyzeReport(root, report)
    const exists = await fs.readFile(out, 'utf8')
    expect(exists.length).toBeGreaterThan(2)
  })

  it('detects tools from deps', async () => {
    const r = detectFromDeps({ devDependencies: { eslint: '1', vitest: '1', prettier: '1' } })
    expect(r.linter).toBe('eslint')
    expect(r.testRunner).toBe('vitest')
    expect(r.formatter).toBe('prettier')
  })
})

