import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createCtxOverWorkspace } from './repo.js'
import { getLanguageDetectors, getPackageManagerDetectors, getToolDetectors, runDetectors, Formatter, Linter, TestRunner, Language, PackageManager } from './detectors.js'
import './detectors.defaults.js'

export interface AnalyzeReport {
  language: Language
  packageManager: PackageManager
  formatter: Formatter
  linter: Linter
  testRunner: TestRunner
}

async function fileExists(p: string): Promise<boolean> { try { await fs.access(p); return true } catch { return false } }

export async function detectPackageManager(root: string): Promise<AnalyzeReport['packageManager']> {
  if (await fileExists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (await fileExists(path.join(root, 'yarn.lock'))) return 'yarn'
  if (await fileExists(path.join(root, 'package-lock.json'))) return 'npm'
  return 'unknown'
}

export async function detectLanguage(root: string): Promise<AnalyzeReport['language']> {
  if (await fileExists(path.join(root, 'tsconfig.json'))) return 'typescript'
  if (await fileExists(path.join(root, 'tsconfig.base.json'))) return 'typescript'
  // Check packages/* for TS config
  const pkgDirs = await listWorkspacePackageDirs(root)
  for (const d of pkgDirs) {
    if (await fileExists(path.join(d, 'tsconfig.json'))) return 'typescript'
  }
  // Fallback: look for .ts files at root
  try {
    const files = await fs.readdir(root)
    if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) return 'typescript'
    if (files.some(f => f.endsWith('.js') || f.endsWith('.jsx'))) return 'javascript'
  } catch {}
  return 'unknown'
}

export async function readPackageJson(root: string): Promise<any | null> {
  const pkg = path.join(root, 'package.json')
  try { return JSON.parse(await fs.readFile(pkg, 'utf8')) } catch { return null }
}

export function detectFromDeps(pkg: any, extraDeps: string[] = [], extraSignals: { hasPrettierCfg?: boolean; hasEslintCfg?: boolean; hasVitestCfg?: boolean; hasJestCfg?: boolean; hasMochaCfg?: boolean } = {}) {
  const allDeps = new Set<string>([
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.devDependencies ?? {}),
    ...extraDeps,
  ])
  const formatter: AnalyzeReport['formatter'] = (allDeps.has('prettier') || extraSignals.hasPrettierCfg) ? 'prettier' : 'none'
  const linter: AnalyzeReport['linter'] = (allDeps.has('eslint') || extraSignals.hasEslintCfg) ? 'eslint' : 'none'
  let testRunner: AnalyzeReport['testRunner'] = 'none'
  if (allDeps.has('vitest') || extraSignals.hasVitestCfg) testRunner = 'vitest'
  else if (allDeps.has('jest') || extraSignals.hasJestCfg) testRunner = 'jest'
  else if (allDeps.has('mocha') || extraSignals.hasMochaCfg) testRunner = 'mocha'
  return { formatter, linter, testRunner }
}

async function listWorkspacePackageDirs(root: string): Promise<string[]> {
  const pkgsDir = path.join(root, 'packages')
  const out: string[] = []
  try {
    const entries = await fs.readdir(pkgsDir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory()) {
        const dir = path.join(pkgsDir, e.name)
        if (await fileExists(path.join(dir, 'package.json'))) out.push(dir)
      }
    }
  } catch {}
  return out
}

async function _collectAllDeps(root: string): Promise<Set<string>> {
  const deps = new Set<string>()
  const addFrom = (pkg: any) => {
    for (const k of Object.keys(pkg?.dependencies ?? {})) deps.add(k)
    for (const k of Object.keys(pkg?.devDependencies ?? {})) deps.add(k)
  }
  const rootPkg = await readPackageJson(root)
  if (rootPkg) addFrom(rootPkg)
  const pkgDirs = await listWorkspacePackageDirs(root)
  for (const d of pkgDirs) {
    const p = await readPackageJson(d)
    if (p) addFrom(p)
  }
  return deps
}

async function _detectConfigSignals(root: string): Promise<{ hasPrettierCfg: boolean; hasEslintCfg: boolean; hasVitestCfg: boolean; hasJestCfg: boolean; hasMochaCfg: boolean }> {
  const existsAny = async (paths: string[]) => {
    for (const p of paths) { if (await fileExists(p)) return true }
    return false
  }
  const hasPrettierCfg = await existsAny([
    path.join(root, '.prettierrc'), path.join(root, '.prettierrc.json'), path.join(root, 'prettier.config.js')
  ])
  const hasEslintCfg = await existsAny([
    path.join(root, '.eslintrc'), path.join(root, '.eslintrc.json'), path.join(root, 'eslint.config.js')
  ])
  const hasVitestCfg = await existsAny([
    path.join(root, 'vitest.config.ts'), path.join(root, 'vitest.config.js')
  ])
  const hasJestCfg = await existsAny([
    path.join(root, 'jest.config.ts'), path.join(root, 'jest.config.js')
  ])
  const hasMochaCfg = await existsAny([
    path.join(root, '.mocharc.js'), path.join(root, 'mocha.opts')
  ])
  return { hasPrettierCfg, hasEslintCfg, hasVitestCfg, hasJestCfg, hasMochaCfg }
}

export async function analyzeRepo(root: string): Promise<AnalyzeReport> {
  const ctx = await createCtxOverWorkspace(root)
  const [lang, pm, tools] = await Promise.all([
    runDetectors(getLanguageDetectors(), ctx),
    runDetectors(getPackageManagerDetectors(), ctx),
    runDetectors(getToolDetectors(), ctx),
  ])
  return {
    language: (lang as Language) ?? 'unknown',
    packageManager: (pm as PackageManager) ?? 'unknown',
    formatter: (tools?.formatter as Formatter) ?? 'none',
    linter: (tools?.linter as Linter) ?? 'none',
    testRunner: (tools?.testRunner as TestRunner) ?? 'none'
  }
}

export async function writeAnalyzeReport(root: string, report: AnalyzeReport): Promise<string> {
  const reportsDir = path.join(root, '.codeos', 'reports')
  await fs.mkdir(reportsDir, { recursive: true })
  const out = path.join(reportsDir, 'analyze.json')
  await fs.writeFile(out, JSON.stringify(report, null, 2))
  return out
}

