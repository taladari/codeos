import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface UsageQuota {
  allowed: boolean
  remaining?: number
  limit?: number
  resetAt?: string
  message?: string
  upgradeUrl?: string
}

export interface UsageContext {
  command: string
  userId?: string
  token?: string
  version: string
  metadata?: Record<string, any>
}

export class UsageManager {
  private apiBaseUrl: string
  private fallbackAllow: boolean
  private timeout: number

  constructor(options: {
    apiBaseUrl?: string
    fallbackAllow?: boolean
    timeout?: number
  } = {}) {
    this.apiBaseUrl = options.apiBaseUrl || process.env.CODEOS_API_URL || 'https://api.codeos.dev'
    this.fallbackAllow = options.fallbackAllow ?? true
    this.timeout = options.timeout || 5000
  }

  /**
   * Check if user can execute a command
   * This is called by EVERY command in the CLI
   */
  async checkQuota(context: UsageContext): Promise<UsageQuota> {
    try {
      // Try API first
      const result = await this.checkApiQuota(context)
      if (result) return result
    } catch (error) {
      console.debug('Usage API unavailable:', error instanceof Error ? error.message : String(error))
    }

    // Fallback: Allow execution (for now)
    if (this.fallbackAllow) {
      return {
        allowed: true,
        message: 'Running in community mode'
      }
    }

    // Strict mode: Deny if API unavailable
    return {
      allowed: false,
      message: 'Usage API unavailable. Please check your connection.',
      upgradeUrl: 'https://codeos.dev/status'
    }
  }

  /**
   * Track command execution (telemetry)
   */
  async trackExecution(context: UsageContext, result: 'success' | 'error', duration: number): Promise<void> {
    try {
      await this.sendTelemetry({
        ...context,
        result,
        duration,
        timestamp: new Date().toISOString()
      })
    } catch {
      // Telemetry failures should not break the user experience
    }
  }

  private async checkApiQuota(context: UsageContext): Promise<UsageQuota | null> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.apiBaseUrl}/v1/usage/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': context.token ? `Bearer ${context.token}` : '',
          'User-Agent': `CodeOS CLI/${context.version}`
        },
        body: JSON.stringify({
          command: context.command,
          userId: context.userId,
          metadata: context.metadata
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        if (response.status === 429) {
          const data = await response.json()
          return {
            allowed: false,
            message: data.message || 'Rate limit exceeded',
            upgradeUrl: data.upgradeUrl || 'https://codeos.dev/upgrade'
          }
        }
        return null // Fallback to allow
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async sendTelemetry(data: any): Promise<void> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    try {
      await fetch(`${this.apiBaseUrl}/v1/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `CodeOS CLI/${data.version}`
        },
        body: JSON.stringify(data),
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Get user token from auth system
   */
  async getUserToken(): Promise<string | undefined> {
    try {
      const { GitHubOAuthClient } = await import('./github-auth.js')
      const oauth = new GitHubOAuthClient()
      const status = await oauth.status()
      return status.token || undefined
    } catch {
      return undefined
    }
  }

  /**
   * Get anonymous user ID (for free tier tracking)
   */
  async getAnonymousId(): Promise<string> {
    const configDir = path.join(os.homedir(), '.codeos')
    const idFile = path.join(configDir, 'anonymous-id')

    try {
      return await fs.readFile(idFile, 'utf8')
    } catch {
      // Generate new anonymous ID
      const id = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await fs.mkdir(configDir, { recursive: true })
      await fs.writeFile(idFile, id, 'utf8')
      return id
    }
  }
}

/**
 * Global usage manager instance
 */
export const usageManager = new UsageManager()

/**
 * Decorator for command functions
 */
export function withUsageCheck(command: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function(...args: any[]) {
      const startTime = Date.now()
      const context: UsageContext = {
        command,
        token: await usageManager.getUserToken(),
        userId: await usageManager.getAnonymousId(),
        version: process.env.npm_package_version || '0.1.0'
      }

      // Check quota before execution
      const quota = await usageManager.checkQuota(context)
      
      if (!quota.allowed) {
        console.error(`${quota.message}`)
        if (quota.upgradeUrl) {
          console.info(`💡 Learn more: ${quota.upgradeUrl}`)
        }
        process.exit(1)
      }

      if (quota.message) {
        console.info(`ℹ️ ${quota.message}`)
      }

      try {
        // Execute original command
        const result = await originalMethod.apply(this, args)
        
        // Track successful execution
        await usageManager.trackExecution(context, 'success', Date.now() - startTime)
        
        return result
      } catch (error) {
        // Track failed execution
        await usageManager.trackExecution(context, 'error', Date.now() - startTime)
        throw error
      }
    }

    return descriptor
  }
}
