import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitHubService, CodeOSGitHubIntegration } from './github.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn()
}))

// Mock fetch
global.fetch = vi.fn()

describe('GitHubService', () => {
  const mockConfig = {
    repo: 'test-owner/test-repo',
    token: 'test-token'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GITHUB_TOKEN = 'test-token'
  })

  afterEach(() => {
    delete process.env.GITHUB_TOKEN
  })

  it('constructs with valid config', () => {
    const github = new GitHubService(mockConfig)
    expect(github).toBeDefined()
  })

  it('throws error without token', () => {
    delete process.env.GITHUB_TOKEN
    expect(() => new GitHubService({ repo: 'owner/repo' })).toThrow('GitHub token required')
  })

  it('uses environment token when not provided in config', () => {
    const github = new GitHubService({ repo: 'owner/repo' })
    expect(github).toBeDefined()
  })

  it('makes API requests with proper headers', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ test: 'data' })
    }
    ;(global.fetch as any).mockResolvedValue(mockResponse)

    const github = new GitHubService(mockConfig)
    await github.checkRepoAccess()

    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-owner/test-repo',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeOS/1.0'
        })
      })
    )
  })

  it('handles API errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found')
    }
    ;(global.fetch as any).mockResolvedValue(mockResponse)

    const github = new GitHubService(mockConfig)
    
    await expect(github.checkRepoAccess()).resolves.toBe(false)
  })

  it('creates pull request with correct payload', async () => {
    const mockPR = {
      number: 123,
      html_url: 'https://github.com/test-owner/test-repo/pull/123',
      head: { sha: 'abc123', ref: 'feature-branch' }
    }
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve(mockPR)
    }
    ;(global.fetch as any).mockResolvedValue(mockResponse)

    const github = new GitHubService(mockConfig)
    const result = await github.createPullRequest({
      title: 'Test PR',
      body: 'Test description',
      head: 'feature-branch',
      base: 'main'
    })

    expect(result).toEqual(mockPR)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-owner/test-repo/pulls',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Test PR',
          body: 'Test description',
          head: 'feature-branch',
          base: 'main',
          draft: false
        })
      })
    )
  })

  it('creates status checks with correct payload', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({})
    }
    ;(global.fetch as any).mockResolvedValue(mockResponse)

    const github = new GitHubService(mockConfig)
    await github.createStatusCheck('abc123', {
      context: 'codeos/test',
      state: 'success',
      description: 'Test passed'
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-owner/test-repo/statuses/abc123',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          state: 'success',
          context: 'codeos/test',
          description: 'Test passed',
          target_url: undefined
        })
      })
    )
  })
})

describe('CodeOSGitHubIntegration', () => {
  const tmpRoot = path.join(process.cwd(), '.tmp-github-test')
  let mockGitHub: GitHubService
  let integration: CodeOSGitHubIntegration

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup test directory
    try { await fs.rm(tmpRoot, { recursive: true }) } catch {}
    await fs.mkdir(tmpRoot, { recursive: true })
    
    // Mock GitHub service
    mockGitHub = {
      checkRepoAccess: vi.fn().mockResolvedValue(true),
      createBranch: vi.fn().mockResolvedValue(undefined),
      commitChanges: vi.fn().mockResolvedValue('abc123'),
      pushBranch: vi.fn().mockResolvedValue(undefined),
      createPullRequest: vi.fn().mockResolvedValue({
        number: 123,
        html_url: 'https://github.com/test/repo/pull/123',
        head: { sha: 'abc123', ref: 'test-branch' }
      }),
      createStatusCheck: vi.fn().mockResolvedValue(undefined)
    } as any

    integration = new CodeOSGitHubIntegration(mockGitHub, tmpRoot)
  })

  afterEach(async () => {
    try { await fs.rm(tmpRoot, { recursive: true }) } catch {}
  })

  it('creates PR with patches and reports', async () => {
    // Setup test artifacts
    await fs.mkdir(path.join(tmpRoot, '.codeos', 'patches'), { recursive: true })
    await fs.mkdir(path.join(tmpRoot, '.codeos', 'reports'), { recursive: true })
    await fs.mkdir(path.join(tmpRoot, '.codeos', 'review'), { recursive: true })

    // Create test patch
    const testPatch = `--- /dev/null
+++ a/test.ts
@@
+export function test() {
+  return 'hello'
+}`
    await fs.writeFile(path.join(tmpRoot, '.codeos', 'patches', 'test.diff'), testPatch)

    // Create test reports
    await fs.writeFile(
      path.join(tmpRoot, '.codeos', 'reports', 'lint.json'),
      JSON.stringify({ ok: true, errors: 0 })
    )
    await fs.writeFile(
      path.join(tmpRoot, '.codeos', 'reports', 'tests.json'),
      JSON.stringify({ ok: true, passed: 2, failed: 0 })
    )

    // Create PR summary
    await fs.writeFile(
      path.join(tmpRoot, '.codeos', 'review', 'PR_SUMMARY.md'),
      '# Test Summary\n\nThis is a test PR.'
    )

    const result = await integration.createCodeOSPullRequest({
      title: 'Test PR',
      runId: 'test-run-123'
    })

    expect(result.pr.number).toBe(123)
    expect(mockGitHub.createBranch).toHaveBeenCalled()
    expect(mockGitHub.commitChanges).toHaveBeenCalled()
    expect(mockGitHub.pushBranch).toHaveBeenCalled()
    expect(mockGitHub.createPullRequest).toHaveBeenCalled()
    expect(mockGitHub.createStatusCheck).toHaveBeenCalledTimes(2) // lint and tests
  })

  it('handles empty patches gracefully', async () => {
    await fs.mkdir(path.join(tmpRoot, '.codeos'), { recursive: true })

    await expect(
      integration.createCodeOSPullRequest({
        title: 'Empty PR'
      })
    ).rejects.toThrow('No changes to commit')
  })

  it('generates proper PR body with artifacts', async () => {
    // Setup minimal artifacts
    await fs.mkdir(path.join(tmpRoot, '.codeos', 'patches'), { recursive: true })
    await fs.mkdir(path.join(tmpRoot, '.codeos', 'reports'), { recursive: true })
    await fs.mkdir(path.join(tmpRoot, '.codeos', 'review'), { recursive: true })

    const testPatch = `--- /dev/null
+++ a/minimal.ts
@@
+// test`
    await fs.writeFile(path.join(tmpRoot, '.codeos', 'patches', 'test.diff'), testPatch)

    await fs.writeFile(
      path.join(tmpRoot, '.codeos', 'review', 'PR_SUMMARY.md'),
      '# Test Summary'
    )
    await fs.writeFile(
      path.join(tmpRoot, '.codeos', 'reports', 'lint.json'),
      JSON.stringify({ ok: false, errors: 3 })
    )

    await integration.createCodeOSPullRequest({
      title: 'Test PR',
      runId: 'test-run-456'
    })

    // Verify PR body includes summary and metadata
    expect(mockGitHub.createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('# Test Summary')
      })
    )
    expect(mockGitHub.createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Generated by CodeOS')
      })
    )
    expect(mockGitHub.createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('test-run-456')
      })
    )
  })
})
