const DEFAULT_DENYLIST = [
  'OPENAI_API_KEY','ANTHROPIC_API_KEY','GITHUB_TOKEN','GH_TOKEN','AWS_SECRET_ACCESS_KEY','AZURE_OPENAI_KEY'
]

export function redactSecrets(input: string, extraKeys: string[] = []): string {
  const keys = [...new Set([...DEFAULT_DENYLIST, ...extraKeys])]
  let out = input
  for (const key of keys) {
    const val = process.env[key]
    if (!val) continue
    const esc = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(esc, 'g'), `[REDACTED:${key}]`)
  }
  return out
}

