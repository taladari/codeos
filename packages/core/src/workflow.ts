import { promises as fs } from 'node:fs'
import path from 'node:path'
import { runPlanner, runBuilder, runVerifier, runReviewer, RoleName } from './roles.js'
import type { LLMDriverLike } from './roles.js'

export interface WorkflowStep {
  role: RoleName
  name: string
  description: string
}

export interface WorkflowRun {
  id: string
  workflow: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  currentStep?: number
  steps: WorkflowStepResult[]
  error?: string
}

export interface WorkflowStepResult {
  step: WorkflowStep
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: string
  completedAt?: string
  duration?: number
  error?: string
  artifacts?: string[]
  logs?: string[]
}

export interface WorkflowConfig {
  steps: WorkflowStep[]
}

export class WorkflowEngine {
  private root: string
  private runId: string
  private runDir: string
  private logsPath: string
  private metaPath: string
  private run: WorkflowRun

  constructor(root: string, workflow: string) {
    this.root = root
    this.runId = new Date().toISOString().replace(/[:.]/g, '-')
    this.runDir = path.join(root, '.codeos', 'run', this.runId)
    this.logsPath = path.join(this.runDir, 'logs.txt')
    this.metaPath = path.join(this.runDir, 'meta.json')
    
    this.run = {
      id: this.runId,
      workflow,
      startedAt: new Date().toISOString(),
      status: 'running',
      currentStep: 0,
      steps: []
    }
  }

  async initialize(config: WorkflowConfig): Promise<void> {
    await fs.mkdir(this.runDir, { recursive: true })
    
    // Initialize step results
    this.run.steps = config.steps.map(step => ({
      step,
      status: 'pending'
    }))
    
    await this.saveMetadata()
    await this.log('info', `Workflow ${this.run.workflow} started`, { runId: this.runId })
  }

  async executeStep(stepIndex: number, provider?: LLMDriverLike): Promise<void> {
    const stepResult = this.run.steps[stepIndex]
    if (!stepResult) {
      throw new Error(`Step ${stepIndex} not found`)
    }

    const { step } = stepResult
    this.run.currentStep = stepIndex

    stepResult.status = 'running'
    stepResult.startedAt = new Date().toISOString()

    await this.log('info', `Starting step: ${step.name}`, { 
      step: stepIndex, 
      role: step.role 
    })
    await this.saveMetadata()

    const startTime = Date.now()
    
    try {
      const artifacts = await this.executeRole(step.role, provider)
      
      stepResult.status = 'completed'
      stepResult.completedAt = new Date().toISOString()
      stepResult.duration = Date.now() - startTime
      stepResult.artifacts = artifacts

      await this.log('info', `Completed step: ${step.name}`, {
        step: stepIndex,
        role: step.role,
        duration: stepResult.duration,
        artifacts: artifacts.length
      })

    } catch (error) {
      stepResult.status = 'failed'
      stepResult.completedAt = new Date().toISOString()
      stepResult.duration = Date.now() - startTime
      stepResult.error = error instanceof Error ? error.message : String(error)

      await this.log('error', `Failed step: ${step.name}`, {
        step: stepIndex,
        role: step.role,
        error: stepResult.error,
        duration: stepResult.duration
      })

      throw error
    } finally {
      await this.saveMetadata()
    }
  }

  async executeRole(role: RoleName, provider?: LLMDriverLike): Promise<string[]> {
    const artifacts: string[] = []

    switch (role) {
      case 'planner': {
        const result = await runPlanner(this.root, provider)
        artifacts.push(result.planPath)
        break
      }
      case 'builder': {
        const result = await runBuilder(this.root, provider)
        artifacts.push(...result.patches.map(p => p.file))
        break
      }
      case 'verifier': {
        // Get patches from previous step
        const patches = await this.loadPatches()
        const result = await runVerifier(this.root, patches)
        artifacts.push(...result.reports.map(r => r.path))
        break
      }
      case 'reviewer': {
        const result = await runReviewer(this.root)
        artifacts.push(result.reviewPath)
        break
      }
      default:
        throw new Error(`Unknown role: ${role}`)
    }

    return artifacts.map(p => path.relative(this.root, p))
  }

