import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import open from 'open'

// Lazy keytar loading for secure credential storage
let keytar: typeof import('keytar') | null = null
let keytarLoadAttempted = false

async function getKeytar(): Promise<typeof import('keytar') | null> {
  if (!keytarLoadAttempted) {
    keytarLoadAttempted = true
    try {
      keytar = await import('keytar')
    } catch {
      // keytar not available (e.g., in CI environments without native libraries)
      console.debug('keytar not available, using file-based token storage')
      keytar = null
    }
  }
  return keytar
}

// GitHub OAuth Device Flow interfaces
interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

interface TokenResponse {
  access_token: string
  token_type: string
  scope: string
  error?: string
  error_description?: string
}

interface GitHubUser {
  login: string
  name: string
  email: string
  avatar_url: string
}

export interface AuthStatus {
  authenticated: boolean
  user?: GitHubUser
  scopes?: string[]
  token?: string
}

export class GitHubOAuthClient {
  // CodeOS GitHub OAuth App - replace with your registered client ID
  private readonly clientId = process.env.CODEOS_GITHUB_CLIENT_ID || 'Ov23liuHwu1J4wy3vIUp' // Your actual Client ID
  private readonly serviceName = 'codeos-github'
  private readonly accountName = 'oauth-token'
  private readonly requiredScopes = ['repo', 'workflow', 'user:email']

  /**
   * Start the OAuth Device Flow for GitHub authentication
   */
  async login(options: { openBrowser?: boolean } = {}): Promise<AuthStatus> {
    try {
      console.log('🔐 Starting GitHub authentication...')
      
      // Step 1: Request device code
      const deviceCode = await this.requestDeviceCode()
      
      // Step 2: Show user instructions
      console.log('\n📋 To authenticate:')
      console.log(`   1. Visit: ${deviceCode.verification_uri}`)
      console.log(`   2. Enter code: ${deviceCode.user_code}`)
      console.log('')
      
      // Step 3: Optionally open browser
      if (options.openBrowser !== false) {
        try {
          if (deviceCode.verification_uri_complete) {
            await open(deviceCode.verification_uri_complete)
            console.log('🌐 Opened browser for you')
          } else {
            await open(deviceCode.verification_uri)
            console.log('🌐 Opened browser - please enter the code above')
          }
        } catch (_error) {
          console.log('💡 Please visit the URL manually')
        }
      }
      
      // Step 4: Poll for token
      console.log('⏳ Waiting for authorization...')
      const token = await this.pollForToken(deviceCode.device_code, deviceCode.interval)
      
      // Step 5: Verify token and get user info
      const user = await this.getUserInfo(token.access_token)
      
      // Step 6: Store token securely
      await this.storeToken(token.access_token)
      
      console.log(`✅ Successfully authenticated as ${user.login}`)
      console.log(`🔑 Token stored securely`)
      
      return {
        authenticated: true,
        user,
        scopes: token.scope.split(' '),
        token: token.access_token
      }
      
    } catch (_error) {
      throw new Error(`Authentication failed: ${_error instanceof Error ? _error.message : String(_error)}`)
    }
  }

  /**
   * Logout - remove stored token
   */
  async logout(): Promise<void> {
    try {
      const keytar = await getKeytar()
      if (keytar) {
        await keytar.deletePassword(this.serviceName, this.accountName)
      }
      // Also remove file-based token
      await this.clearTokenFile()
      console.log('✅ Successfully logged out')
    } catch (_error) {
      // Token might not exist, that's okay
      console.log('✅ Logged out (no token was stored)')
    }
  }

  /**
   * Check authentication status
   */
  async status(): Promise<AuthStatus> {
    try {
      const token = await this.getStoredToken()
      if (!token) {
        return { authenticated: false }
      }
      
      // Verify token is still valid
      const user = await this.getUserInfo(token)
      
      return {
        authenticated: true,
        user,
        token
      }
      
    } catch (_error) {
      // Token is invalid or expired
      await this.logout() // Clean up invalid token
      return { authenticated: false }
    }
  }

  /**
   * Get stored token if available
   */
  async getStoredToken(): Promise<string | null> {
    try {
      const keytar = await getKeytar()
      if (keytar) {
        return await keytar.getPassword(this.serviceName, this.accountName)
      }
      // Fallback to file-based storage
      return await getTokenFile()
    } catch (_error) {
      return null
    }
  }

