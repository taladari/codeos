import { promises as fs } from 'node:fs'
import path from 'node:path'
import { WorkflowEngine, GitHubService, type GitHubConfig } from 'codeos-core'
import { logger } from './index.js'

export async function createPullRequest(runId: string, options: {
  title?: string
  branchName?: string
  baseBranch?: string
  draft?: boolean
} = {}, cwd?: string): Promise<void> {
  const root = cwd ?? await (await import('./index.js')).findProjectRoot()
  
  try {
    logger.info(`🚀 Creating GitHub Pull Request for run: ${runId}`)
    
    // Load the workflow run
    const engine = await WorkflowEngine.loadRun(root, runId)
    const runInfo = engine.getRunInfo()
    
    // Check if workflow is completed
    if (runInfo.status !== 'completed') {
      logger.info(`⚠️ Warning: Workflow status is '${runInfo.status}', not 'completed'`)
    }
    
    // Create GitHub service (auto-detects repo and token)
    let githubConfig: GitHubConfig = {}
    
    // Try to load repo from config, but it's optional now (auto-detection)
    try {
      const { loadConfig } = await import('codeos-core')
      const config = await loadConfig(root)
      if (config.integrations?.github?.repo) {
        githubConfig.repo = config.integrations.github.repo
      }
    } catch {
      // Config not available, will auto-detect
    }
    
    // Create PR
    const result = await engine.createPullRequest(githubConfig, options)
    
    logger.info(`✅ Pull Request created successfully!`)
    logger.info(`🔗 PR URL: ${result.pr.html_url}`)
    logger.info(`🌿 Branch: ${result.branch}`)
    logger.info(`📝 PR #${result.pr.number}`)
    
    // Show summary of what was included
    const completedSteps = runInfo.steps?.filter(s => s.status === 'completed').length || 0
    const totalSteps = runInfo.steps?.length || 0
    logger.info(`📊 Included ${completedSteps}/${totalSteps} completed workflow steps`)
    
    if (runInfo.steps) {
      logger.info(`📋 Workflow steps:`)
      for (const [i, step] of runInfo.steps.entries()) {
        const status = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏸️'
        logger.info(`  ${status} Step ${i + 1}: ${step.step.name}`)
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Provide specific guidance based on error type
    if (errorMessage.includes('GitHub token') || errorMessage.includes('No access to GitHub repository')) {
      logger.error(`❌ GitHub authentication required`)
      logger.info(`\n💡 Quick setup options:`)
      logger.info(`  1. OAuth (recommended): codeos auth login`)
      logger.info(`  2. GitHub CLI: gh auth login`)
      logger.info(`  3. Environment: export GITHUB_TOKEN="your_token"`)
      logger.info(`  4. Get token: https://github.com/settings/tokens`)
      logger.info(`     Required scopes: repo, workflow`)
      
    } else if (errorMessage.includes('git')) {
      logger.error(`❌ Git operation failed: ${errorMessage}`)
      logger.info(`\n💡 This usually means:`)
      logger.info(`  1. Git authentication not set up`)
      logger.info(`  2. No push access to repository`)
      logger.info(`  3. Try: git push origin main (to test)`)
      
    } else if (errorMessage.includes('repository')) {
      logger.error(`❌ Repository detection failed: ${errorMessage}`)
      logger.info(`\n💡 Make sure you're in a git repository with GitHub remote:`)
      logger.info(`  git remote -v`)
      logger.info(`  git remote add origin git@github.com:user/repo.git`)
      
    } else {
      logger.error(`❌ Failed to create PR: ${errorMessage}`)
    }
    
    throw error
  }
}

export async function checkGitHubSetup(cwd?: string): Promise<void> {
  const root = cwd ?? await (await import('./index.js')).findProjectRoot()
  
  logger.info(`🔍 Checking GitHub setup...`)
  
  try {
    // Test git repository
    const { execSync } = await import('node:child_process')
    
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' })
      logger.info(`✅ Git repository detected`)
    } catch {
      logger.info(`❌ Not in a git repository`)
      return
    }
    
    // Test GitHub remote
    try {
      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
      if (remoteUrl.includes('github.com')) {
        logger.info(`✅ GitHub remote: ${remoteUrl}`)
      } else {
        logger.info(`⚠️ Remote is not GitHub: ${remoteUrl}`)
      }
    } catch {
      logger.info(`❌ No git remote 'origin' configured`)
      return
    }
    
    // Test GitHub service creation
    try {
      const { GitHubService } = await import('codeos-core')
      const github = new GitHubService({})
      const repo = github.getRepo()
      logger.info(`✅ Repository detected: ${repo}`)
      
      // Test API access
      const hasAccess = await github.checkRepoAccess()
      if (hasAccess) {
        logger.info(`✅ GitHub API access verified`)
      } else {
        logger.info(`❌ No GitHub API access (check token permissions)`)
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('token')) {
        logger.info(`❌ GitHub token not found`)
        logger.info(`💡 Setup: gh auth login OR export GITHUB_TOKEN="..."`);
      } else {
        logger.info(`❌ GitHub setup failed: ${errorMessage}`)
      }
    }
    
  } catch (error) {
    logger.error(`Failed to check GitHub setup: ${error}`)
  }
}
