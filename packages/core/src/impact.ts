import { promises as fs } from 'node:fs'
import path from 'node:path'

const STOP_WORDS = new Set(['add','update','create','the','a','an','to','for','of','and','with','in','on','new'])

async function walk(dir: string, out: string[], skip: Set<string>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of entries) {
    if (skip.has(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, out, skip)
    else out.push(full)
  }
}

export async function buildRepoFileIndex(root: string): Promise<string[]> {
  const out: string[] = []
  const skip = new Set(['node_modules','.git','.codeos','dist','build','coverage'])
  await walk(root, out, skip)
  return out.filter(p => /\.(ts|tsx|js|jsx|json|md|yaml|yml)$/.test(p))
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => !STOP_WORDS.has(w))
}

export async function suggestAffectedFiles(root: string, blueprintTitle: string, k: number = 8): Promise<string[]> {
  const files = await buildRepoFileIndex(root)
  const terms = tokenize(blueprintTitle)
  const scored = files.map(f => {
    const name = f.toLowerCase()
    let score = 0
    for (const t of terms) {
      if (name.includes(t)) score += t.length
    }
    return { f, score }
  })
  scored.sort((a,b) => b.score - a.score)
  return scored.filter(s => s.score > 0).slice(0, k).map(s => path.relative(root, s.f))
}

