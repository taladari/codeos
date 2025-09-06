import { promises as fs } from 'node:fs'
import path from 'node:path'
import { runPlanner, runBuilder, runVerifier, runReviewer, CodeOSConfig } from 'codeos-core'

type LogLevel = 'quiet'|'normal'|'verbose'
let CURRENT_LEVEL: LogLevel = 'normal'
export function setLogLevel(level: LogLevel) { CURRENT_LEVEL = level }
export const logger = {
  info: (msg: string) => { if (CURRENT_LEVEL !== 'quiet') process.stdout.write(msg + '\n') },
  debug: (msg: string) => { if (CURRENT_LEVEL === 'verbose') process.stdout.write(msg + '\n') },
  error: (msg: string) => { process.stderr.write(msg + '\n') }
}

const ARTIFACT_DIRS = [
  '.codeos',
  '.codeos/blueprints',
  '.codeos/plan',
  '.codeos/patches',
  '.codeos/reports',
  '.codeos/review',
  '.codeos/run'
]

const SAMPLE_YML = `project:
  language: typescript
  package_manager: pnpm
workflow: build
workflows:
  build:
    steps:
      - role: planner
      - role: builder
      - role: verifier
      - role: reviewer
gates:
  - lint
  - typecheck
  - test
providers:
  llm: claude
integrations:
  github:
    repo: org/name
`

export async function initProject(cwd?: string): Promise<void> {
  const root = cwd ?? await findProjectRoot()
  for (const d of ARTIFACT_DIRS) {
    await fs.mkdir(path.join(root, d), { recursive: true })
    logger.debug(`Ensured directory ${path.join(root, d)}`)
  }
  const ymlPath = path.join(root, 'codeos.yml')
  try {
    await fs.access(ymlPath)
  } catch {
    await fs.writeFile(ymlPath, SAMPLE_YML, 'utf8')
    logger.debug(`Wrote sample codeos.yml at ${ymlPath}`)
  }
  await ensureFile(path.join(root, '.codeos/.gitkeep'))
  await ensureFile(path.join(root, '.codeos/blueprints/.gitkeep'))
  await ensureFile(path.join(root, '.codeos/plan/.gitkeep'))
  await ensureFile(path.join(root, '.codeos/patches/.gitkeep'))
  await ensureFile(path.join(root, '.codeos/reports/.gitkeep'))
  await ensureFile(path.join(root, '.codeos/review/.gitkeep'))
}

async function ensureFile(p: string): Promise<void> {
  try {
    await fs.access(p)
  } catch {
    await fs.writeFile(p, '', 'utf8')
  }
}

export async function createBlueprint(title: string, cwd?: string): Promise<string> {
  const root = cwd ?? await findProjectRoot()
  const slug = title.trim().replace(/\s+/g, '-').toLowerCase()
  const dir = path.join(root, '.codeos', 'blueprints')
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${slug}.md`)
  const content = `# ${title}

## Goals
- 

## Constraints
- 

## Acceptance Criteria
- [ ] 

## Test Plan
- 

`
  await fs.writeFile(filePath, content, 'utf8')
  logger.debug(`Blueprint written to ${filePath}`)
  return path.relative(root, filePath)
}

export async function runWorkflow(name: string, _cfg: any, cwd?: string, provider?: { name: string }): Promise<void> {
  const root = cwd ?? await findProjectRoot()
  const runRoot = path.join(root, '.codeos', 'run', new Date().toISOString().replace(/[:.]/g, '-'))
  await fs.mkdir(runRoot, { recursive: true })
  await fs.writeFile(path.join(runRoot, 'meta.json'), JSON.stringify({ workflow: name }, null, 2))
  // TODO: planner → builder → verifier → reviewer
  logger.info(`running workflow: ${name}`)
  const plan = await runPlanner(root, provider as any)
  logger.debug(`Plan at ${plan.planPath}`)
  const build = await runBuilder(root, provider as any)
  logger.debug(`Patches: ${build.patches.length}`)
  const verify = await runVerifier(root, build.patches)
  logger.debug(`Reports: ${verify.reports.map(r=>r.path).join(', ')}`)
  const review = await runReviewer(root)
  logger.info(`Review summary at ${review.reviewPath}`)
}

export async function selectProvider(cfg: CodeOSConfig): Promise<{ name: string, generate: (msgs: any[], opts?: any)=>Promise<{text:string}> } | undefined> {
  const llm = cfg.providers?.llm ?? 'openai'
  if (llm === 'openai') {
    const { OpenAIDriver } = await import('codeos-providers')
    return new OpenAIDriver() as any
  }
  return { name: llm, generate: async () => ({ text: '' }) }
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

export async function findProjectRoot(startCwd: string = process.cwd()): Promise<string> {
  const override = process.env.CODEOS_ROOT
  if (override && await fileExists(override)) return override
  let dir = startCwd
  let topmostWorkspace: string | null = null
  let topmostCodeos: string | null = null
  let topmostGit: string | null = null
  while (true) {
    if (await fileExists(path.join(dir, 'pnpm-workspace.yaml'))) topmostWorkspace = dir
    if (await fileExists(path.join(dir, 'codeos.yml'))) topmostCodeos = dir
    if (await fileExists(path.join(dir, '.git'))) topmostGit = dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return topmostWorkspace || topmostCodeos || topmostGit || startCwd
}
