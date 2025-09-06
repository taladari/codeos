import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DetectCtx } from './detectors.js'

async function fileExists(p: string): Promise<boolean> { try { await fs.access(p); return true } catch { return false } }

export async function createCtxOverWorkspace(root: string): Promise<DetectCtx> {
  const roots = [root, ...await listWorkspacePackageDirs(root)]

  async function resolveFirst(rel: string): Promise<string | null> {
    for (const r of roots) {
      const p = path.isAbsolute(rel) ? rel : path.join(r, rel)
      if (await fileExists(p)) return p
    }
    return null
  }

  return {
    root,
    async read(rel: string) {
      const p = await resolveFirst(rel)
      if (!p) return null
      try { return await fs.readFile(p, 'utf8') } catch { return null }
    },
    async exists(rel: string) {
      const p = await resolveFirst(rel)
      return !!p
    },
    async list(relDir: string) {
      const p = await resolveFirst(relDir)
      if (!p) return []
      try { return await fs.readdir(p) } catch { return [] }
    }
  }
}

export async function listWorkspacePackageDirs(root: string): Promise<string[]> {
  const pkgsDir = path.join(root, 'packages')
  const out: string[] = []
  try {
    const entries = await fs.readdir(pkgsDir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory()) {
        const dir = path.join(pkgsDir, e.name)
        try { await fs.access(path.join(dir, 'package.json')); out.push(dir) } catch {}
      }
    }
  } catch {}
  return out
}

