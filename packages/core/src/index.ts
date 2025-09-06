import { promises as fs } from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { z } from 'zod'

export interface CodeOSConfig {
  project?: { language?: string; package_manager?: string }
  workflow?: string
  workflows?: Record<string, { steps: Array<{ role: 'planner'|'builder'|'verifier'|'reviewer' }> }>
  gates?: Array<'lint'|'typecheck'|'test'|'security'>
  providers?: { llm?: 'claude'|'openai'|string }
  integrations?: { github?: { repo?: string } }
}

const defaultConfig: CodeOSConfig = {
  project: { language: 'typescript', package_manager: 'pnpm' },
  workflow: 'build',
  workflows: {
    build: {
      steps: [
        { role: 'planner' },
        { role: 'builder' },
        { role: 'verifier' },
        { role: 'reviewer' }
      ]
    }
  },
  gates: ['lint', 'typecheck', 'test'],
  providers: { llm: 'claude' },
  integrations: { github: { repo: 'org/name' } }
}

const ConfigSchema = z.object({
  project: z.object({
    language: z.string().optional(),
    package_manager: z.string().optional()
  }).optional(),
  workflow: z.string().optional(),
  workflows: z.record(z.object({
    steps: z.array(z.object({ role: z.enum(['planner','builder','verifier','reviewer']) }))
  })).optional(),
  gates: z.array(z.enum(['lint','typecheck','test','security'])).optional(),
  providers: z.object({ llm: z.string().optional() }).optional(),
  integrations: z.object({ github: z.object({ repo: z.string().optional() }).optional() }).optional()
})

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function merge<A extends Record<string, any>, B extends Record<string, any>>(a: A, b: B): A & B {
  const out: any = Array.isArray(a) ? [...(a as any[])] : { ...a }
  if (Array.isArray(a) || Array.isArray(b)) return (b ?? a) as any
  for (const [k, v] of Object.entries(b ?? {})) {
    if (k in out && isObject(out[k]) && isObject(v)) out[k] = merge(out[k], v as any)
    else out[k] = v
  }
  return out
}

export async function loadConfig(cwd: string = process.cwd()): Promise<CodeOSConfig> {
  const yml = path.join(cwd, 'codeos.yml')
  try {
    const raw = await fs.readFile(yml, 'utf8')
    const parsedRaw = (YAML.parse(raw) ?? {}) as unknown
    const parsed = ConfigSchema.safeParse(parsedRaw)
    if (!parsed.success) {
      const message = parsed.error.issues.map((i: { path: (string|number)[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new Error(`Invalid codeos.yml: ${message}`)
    }
    const cfg = merge(defaultConfig as any, parsed.data as any)
    return cfg as CodeOSConfig
  } catch {
    return { ...defaultConfig }
  }
}

export * from './analyzer.js'
export * from './redact.js'
export * from './detectors.js'
export * from './repo.js'
