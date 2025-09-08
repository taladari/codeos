import { configManager } from 'codeos-core'
import { logger } from './index.js'

export async function configGet(key?: string): Promise<void> {
  const config = await configManager.getConfig()
  
  if (key) {
    const value = getNestedValue(config, key)
    if (value !== undefined) {
      console.log(JSON.stringify(value, null, 2))
    } else {
      logger.error(`❌ Configuration key '${key}' not found`)
    }
  } else {
    console.log(JSON.stringify(config, null, 2))
  }
}

export async function configSet(key: string, value: string): Promise<void> {
  try {
    const parsedValue = JSON.parse(value)
    await setNestedValue(key, parsedValue)
    logger.info(`✅ Configuration updated: ${key} = ${value}`)
  } catch {
    // Try as string
    await setNestedValue(key, value)
    logger.info(`✅ Configuration updated: ${key} = "${value}"`)
  }
}

export async function configMode(mode?: 'auto' | 'backend' | 'local'): Promise<void> {
  if (!mode) {
    const config = await configManager.getConfig()
    const effectiveMode = await configManager.getEffectiveMode()
    
    logger.info(`Current mode: ${config.cloud.mode}`)
    logger.info(`Effective mode: ${effectiveMode}`)
    logger.info(`API URL: ${config.cloud.apiUrl}`)
    
    if (effectiveMode === 'backend') {
      logger.info(`🚀 Using CodeOS Backend (enhanced features enabled)`)
    } else {
      logger.info(`🏠 Using local mode (community features)`)
      logger.info(`💡 Enhanced features available: codeos upgrade`)
    }
    return
  }
  
  await configManager.updateCloudConfig({ mode })
  logger.info(`✅ Mode updated to: ${mode}`)
  
  const effectiveMode = await configManager.getEffectiveMode()
  logger.info(`Effective mode: ${effectiveMode}`)
}

export async function configReset(): Promise<void> {
  // Reset to defaults
  await configManager.updateConfig({
    version: '0.1.0',
    cloud: {
      apiUrl: 'https://api.codeos.dev',
      mode: 'auto',
      fallbackAllow: true,
      telemetryEnabled: true
    },
    user: undefined
  })
  
  logger.info(`✅ Configuration reset to defaults`)
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

async function setNestedValue(path: string, value: any): Promise<void> {
  const keys = path.split('.')
  const lastKey = keys.pop()!
  
  const config = await configManager.getConfig()
  let current = config as any
  
  // Navigate to parent object
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {}
    }
    current = current[key]
  }
  
  // Set value
  current[lastKey] = value
  
  await configManager.updateConfig(config)
}
