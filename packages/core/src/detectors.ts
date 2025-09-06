export type DetectCtx = {
  root: string
  read(path: string): Promise<string | null>
  exists(path: string): Promise<boolean>
  list(dir: string): Promise<string[]>
}

export type Detection<T> = { match: boolean; score?: number; value?: T; details?: any }

export type Detector<T> = {
  id: string
  priority?: number
  detect(ctx: DetectCtx): Promise<Detection<T>>
}

export type Language = 'typescript'|'javascript'|'unknown'
export type PackageManager = 'pnpm'|'yarn'|'npm'|'unknown'
export type Formatter = 'prettier'|'none'
export type Linter = 'eslint'|'none'
export type TestRunner = 'vitest'|'jest'|'mocha'|'none'

const languageDetectors: Detector<Language>[] = []
const packageManagerDetectors: Detector<PackageManager>[] = []
const toolDetectors: Detector<{ formatter?: Formatter; linter?: Linter; testRunner?: TestRunner }>[] = []

export function registerLanguageDetector(detector: Detector<Language>): void {
  languageDetectors.push(detector)
}

export function registerPackageManagerDetector(detector: Detector<PackageManager>): void {
  packageManagerDetectors.push(detector)
}

export function registerToolDetector(detector: Detector<{ formatter?: Formatter; linter?: Linter; testRunner?: TestRunner }>): void {
  toolDetectors.push(detector)
}

export function getLanguageDetectors(): Detector<Language>[] { return languageDetectors }
export function getPackageManagerDetectors(): Detector<PackageManager>[] { return packageManagerDetectors }
export function getToolDetectors(): Detector<{ formatter?: Formatter; linter?: Linter; testRunner?: TestRunner }>[] { return toolDetectors }

export async function runDetectors<T>(detectors: Detector<T>[], ctx: DetectCtx): Promise<T | undefined> {
  const ordered = detectors.slice().sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
  let best: { score: number; value: T } | undefined
  for (const d of ordered) {
    const res = await d.detect(ctx)
    if (!res.match) continue
    const score = res.score ?? 1
    if (!best || score > best.score) best = { score, value: res.value as T }
  }
  return best?.value
}

