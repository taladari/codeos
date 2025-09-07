import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

export interface GitHubConfig {
  repo?: string // format: "owner/repo" - auto-detected if not provided
  token?: string
  baseUrl?: string // for GitHub Enterprise
}

export interface PullRequestOptions {
  title: string
  body: string
  head: string // branch name
  base: string // target branch, usually 'main'
  draft?: boolean
}

export interface StatusCheckOptions {
  context: string // e.g., "codeos/lint", "codeos/tests"
  state: 'pending' | 'success' | 'error' | 'failure'
  description: string
  target_url?: string
}

export interface GitHubPullRequest {
  number: number
  html_url: string
  head: {
    sha: string
    ref: string
  }
}

export class GitHubService {
  private config: GitHubConfig
  private token: string
  private repo: string

  constructor(config: GitHubConfig) {
    this.config = config
    
    // Auto-detect repository from git remote if not provided
    this.repo = config.repo || this.detectGitHubRepo()
    
    // Token detection will be async, so we'll do it in methods that need it
    this.token = '' // Will be set when needed
  }

  private detectGitHubRepo(): string {
    try {
      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
      
      // Handle both SSH and HTTPS formats
      // SSH: git@github.com:owner/repo.git
      // HTTPS: https://github.com/owner/repo.git
      const sshMatch = remoteUrl.match(/git@github\.com:([^/]+\/[^/.]+)/)
      const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^/]+\/[^/.]+)/)
      
      const match = sshMatch || httpsMatch
      if (match) {
        return match[1].replace(/\.git$/, '')
      }
      
      throw new Error(`Could not parse GitHub repository from remote URL: ${remoteUrl}`)
    } catch (error) {
      throw new Error('Could not detect GitHub repository. Make sure you\'re in a git repository with GitHub remote.')
    }
  }

  private async detectGitHubToken(configToken?: string): Promise<string> {
    // Use the enhanced token detection from github-auth
    try {
      const { detectGitHubToken } = await import('./github-auth.js')
      return await detectGitHubToken()
    } catch (error) {
      // Fallback to basic detection
      const sources = [
        configToken,
        process.env.GITHUB_TOKEN,
        process.env.GH_TOKEN,
        this.tryGitHubCLIToken()
      ]

      for (const token of sources) {
        if (token && token.trim()) {
          return token.trim()
        }
      }

      throw new Error('No GitHub token found. Run: codeos auth login')
    }
  }

  private tryGitHubCLIToken(): string {
    try {
      // Check if GitHub CLI is available and authenticated
      execSync('gh auth status', { stdio: 'ignore' })
      return execSync('gh auth token', { encoding: 'utf8' }).trim()
    } catch {
      return ''
    }
  }

  private get apiUrl(): string {
    return this.config.baseUrl ? `${this.config.baseUrl}/api/v3` : 'https://api.github.com'
  }

  private async ensureToken(): Promise<void> {
    if (!this.token) {
      this.token = await this.detectGitHubToken(this.config.token)
    }
  }

  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    await this.ensureToken()
    
    const url = `${this.apiUrl}${endpoint}`
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'CodeOS/1.0',
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  // Git operations using system git (inherits user's auth)
  getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim()
    } catch (error) {
      throw new Error(`Failed to get current git branch: ${error}`)
    }
  }

  getCurrentCommitSha(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
    } catch (error) {
      throw new Error(`Failed to get current commit SHA: ${error}`)
    }
  }

  createBranch(branchName: string, baseBranch: string = 'main'): void {
    try {
      // Fetch latest from remote
      execSync('git fetch origin', { stdio: 'pipe' })
      
      // Create and checkout new branch from remote base
      execSync(`git checkout -b ${branchName} origin/${baseBranch}`, { stdio: 'pipe' })
    } catch (error) {
      throw new Error(`Failed to create branch ${branchName}: ${error}`)
    }
  }

  commitChanges(message: string, files?: string[]): string {
    try {
      if (files && files.length > 0) {
        // Add specific files
        for (const file of files) {
          execSync(`git add "${file}"`, { stdio: 'pipe' })
        }
      } else {
        // Add all changes
        execSync('git add .', { stdio: 'pipe' })
      }
      
      // Check if there are changes to commit
      try {
        execSync('git diff --cached --quiet', { stdio: 'pipe' })
        throw new Error('No changes to commit')
      } catch (error) {
        // Good - there are changes to commit (git diff --quiet exits with 1 when there are differences)
      }
      
      // Commit changes
      const escapedMessage = message.replace(/"/g, '\\"')
      execSync(`git commit -m "${escapedMessage}"`, { stdio: 'pipe' })
      
      // Return commit SHA
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error}`)
    }
  }

  pushBranch(branchName: string): void {
    try {
      execSync(`git push -u origin ${branchName}`, { stdio: 'pipe' })
    } catch (error) {
      throw new Error(`Failed to push branch ${branchName}. Check your git authentication: ${error}`)
    }
  }

  // GitHub API operations (require token)
  async createPullRequest(options: PullRequestOptions): Promise<GitHubPullRequest> {
    const [owner, repo] = this.repo.split('/')
    
    const body = {
      title: options.title,
      body: options.body,
      head: options.head,
      base: options.base,
      draft: options.draft || false
    }

    return this.apiRequest(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async createStatusCheck(sha: string, options: StatusCheckOptions): Promise<void> {
    const [owner, repo] = this.repo.split('/')
    
    const body = {
      state: options.state,
      context: options.context,
      description: options.description,
      target_url: options.target_url
    }

    await this.apiRequest(`/repos/${owner}/${repo}/statuses/${sha}`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async addPullRequestComment(prNumber: number, body: string): Promise<void> {
    const [owner, repo] = this.repo.split('/')
    
    await this.apiRequest(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body })
    })
  }

  async checkRepoAccess(): Promise<boolean> {
    try {
      const [owner, repo] = this.repo.split('/')
      await this.apiRequest(`/repos/${owner}/${repo}`)
      return true
    } catch {
      return false
    }
  }

  getRepo(): string {
    return this.repo
  }
}

export interface CodeOSPROptions {
  title: string
  branchName?: string
  baseBranch?: string
  draft?: boolean
  runId?: string
  workflowName?: string
}

export class CodeOSGitHubIntegration {
  private github: GitHubService
  private root: string

  constructor(github: GitHubService, root: string) {
    this.github = github
    this.root = root
  }

  async createCodeOSPullRequest(options: CodeOSPROptions): Promise<{
    pr: GitHubPullRequest
    branch: string
    commit: string
  }> {
    const {
      title,
      branchName = `codeos/${Date.now()}`,
      baseBranch = 'main',
      draft = false,
      runId,
      workflowName = 'build'
    } = options

    // Create branch using git
    this.github.createBranch(branchName, baseBranch)

    // Apply patches to working directory
    const patches = await this.loadPatches()
    const appliedFiles: string[] = []

    for (const patch of patches) {
      const files = await this.applyPatch(patch)
      appliedFiles.push(...files)
    }

    if (appliedFiles.length === 0) {
      throw new Error('No changes to commit')
    }

    // Commit changes using git
    const commitMessage = `${title}\n\nGenerated by CodeOS workflow: ${workflowName}${runId ? `\nRun ID: ${runId}` : ''}`
    const commitSha = this.github.commitChanges(commitMessage, appliedFiles)

    // Push branch using git
    this.github.pushBranch(branchName)

    // Create PR body with artifacts
    const prBody = await this.generatePRBody(runId)

    // Create PR using GitHub API
    const pr = await this.github.createPullRequest({
      title,
      body: prBody,
      head: branchName,
      base: baseBranch,
      draft
    })

    // Create status checks using GitHub API
    await this.createStatusChecks(commitSha, runId)

    return {
      pr,
      branch: branchName,
      commit: commitSha
    }
  }

  private async loadPatches(): Promise<Array<{ file: string, content: string }>> {
    const patchesDir = path.join(this.root, '.codeos', 'patches')
    const patches: Array<{ file: string, content: string }> = []

    try {
      const files = await fs.readdir(patchesDir)
      for (const file of files.filter(f => f.endsWith('.diff'))) {
        const filePath = path.join(patchesDir, file)
        const content = await fs.readFile(filePath, 'utf8')
        patches.push({ file, content })
      }
    } catch (error) {
      // No patches directory
    }

    return patches
  }

  private async applyPatch(patch: { file: string, content: string }): Promise<string[]> {
    // Simple patch application - for now just handle new files
    const lines = patch.content.split('\n')
    const appliedFiles: string[] = []

    let currentFile: string | null = null
    let currentContent: string[] = []
    let inHunk = false

    for (const line of lines) {
      if (line.startsWith('+++ ')) {
        // New file
        currentFile = line.replace(/^\+\+\+\s+[ab]\//, '').trim()
        currentContent = []
        inHunk = false
      } else if (line.startsWith('@@')) {
        inHunk = true
      } else if (inHunk && line.startsWith('+') && !line.startsWith('+++')) {
        // Addition
        currentContent.push(line.slice(1))
      } else if (line === '' && currentFile && currentContent.length > 0) {
        // End of file, write it
        const targetPath = path.join(this.root, currentFile)
        await fs.mkdir(path.dirname(targetPath), { recursive: true })
        await fs.writeFile(targetPath, currentContent.join('\n') + '\n')
        appliedFiles.push(currentFile)
        
        currentFile = null
        currentContent = []
        inHunk = false
      }
    }

    // Handle last file if no trailing empty line
    if (currentFile && currentContent.length > 0) {
      const targetPath = path.join(this.root, currentFile)
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.writeFile(targetPath, currentContent.join('\n') + '\n')
      appliedFiles.push(currentFile)
    }

    return appliedFiles
  }

  private async generatePRBody(runId?: string): Promise<string> {
    let body = ''

    // Include PR summary if available
    try {
      const summaryPath = path.join(this.root, '.codeos', 'review', 'PR_SUMMARY.md')
      const summary = await fs.readFile(summaryPath, 'utf8')
      body += summary + '\n\n'
    } catch {
      // No summary available
    }

    // Add CodeOS metadata
    body += '---\n'
    body += '*Generated by CodeOS*\n\n'

    if (runId) {
      body += `**Run ID:** \`${runId}\`\n\n`
    }

    // Add links to reports
    const reportsDir = path.join(this.root, '.codeos', 'reports')
    try {
      const reportFiles = await fs.readdir(reportsDir)
      if (reportFiles.length > 0) {
        body += '**Verification Reports:**\n'
        for (const file of reportFiles.filter(f => f.endsWith('.json'))) {
          const reportPath = path.join(reportsDir, file)
          const report = JSON.parse(await fs.readFile(reportPath, 'utf8'))
          const status = report.ok ? '✅' : '❌'
          body += `- ${status} ${file.replace('.json', '')}\n`
        }
        body += '\n'
      }
    } catch {
      // No reports
    }

    return body
  }

  private async createStatusChecks(commitSha: string, runId?: string): Promise<void> {
    const reportsDir = path.join(this.root, '.codeos', 'reports')
    
    try {
      const reportFiles = await fs.readdir(reportsDir)
      
      for (const file of reportFiles.filter(f => f.endsWith('.json'))) {
        const reportPath = path.join(reportsDir, file)
        const report = JSON.parse(await fs.readFile(reportPath, 'utf8'))
        const gateName = file.replace('.json', '')
        
        await this.github.createStatusCheck(commitSha, {
          context: `codeos/${gateName}`,
          state: report.ok ? 'success' : 'failure',
          description: this.getGateDescription(gateName, report),
          target_url: runId ? `${this.root}/.codeos/run/${runId}` : undefined
        })
      }
    } catch (error) {
      console.warn('Failed to create status checks:', error)
    }
  }

  private getGateDescription(gateName: string, report: any): string {
    switch (gateName) {
      case 'lint':
        return report.ok ? 'Linting passed' : `Linting failed: ${report.errors || 0} errors`
      case 'tests':
        return report.ok 
          ? `Tests passed: ${report.passed || 0} passed`
          : `Tests failed: ${report.failed || 0} failed, ${report.passed || 0} passed`
      case 'apply':
        return report.ok 
          ? `Applied ${(report.applied || []).length} files`
          : 'Failed to apply patches'
      default:
        return report.ok ? `${gateName} passed` : `${gateName} failed`
    }
  }
}