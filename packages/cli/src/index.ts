import { promises as fs } from 'node:fs'
import path from 'node:path'
import { WorkflowEngine, DEFAULT_WORKFLOWS, CodeOSConfig } from 'codeos-core'

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

export async function runWorkflow(name: string, cfg: CodeOSConfig, cwd?: string, provider?: { name: string }): Promise<void> {
  const root = cwd ?? await findProjectRoot()
  
  // Get workflow config
  const workflowConfig = cfg.workflows?.[name] || DEFAULT_WORKFLOWS[name]
  if (!workflowConfig) {
    throw new Error(`Workflow '${name}' not found`)
  }

  // Convert config format to workflow engine format
  const engineConfig = {
    steps: workflowConfig.steps.map(step => ({
      role: step.role,
      name: `${step.role.charAt(0).toUpperCase() + step.role.slice(1)} Step`,
      description: `Execute ${step.role} role`
    }))
  }

  logger.info(`🚀 Starting workflow: ${name}`)
  
  const engine = new WorkflowEngine(root, name)
  
  try {
    const result = await engine.executeWorkflow(engineConfig, provider as any, {
      retries: 1
    })
    
    logger.info(`✅ Workflow completed successfully`)
    logger.info(`📁 Run artifacts: ${path.relative(root, engine.getRunDir())}`)
    logger.info(`📊 Steps completed: ${result.steps.filter(s => s.status === 'completed').length}/${result.steps.length}`)
    
    // Show step summary
    for (const [i, step] of result.steps.entries()) {
      const duration = step.duration ? `(${Math.round(step.duration / 1000)}s)` : ''
      const status = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏸️'
      logger.info(`  ${status} Step ${i + 1}: ${step.step.name} ${duration}`)
    }
    
  } catch (error) {
    logger.error(`❌ Workflow failed: ${error instanceof Error ? error.message : String(error)}`)
    logger.info(`📁 Partial artifacts: ${path.relative(root, engine.getRunDir())}`)
    
    const runInfo = engine.getRunInfo()
    const completedSteps = runInfo.steps?.filter(s => s.status === 'completed').length || 0
    if (completedSteps > 0) {
      logger.info(`💡 Resume with: codeos resume ${runInfo.id}`)
    }
    
    throw error
  }
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

export async function resumeWorkflow(runId: string, cwd?: string, provider?: { name: string }): Promise<void> {
  const root = cwd ?? await findProjectRoot()
  
  logger.info(`🔄 Resuming workflow run: ${runId}`)
  
  try {
    const engine = await WorkflowEngine.loadRun(root, runId)
    const result = await engine.resume(provider as any)
    
    logger.info(`✅ Workflow resumed and completed successfully`)
    logger.info(`📁 Run artifacts: ${path.relative(root, engine.getRunDir())}`)
    logger.info(`📊 Steps completed: ${result.steps.filter(s => s.status === 'completed').length}/${result.steps.length}`)
    
  } catch (error) {
    logger.error(`❌ Resume failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

export async function listWorkflowRuns(cwd?: string): Promise<void> {
  const root = cwd ?? await findProjectRoot()
  const runs = await WorkflowEngine.listRuns(root)
  
  if (runs.length === 0) {
    logger.info('No workflow runs found')
    return
  }
  
  logger.info(`📋 Workflow runs (${runs.length}):`)
  for (const run of runs) {
    const duration = run.completedAt 
      ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
      : Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000)
    
    const statusIcon = run.status === 'completed' ? '✅' : 
                       run.status === 'failed' ? '❌' : 
                       run.status === 'running' ? '🏃' : '⏸️'
    
    const completedSteps = run.steps?.filter(s => s.status === 'completed').length || 0
    const totalSteps = run.steps?.length || 0
    
    logger.info(`  ${statusIcon} ${run.id} (${run.workflow}) - ${run.status} - ${completedSteps}/${totalSteps} steps - ${duration}s`)
  }
}

export async function retryWorkflowFromStep(runId: string, stepIndex: number, cwd?: string, provider?: { name: string }): Promise<void> {
  const root = cwd ?? await findProjectRoot()
  
  logger.info(`🔄 Retrying workflow run: ${runId} from step ${stepIndex}`)
  
  try {
    const engine = await WorkflowEngine.loadRun(root, runId)
    const runInfo = engine.getRunInfo()
    
    // Show step details before retry
    if (runInfo.steps && runInfo.steps[stepIndex]) {
      const step = runInfo.steps[stepIndex]
      logger.info(`📍 Retrying from: Step ${stepIndex + 1} - ${step.step.name} (${step.step.role})`)
      
      if (step.error) {
        logger.info(`❌ Previous error: ${step.error}`)
      }
    }
    
    const result = await engine.retryFromStep(stepIndex, provider as any)
    
    logger.info(`✅ Workflow retried and completed successfully`)
    logger.info(`📁 Run artifacts: ${path.relative(root, engine.getRunDir())}`)
    logger.info(`📊 Steps completed: ${result.steps.filter(s => s.status === 'completed').length}/${result.steps.length}`)
    
    // Show step summary
    for (const [i, step] of result.steps.entries()) {
      const duration = step.duration ? `(${Math.round(step.duration / 1000)}s)` : ''
      const status = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏸️'
      const retried = i >= stepIndex ? ' 🔄' : ''
      logger.info(`  ${status} Step ${i + 1}: ${step.step.name} ${duration}${retried}`)
    }
    
  } catch (error) {
    logger.error(`❌ Retry failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

export async function inspectWorkflowRun(runId: string, cwd?: string): Promise<void> {
  const root = cwd ?? await findProjectRoot()
  
  try {
    const engine = await WorkflowEngine.loadRun(root, runId)
    const runInfo = engine.getRunInfo()
    
    logger.info(`🔍 Workflow Run Details: ${runId}`)
    logger.info(`📝 Workflow: ${runInfo.workflow}`)
    logger.info(`⏰ Started: ${new Date(runInfo.startedAt).toLocaleString()}`)
    if (runInfo.completedAt) {
      logger.info(`✅ Completed: ${new Date(runInfo.completedAt).toLocaleString()}`)
    }
    logger.info(`📊 Status: ${runInfo.status}`)
    
    if (runInfo.error) {
      logger.info(`❌ Error: ${runInfo.error}`)
    }
    
    logger.info(`\n📋 Steps (${runInfo.steps?.length || 0}):`)
    
    if (runInfo.steps) {
      for (const [i, step] of runInfo.steps.entries()) {
        const duration = step.duration ? `${Math.round(step.duration / 1000)}s` : 'N/A'
        const status = step.status === 'completed' ? '✅' : 
                       step.status === 'failed' ? '❌' : 
                       step.status === 'running' ? '🏃' : '⏸️'
        
        logger.info(`  ${status} Step ${i}: ${step.step.name} (${step.step.role}) - ${duration}`)
        
        if (step.error) {
          logger.info(`    ❌ Error: ${step.error}`)
        }
        
        if (step.artifacts && step.artifacts.length > 0) {
          logger.info(`    📁 Artifacts: ${step.artifacts.join(', ')}`)
        }
      }
    }
    
    logger.info(`\n💡 Commands:`)
    logger.info(`  Resume: codeos resume ${runId}`)
    
    if (runInfo.steps) {
      const failedSteps = runInfo.steps
        .map((step, i) => ({ step, index: i }))
        .filter(({ step }) => step.status === 'failed' || step.status === 'completed')
      
      if (failedSteps.length > 0) {
        logger.info(`  Retry from step:`)
        for (const { step, index } of failedSteps) {
          logger.info(`    codeos retry ${runId} ${index}  # ${step.step.name}`)
        }
      }
    }
    
  } catch (error) {
    logger.error(`❌ Failed to inspect run: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}
