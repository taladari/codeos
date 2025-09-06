import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createBlueprint, initProject } from './index'
import { promises as fs } from 'node:fs'
import path from 'node:path'

describe('cli:createBlueprint', () => {
  it('returns a kebab-cased path', async () => {
    const p = await createBlueprint('Add Team Permissions')
    expect(p).toContain('.codeos/blueprints/add-team-permissions.md')
  })
})

describe('cli:initProject', () => {
  const tmp = path.join(process.cwd(), '.codeos')
  beforeEach(async () => {
    try { await fs.rm(tmp, { recursive: true }) } catch {}
  })
  afterEach(async () => {
    try { await fs.rm(tmp, { recursive: true }) } catch {}
  })

  it('creates artifact directories and sample config idempotently', async () => {
    await initProject()
    await initProject() // idempotent
    const dirs = [
      '.codeos',
      '.codeos/blueprints',
      '.codeos/plan',
      '.codeos/patches',
      '.codeos/reports',
      '.codeos/review'
    ]
    for (const d of dirs) {
      const stat = await fs.stat(d)
      expect(stat.isDirectory()).toBe(true)
    }
    const yml = await fs.readFile(path.join(process.cwd(), 'codeos.yml'), 'utf8')
    expect(yml).toContain('workflow: build')
  })
})
