import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface BackendPROptions {
  title: string
  branchName?: string
  baseBranch?: string
  draft?: boolean
  runId: string
  workflowName?: string
}

export interface BackendPRResult {
  pr: {
    number: number
    html_url: string
    head: { sha: string; ref: string }
  }
  branch: string
  commit: string
  mode: 'backend' | 'local'
}

/**
 * Backend-controlled PR creation (fully enforceable)
 * Falls back to local mode if backend unavailable
 */
export class CodeOSBackend {
  private apiBaseUrl: string
  private timeout: number

  constructor(options: { apiBaseUrl?: string; timeout?: number } = {}) {
    this.apiBaseUrl = options.apiBaseUrl || process.env.CODEOS_API_URL || 'https://api.codeos.dev'
    this.timeout = options.timeout || 30000
  }

  /**
   * Create PR via backend (preferred - fully enforceable)
   */
  async createPullRequest(
    token: string,
    repo: string,
    options: BackendPROptions,
    artifacts: { patches: string[]; reports: any[] }
  ): Promise<BackendPRResult> {
    try {
      const result = await this.createBackendPR(token, repo, options, artifacts)
      return { ...result, mode: 'backend' }
    } catch (error) {
      console.warn('Backend PR creation failed, falling back to local mode:', error instanceof Error ? error.message : String(error))
      
      // Fallback to local PR creation (community mode)
      const { GitHubService, CodeOSGitHubIntegration } = await import('./github.js')
      const github = new GitHubService({ repo })
      const integration = new CodeOSGitHubIntegration(github, process.cwd())
      
      const result = await integration.createCodeOSPullRequest({
        title: options.title,
        branchName: options.branchName,
        baseBranch: options.baseBranch,
        draft: options.draft,
        runId: options.runId,
        workflowName: options.workflowName
      })
      
      return { ...result, mode: 'local' }
    }
  }

  private async createBackendPR(
    token: string,
    repo: string,
    options: BackendPROptions,
    artifacts: { patches: string[]; reports: any[] }
  ): Promise<Omit<BackendPRResult, 'mode'>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.apiBaseUrl}/v1/github/pr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': `CodeOS CLI`
        },
        body: JSON.stringify({
          repo,
          ...options,
          artifacts
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Backend PR creation failed (${response.status}): ${error}`)
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Check if backend is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.apiBaseUrl}/health`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * Enhanced GitHub integration that prefers backend
 */
export class EnhancedGitHubIntegration {
  private backend: CodeOSBackend
  private root: string

  constructor(root: string) {
    this.backend = new CodeOSBackend()
    this.root = root
  }

  async createPullRequest(
    githubConfig: { repo?: string },
    options: BackendPROptions
  ): Promise<BackendPRResult> {
    // Get user token
    const { GitHubOAuthClient } = await import('./github-auth.js')
    const oauth = new GitHubOAuthClient()
    const status = await oauth.status()
    
    if (!status.authenticated || !status.token) {
      throw new Error('GitHub authentication required. Run: codeos auth login')
    }

    // Auto-detect repo if not provided
    let repo = githubConfig.repo
    if (!repo) {
      const { GitHubService } = await import('./github.js')
      const github = new GitHubService({})
      repo = github.getRepo()
    }

    // Load artifacts
    const artifacts = await this.loadArtifacts()

    // Try backend first, fallback to local
    const result = await this.backend.createPullRequest(
      status.token,
      repo,
      options,
      artifacts
    )

    // Show mode to user
    if (result.mode === 'backend') {
      console.info('🚀 PR created via CodeOS Backend (enhanced features enabled)')
    } else {
      console.info('🏠 PR created locally (community mode)')
      console.info('💡 Enhanced features available with CodeOS Pro: codeos upgrade')
    }

    return result
  }

  private async loadArtifacts(): Promise<{ patches: string[]; reports: any[] }> {
    const patches: string[] = []
    const reports: any[] = []

    // Load patches
    try {
      const patchesDir = path.join(this.root, '.codeos', 'patches')
      const files = await fs.readdir(patchesDir)
      for (const file of files.filter(f => f.endsWith('.diff'))) {
        const content = await fs.readFile(path.join(patchesDir, file), 'utf8')
        patches.push(content)
      }
    } catch {
      // No patches
    }

    // Load reports
    try {
      const reportsDir = path.join(this.root, '.codeos', 'reports')
      const files = await fs.readdir(reportsDir)
      for (const file of files.filter(f => f.endsWith('.json'))) {
        const content = await fs.readFile(path.join(reportsDir, file), 'utf8')
        reports.push(JSON.parse(content))
      }
    } catch {
      // No reports
    }

    return { patches, reports }
  }
}