  private async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'CodeOS/1.0'
      },
      body: JSON.stringify({
        client_id: this.clientId,
        scope: this.requiredScopes.join(' ')
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to request device code: ${response.status}`)
    }

    return response.json()
  }

  private async pollForToken(deviceCode: string, interval: number): Promise<TokenResponse> {
    const maxAttempts = 100 // ~10 minutes with 5-second intervals
    let attempts = 0

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, interval * 1000))
      attempts++

      try {
        const response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'CodeOS/1.0'
          },
          body: JSON.stringify({
            client_id: this.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        })

        const result: TokenResponse = await response.json()

        if (result.access_token) {
          return result
        }

        if (result.error === 'authorization_pending') {
          // User hasn't completed authorization yet, keep polling
          continue
        }

        if (result.error === 'slow_down') {
          // GitHub wants us to slow down, increase interval
          interval += 5
          continue
        }

        if (result.error === 'expired_token') {
          throw new Error('Device code expired. Please try again.')
        }

        if (result.error === 'access_denied') {
          throw new Error('Authorization denied by user.')
        }

        throw new Error(`OAuth error: ${result.error_description || result.error}`)

      } catch (_error) {
        if (_error instanceof Error && _error.message.includes('OAuth error')) {
          throw _error
        }
        // Network error, continue polling
        continue
      }
    }

    throw new Error('Authentication timed out. Please try again.')
  }

  private async getUserInfo(token: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CodeOS/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`)
    }

    return response.json()
  }

  private async storeToken(token: string): Promise<void> {
    try {
      const keytar = await getKeytar()
      if (keytar) {
        await keytar.setPassword(this.serviceName, this.accountName, token)
        return
      }
      // Fallback to file storage if keytar not available
      console.warn('⚠️ Secure storage unavailable, using file storage')
      await this.storeTokenFile(token)
    } catch (_error) {
      // Fallback to file storage if keytar fails
      console.warn('⚠️ Secure storage failed, using file storage')
      await this.storeTokenFile(token)
    }
  }

  private async storeTokenFile(token: string): Promise<void> {
    const configDir = path.join(os.homedir(), '.codeos')
    await fs.mkdir(configDir, { recursive: true })
    
    const tokenFile = path.join(configDir, 'github-token')
    await fs.writeFile(tokenFile, token, { mode: 0o600 }) // Read-only for owner
  }

  private async clearTokenFile(): Promise<void> {
    try {
      const tokenFile = path.join(os.homedir(), '.codeos', 'github-token')
      await fs.unlink(tokenFile)
    } catch (_error) {
      // File might not exist, that's okay
    }
  }

  private async getTokenFile(): Promise<string | null> {
    return await getTokenFile()
  }
}

/**
 * Get token from file storage (fallback)
 */
async function getTokenFile(): Promise<string | null> {
  try {
    const tokenFile = path.join(os.homedir(), '.codeos', 'github-token')
    return await fs.readFile(tokenFile, 'utf8')
  } catch {
    return null
  }
}

/**
 * Enhanced token detection that includes OAuth tokens
 */
export async function detectGitHubToken(): Promise<string> {
  // 1. Environment variables (highest priority)
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (envToken?.trim()) {
    return envToken.trim()
  }

  // 2. CodeOS OAuth token (secure storage)
  const oauth = new GitHubOAuthClient()
  const oauthToken = await oauth.getStoredToken()
  if (oauthToken) {
    return oauthToken
  }

  // 3. CodeOS OAuth token (file fallback)
  try {
    const fileToken = await getTokenFile()
    if (fileToken?.trim()) {
      return fileToken.trim()
    }
  } catch {
    // File token not available
  }

  // 4. GitHub CLI token
  try {
    const { execSync } = await import('node:child_process')
    execSync('gh auth status', { stdio: 'ignore' })
    const ghToken = execSync('gh auth token', { encoding: 'utf8' }).trim()
    if (ghToken) {
      return ghToken
    }
  } catch {
    // GitHub CLI not available or not authenticated
  }

  throw new Error('No GitHub token found. Run: codeos auth login')
}

/**
 * Check if user is authenticated with GitHub
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    await detectGitHubToken()
    return true
  } catch {
    return false
  }
}
