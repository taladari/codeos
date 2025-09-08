import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface CodeOSCloudConfig {
  apiUrl?: string
  mode?: 'auto' | 'backend' | 'local'
  fallbackAllow?: boolean
  telemetryEnabled?: boolean
}

export interface CodeOSLocalConfig {
  version: string
  cloud: CodeOSCloudConfig
  user?: {
    id: string
    plan: 'free' | 'pro' | 'team' | 'enterprise'
    token?: string
  }
}

export class ConfigManager {
  private configPath: string
  private config: CodeOSLocalConfig | null = null

  constructor() {
    this.configPath = path.join(os.homedir(), '.codeos', 'config.json')
  }

  async getConfig(): Promise<CodeOSLocalConfig> {
    if (this.config) return this.config

    try {
      const content = await fs.readFile(this.configPath, 'utf8')
      this.config = JSON.parse(content)
    } catch {
      // Create default config
      this.config = {
        version: '0.1.0',
        cloud: {
          apiUrl: process.env.CODEOS_API_URL || 'https://api.codeos.dev',
          mode: 'auto', // auto, backend, local
          fallbackAllow: true,
          telemetryEnabled: true
        }
      }
      await this.saveConfig()
    }

    return this.config!
  }

  async updateConfig(updates: Partial<CodeOSLocalConfig>): Promise<void> {
    const config = await this.getConfig()
    this.config = { ...config, ...updates }
    await this.saveConfig()
  }

  async updateCloudConfig(updates: Partial<CodeOSCloudConfig>): Promise<void> {
    const config = await this.getConfig()
    this.config = {
      ...config,
      cloud: { ...config.cloud, ...updates }
    }
    await this.saveConfig()
  }

  private async saveConfig(): Promise<void> {
    const dir = path.dirname(this.configPath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2))
  }

  /**
   * Get effective mode (resolves 'auto')
   */
  async getEffectiveMode(): Promise<'backend' | 'local'> {
    const config = await this.getConfig()
    
    if (config.cloud.mode === 'backend') return 'backend'
    if (config.cloud.mode === 'local') return 'local'
    
    // Auto mode: check if backend is available
    try {
      const { CodeOSBackend } = await import('./github-backend.js')
      const backend = new CodeOSBackend({ apiBaseUrl: config.cloud.apiUrl })
      const available = await backend.isAvailable()
      return available ? 'backend' : 'local'
    } catch {
      return 'local'
    }
  }
}

export const configManager = new ConfigManager()
