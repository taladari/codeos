import { GitHubOAuthClient } from 'codeos-core'
import { logger } from './index.js'

export async function authLogin(options: { 
  noBrowser?: boolean 
} = {}): Promise<void> {
  try {
    const oauth = new GitHubOAuthClient()
    
    // Check if already authenticated
    const status = await oauth.status()
    if (status.authenticated && status.user) {
      logger.info(`✅ Already authenticated as ${status.user.login}`)
      logger.info(`💡 Use 'codeos auth logout' to sign out`)
      return
    }
    
    // Start OAuth flow
    const result = await oauth.login({ 
      openBrowser: !options.noBrowser 
    })
    
    if (result.user) {
      logger.info(`\n🎉 Welcome, ${result.user.name || result.user.login}!`)
      logger.info(`📧 Email: ${result.user.email || 'Not public'}`)
      if (result.scopes) {
        logger.info(`🔑 Scopes: ${result.scopes.join(', ')}`)
      }
      logger.info(`\n💡 You can now use: codeos pr <runId>`)
    }
    
  } catch (error) {
    logger.error(`❌ Authentication failed: ${error instanceof Error ? error.message : String(error)}`)
    
    if (error instanceof Error) {
      if (error.message.includes('timed out')) {
        logger.info(`💡 Try again with: codeos auth login`)
      } else if (error.message.includes('denied')) {
        logger.info(`💡 Authorization was cancelled. Run 'codeos auth login' to try again.`)
      }
    }
    
    throw error
  }
}

export async function authLogout(): Promise<void> {
  try {
    const oauth = new GitHubOAuthClient()
    await oauth.logout()
    logger.info(`✅ Successfully logged out`)
    logger.info(`💡 Use 'codeos auth login' to sign in again`)
    
  } catch (error) {
    logger.error(`❌ Logout failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

export async function authStatus(): Promise<void> {
  try {
    const oauth = new GitHubOAuthClient()
    const status = await oauth.status()
    
    if (status.authenticated && status.user) {
      logger.info(`✅ Authenticated as ${status.user.login}`)
      logger.info(`👤 Name: ${status.user.name || 'Not set'}`)
      logger.info(`📧 Email: ${status.user.email || 'Not public'}`)
      logger.info(`🌐 Profile: https://github.com/${status.user.login}`)
      
      if (status.scopes) {
        logger.info(`🔑 Scopes: ${status.scopes.join(', ')}`)
      }
      
      logger.info(`\n💡 Ready to use GitHub integration!`)
      
    } else {
      logger.info(`❌ Not authenticated`)
      logger.info(`💡 Run 'codeos auth login' to sign in`)
    }
    
  } catch (error) {
    logger.error(`❌ Failed to check auth status: ${error instanceof Error ? error.message : String(error)}`)
    logger.info(`💡 Run 'codeos auth login' to sign in`)
  }
}
