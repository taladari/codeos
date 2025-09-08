import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkflowEngine, DEFAULT_WORKFLOWS } from './workflow.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'

describe('WorkflowEngine', () => {
  const tmpRoot = path.join(process.cwd(), '.tmp-workflow-test')
  
  beforeEach(async () => {
    try { await fs.rm(tmpRoot, { recursive: true }) } catch {}
    await fs.mkdir(tmpRoot, { recursive: true })
    
    // Create minimal project structure
    await fs.mkdir(path.join(tmpRoot, '.codeos', 'blueprints'), { recursive: true })
    await fs.writeFile(
      path.join(tmpRoot, '.codeos', 'blueprints', 'test.md'), 
      '# Test Blueprint\n\n## Goals\n- Test workflow engine'
    )
  })
  
  afterEach(async () => {
    try { await fs.rm(tmpRoot, { recursive: true }) } catch {}
  })

  it('creates structured run artifacts', async () => {
    const engine = new WorkflowEngine(tmpRoot, 'build')
    const config = DEFAULT_WORKFLOWS.build
    
    await engine.initialize(config)
    
    // Check run directory was created
    const runDir = engine.getRunDir()
    expect(await fs.stat(runDir)).toBeTruthy()
    
    // Check meta.json exists
    const metaPath = path.join(runDir, 'meta.json')
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'))
    expect(meta.workflow).toBe('build')
    expect(meta.status).toBe('running')
    expect(meta.steps).toHaveLength(4)
    
    // Check logs.txt exists
    const logsPath = path.join(runDir, 'logs.txt')
    const logs = await fs.readFile(logsPath, 'utf8')
    expect(logs).toContain('Workflow build started')
  })

  it('tracks step progress and timing', async () => {
    const engine = new WorkflowEngine(tmpRoot, 'build')
    const config = DEFAULT_WORKFLOWS.build
    
    await engine.initialize(config)
    
    // Execute first step
    await engine.executeStep(0)
    
    const runInfo = engine.getRunInfo()
    const step0 = runInfo.steps[0]
    
    expect(step0.status).toBe('completed')
    expect(step0.duration).toBeGreaterThan(0)
    expect(step0.startedAt).toBeTruthy()
    expect(step0.completedAt).toBeTruthy()
    expect(step0.artifacts).toHaveLength(1)
    expect(step0.artifacts![0]).toContain('plan')
  })

  it('can list workflow runs', async () => {
    // Create a few runs
    const engine1 = new WorkflowEngine(tmpRoot, 'build')
    await engine1.initialize(DEFAULT_WORKFLOWS.build)
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const engine2 = new WorkflowEngine(tmpRoot, 'build')  
    await engine2.initialize(DEFAULT_WORKFLOWS.build)
    
    const runs = await WorkflowEngine.listRuns(tmpRoot)
    expect(runs.length).toBeGreaterThanOrEqual(2)
    expect(runs[0].workflow).toBe('build')
  })

  it('can load and resume a workflow run', async () => {
    const engine1 = new WorkflowEngine(tmpRoot, 'build')
    await engine1.initialize(DEFAULT_WORKFLOWS.build)
    
    // Execute first step only
    await engine1.executeStep(0)
    
    const runId = engine1.getRunInfo().id
    
    // Load the run in a new engine instance
    const engine2 = await WorkflowEngine.loadRun(tmpRoot, runId)
    const runInfo = engine2.getRunInfo()
    
    expect(runInfo.id).toBe(runId)
    expect(runInfo.steps[0].status).toBe('completed')
    expect(runInfo.steps[1].status).toBe('pending')
  })

  it('handles step failures and retries', async () => {
    const engine = new WorkflowEngine(tmpRoot, 'build')
    
    // Create a mock workflow engine that throws during executeRole
    const _originalExecuteRole = engine.executeRole
    engine.executeRole = async () => {
      throw new Error('Test failure')
    }
    
    const config = {
      steps: [{
        role: 'planner' as const,
        name: 'Test Step',
        description: 'Test step that will fail'
      }]
    }
    
    await engine.initialize(config)
    
    // Should fail after retries
    await expect(
      engine.executeWorkflow(config, undefined, { retries: 0 })
    ).rejects.toThrow('Test failure')
    
    const runInfo = engine.getRunInfo()
    expect(runInfo.status).toBe('failed')
    expect(runInfo.steps[0].status).toBe('failed')
    expect(runInfo.steps[0].error).toBe('Test failure')
  })

  it('can retry from specific step', async () => {
    const engine = new WorkflowEngine(tmpRoot, 'build')
    const config = DEFAULT_WORKFLOWS.build
    
    await engine.initialize(config)
    
    // Execute first two steps
    await engine.executeStep(0)
    await engine.executeStep(1)
    
    // Retry from step 1 (builder)
    const result = await engine.retryFromStep(1)
    
    expect(result.status).toBe('completed')
    expect(result.steps[0].status).toBe('completed') // Step 0 should remain completed
    expect(result.steps[1].status).toBe('completed') // Step 1 should be re-executed
    expect(result.steps[2].status).toBe('completed') // Step 2 should be executed
    expect(result.steps[3].status).toBe('completed') // Step 3 should be executed
  })

  it('validates step index for retry', async () => {
    const engine = new WorkflowEngine(tmpRoot, 'build')
    await engine.initialize(DEFAULT_WORKFLOWS.build)
    
    // Test invalid step indices
    await expect(engine.retryFromStep(-1)).rejects.toThrow('Invalid step index')
    await expect(engine.retryFromStep(10)).rejects.toThrow('Invalid step index')
  })

  it('resets step state when retrying', async () => {
    const engine = new WorkflowEngine(tmpRoot, 'build')
    const config = {
      steps: [{
        role: 'planner' as const,
        name: 'Test Step',
        description: 'Test step'
      }]
    }
    
    await engine.initialize(config)
    await engine.executeStep(0)
    
    // Verify step is completed
    let runInfo = engine.getRunInfo()
    expect(runInfo.steps[0].status).toBe('completed')
    const originalDuration = runInfo.steps[0].duration
    expect(originalDuration).toBeGreaterThan(0)
    expect(runInfo.steps[0].artifacts).toBeTruthy()
    
    // Small delay to ensure different timing
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Retry from step 0
    await engine.retryFromStep(0)
    
    // Verify step was re-executed (status should be completed, but timing may differ)
    runInfo = engine.getRunInfo()
    expect(runInfo.steps[0].status).toBe('completed')
    expect(runInfo.steps[0].duration).toBeGreaterThan(0)
    expect(runInfo.steps[0].artifacts).toBeTruthy()
    
    // The step should have been re-executed (new timing)
    expect(runInfo.status).toBe('completed')
  })
})
