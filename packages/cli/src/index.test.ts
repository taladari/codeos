import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createBlueprint, initProject } from './index.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'

describe('cli:createBlueprint', () => {
  it('returns a kebab-cased path', async () => {
    const p = await createBlueprint('Add Team Permissions')
    expect(p).toContain('.codeos/blueprints/add-team-permissions.md')
  })
})

describe('cli:initProject', () => {
  const tmpRoot = path.join(process.cwd(), '.tmp-cli-test')
  beforeEach(async () => {
    try { await fs.rm(tmpRoot, { recursive: true }) } catch {}
    await fs.mkdir(tmpRoot, { recursive: true })
  })
  afterEach(async () => {
    try { await fs.rm(tmpRoot, { recursive: true }) } catch {}
  })

  it('creates artifact directories and sample config idempotently', async () => {
    await initProject(tmpRoot)
    await initProject(tmpRoot) // idempotent
    const dirs = [
      '.codeos',
      '.codeos/blueprints',
      '.codeos/plan',
      '.codeos/patches',
      '.codeos/reports',
      '.codeos/review'
    ]
    for (const d of dirs) {
      const stat = await fs.stat(path.join(tmpRoot, d))
      expect(stat.isDirectory()).toBe(true)
    }
    const yml = await fs.readFile(path.join(tmpRoot, 'codeos.yml'), 'utf8')
    expect(yml).toContain('workflow: build')
  })
})