  async executeWorkflow(config: WorkflowConfig, provider?: LLMDriverLike, options: {
    retries?: number
    resumeFromStep?: number
  } = {}): Promise<WorkflowRun> {
    const { retries = 1, resumeFromStep = 0 } = options

    try {
      await this.initialize(config)

      for (let i = resumeFromStep; i < config.steps.length; i++) {
        let attempts = 0
        let lastError: Error | null = null

        while (attempts <= retries) {
          try {
            await this.executeStep(i, provider)
            break // Success, move to next step
          } catch (error) {
            lastError = error as Error
            attempts++
            
            if (attempts <= retries) {
              await this.log('warn', `Step failed, retrying (${attempts}/${retries + 1})`, {
                step: i,
                error: lastError.message
              })
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts)) // Exponential backoff
            }
          }
        }

        if (lastError && attempts > retries) {
          this.run.status = 'failed'
          this.run.error = lastError.message
          this.run.completedAt = new Date().toISOString()
          await this.saveMetadata()
          throw lastError
        }
      }

      this.run.status = 'completed'
      this.run.completedAt = new Date().toISOString()
      await this.log('info', 'Workflow completed successfully', {
        duration: Date.now() - new Date(this.run.startedAt).getTime()
      })

    } catch (error) {
      this.run.status = 'failed'
      this.run.error = error instanceof Error ? error.message : String(error)
      this.run.completedAt = new Date().toISOString()
      await this.log('error', 'Workflow failed', { error: this.run.error })
      throw error
    } finally {
      await this.saveMetadata()
    }

    return this.run
  }

  async resume(provider?: LLMDriverLike): Promise<WorkflowRun> {
    // Find the last incomplete step
    const resumeFromStep = this.run.steps.findIndex(s => s.status === 'pending' || s.status === 'failed')
    if (resumeFromStep === -1) {
      throw new Error('No steps to resume')
    }

    await this.log('info', 'Resuming workflow', { resumeFromStep })
    
    // Reconstruct config from existing steps
    const config: WorkflowConfig = {
      steps: this.run.steps.map(s => s.step)
    }

    return this.executeWorkflow(config, provider, { resumeFromStep })
  }

  async retryFromStep(stepIndex: number, provider?: LLMDriverLike): Promise<WorkflowRun> {
    if (stepIndex < 0 || stepIndex >= this.run.steps.length) {
      throw new Error(`Invalid step index: ${stepIndex}. Must be between 0 and ${this.run.steps.length - 1}`)
    }

    // Reset all steps from the specified index onwards
    for (let i = stepIndex; i < this.run.steps.length; i++) {
      this.run.steps[i].status = 'pending'
      this.run.steps[i].startedAt = undefined
      this.run.steps[i].completedAt = undefined
      this.run.steps[i].duration = undefined
      this.run.steps[i].error = undefined
      this.run.steps[i].artifacts = undefined
    }

    // Reset run status
    this.run.status = 'running'
    this.run.error = undefined
    this.run.completedAt = undefined

    await this.log('info', 'Retrying workflow from step', { 
      retryFromStep: stepIndex,
      stepName: this.run.steps[stepIndex].step.name 
    })
    
    // Reconstruct config from existing steps
    const config: WorkflowConfig = {
      steps: this.run.steps.map(s => s.step)
    }

    // Don't reinitialize - preserve existing run state
    const result = await this.executeWorkflowSteps(config, provider, { resumeFromStep: stepIndex })
    return result
  }

  private async executeWorkflowSteps(config: WorkflowConfig, provider?: LLMDriverLike, options: {
    retries?: number
    resumeFromStep?: number
  } = {}): Promise<WorkflowRun> {
    const { retries = 1, resumeFromStep = 0 } = options

    try {
      for (let i = resumeFromStep; i < config.steps.length; i++) {
        let attempts = 0
        let lastError: Error | null = null

        while (attempts <= retries) {
          try {
            await this.executeStep(i, provider)
            break // Success, move to next step
          } catch (error) {
            lastError = error as Error
            attempts++
            
            if (attempts <= retries) {
              await this.log('warn', `Step failed, retrying (${attempts}/${retries + 1})`, {
                step: i,
                error: lastError.message
              })
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts)) // Exponential backoff
            }
          }
        }

        if (lastError && attempts > retries) {
          this.run.status = 'failed'
          this.run.error = lastError.message
          this.run.completedAt = new Date().toISOString()
          await this.saveMetadata()
          throw lastError
        }
      }

      this.run.status = 'completed'
      this.run.completedAt = new Date().toISOString()
      await this.log('info', 'Workflow completed successfully', {
        duration: Date.now() - new Date(this.run.startedAt).getTime()
      })

    } catch (error) {
      this.run.status = 'failed'
      this.run.error = error instanceof Error ? error.message : String(error)
      this.run.completedAt = new Date().toISOString()
      await this.log('error', 'Workflow failed', { error: this.run.error })
      throw error
    } finally {
      await this.saveMetadata()
    }

    return this.run
  }

  private async loadPatches(): Promise<{ file: string, diff: string }[]> {
    const patchesDir = path.join(this.root, '.codeos', 'patches')
    const patches: { file: string, diff: string }[] = []

    try {
      const files = await fs.readdir(patchesDir)
      for (const file of files.filter(f => f.endsWith('.diff'))) {
        const filePath = path.join(patchesDir, file)
        const diff = await fs.readFile(filePath, 'utf8')
        patches.push({ file: filePath, diff })
      }
    } catch (error) {
      // No patches yet, that's ok
    }

    return patches
  }

  private async log(level: 'info' | 'warn' | 'error', message: string, meta: any = {}): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      runId: this.runId,
      ...meta
    }

    // Append to logs.txt as JSON Lines
    await fs.appendFile(this.logsPath, JSON.stringify(logEntry) + '\n')
  }

  private async saveMetadata(): Promise<void> {
    await fs.writeFile(this.metaPath, JSON.stringify(this.run, null, 2))
  }

  static async loadRun(root: string, runId: string): Promise<WorkflowEngine> {
    const runDir = path.join(root, '.codeos', 'run', runId)
    const metaPath = path.join(runDir, 'meta.json')
    
    const metaData = JSON.parse(await fs.readFile(metaPath, 'utf8'))
    const engine = new WorkflowEngine(root, metaData.workflow)
    engine.run = metaData
    engine.runId = runId
    engine.runDir = runDir
    engine.logsPath = path.join(runDir, 'logs.txt')
    engine.metaPath = path.join(runDir, 'meta.json')
    
    return engine
  }

  static async listRuns(root: string): Promise<WorkflowRun[]> {
    const runsDir = path.join(root, '.codeos', 'run')
    const runs: WorkflowRun[] = []

    try {
      const entries = await fs.readdir(runsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const metaPath = path.join(runsDir, entry.name, 'meta.json')
            const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'))
            runs.push(meta)
          } catch {
            // Skip invalid runs
          }
        }
      }
    } catch {
      // No runs directory yet
    }

    return runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }

  getRunInfo(): WorkflowRun {
    return { ...this.run }
  }

  getRunDir(): string {
    return this.runDir
  }
}

// Default workflow configurations
export const DEFAULT_WORKFLOWS: Record<string, WorkflowConfig> = {
  build: {
    steps: [
      {
        role: 'planner',
        name: 'Plan Generation',
        description: 'Generate implementation plan from blueprint'
      },
      {
        role: 'builder',
        name: 'Code Generation',
        description: 'Generate unified diffs and tests'
      },
      {
        role: 'verifier',
        name: 'Verification',
        description: 'Apply patches and run verification gates'
      },
      {
        role: 'reviewer',
        name: 'Review Summary',
        description: 'Generate PR summary and checklist'
      }
    ]
  }
}
