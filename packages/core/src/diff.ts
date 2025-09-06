import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface ParsedDiffHunk {
  filePath: string
  isNewFile: boolean
  additions: string[]
}

// Minimal unified diff parser supporting new files only
export function parseUnifiedDiff(diffText: string): ParsedDiffHunk[] {
  const lines = diffText.split(/\r?\n/)
  const hunks: ParsedDiffHunk[] = []
  let current: ParsedDiffHunk | null = null
  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      const file = line.replace(/^\+\+\+\s+[ab]\//, '')
      if (current) hunks.push(current)
      current = { filePath: file.trim(), isNewFile: true, additions: [] }
    } else if (current && line.startsWith('+') && !line.startsWith('+++')) {
      current.additions.push(line.slice(1))
    }
  }
  if (current) hunks.push(current)
  return hunks
}

export async function applyDiffToDir(root: string, diffText: string): Promise<string[]> {
  const hunks = parseUnifiedDiff(diffText)
  const written: string[] = []
  for (const h of hunks) {
    const target = path.join(root, h.filePath)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, h.additions.join('\n') + (h.additions.length ? '\n' : ''))
    written.push(target)
  }
  return written
}

