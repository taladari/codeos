import { registerLanguageDetector, registerPackageManagerDetector, registerToolDetector } from './detectors.js'

// Languages
registerLanguageDetector({
  id: 'tsconfig', priority: 10,
  async detect(ctx) {
    if (await ctx.exists('tsconfig.json') || await ctx.exists('tsconfig.base.json')) return { match: true, score: 10, value: 'typescript' }
    const files = await ctx.list('.')
    if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) return { match: true, score: 6, value: 'typescript' }
    if (files.some(f => f.endsWith('.js') || f.endsWith('.jsx'))) return { match: true, score: 3, value: 'javascript' }
    return { match: false }
  }
})

// Package managers
registerPackageManagerDetector({ id: 'pnpm', priority: 10, async detect(ctx) { return { match: await ctx.exists('pnpm-lock.yaml'), score: 10, value: 'pnpm' } } })
registerPackageManagerDetector({ id: 'yarn', priority: 20, async detect(ctx) { return { match: await ctx.exists('yarn.lock'), score: 9, value: 'yarn' } } })
registerPackageManagerDetector({ id: 'npm', priority: 30, async detect(ctx) { return { match: await ctx.exists('package-lock.json'), score: 8, value: 'npm' } } })

// Tools (formatter/linter/test)
registerToolDetector({
  id: 'node-tools', priority: 10,
  async detect(ctx) {
    const pkgRaw = await ctx.read('package.json')
    const pkg = pkgRaw ? JSON.parse(pkgRaw) : {}
    const deps = new Set<string>([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])
    const formatter = deps.has('prettier') ? 'prettier' : undefined
    const linter = deps.has('eslint') ? 'eslint' : undefined
    const testRunner = deps.has('vitest') ? 'vitest' : deps.has('jest') ? 'jest' : deps.has('mocha') ? 'mocha' : undefined
    return { match: true, score: 1, value: { formatter, linter, testRunner } }
  }
})

