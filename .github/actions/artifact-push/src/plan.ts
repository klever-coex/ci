export const CHANNELS = ['stable', 'rc', 'dev'] as const
export type Channel = (typeof CHANNELS)[number]

export interface PlanOptions {
  product: string
  version: string
  channel: string
  type?: string
  platform?: string
  sha?: string
  runId?: string
}

export interface UploadPlan {
  file: string
  key: string
  tags: Record<string, string>
}

export function mapChannel(channel: string, buildMode: string): Channel {
  if (channel !== '') {
    if (!(CHANNELS as readonly string[]).includes(channel)) {
      throw new Error(`invalid channel "${channel}"; expected one of ${CHANNELS.join('|')}`)
    }
    return channel as Channel
  }
  switch (buildMode) {
    case 'release':
      return 'stable'
    case 'pre-release':
      return 'rc'
    default:
      return 'dev'
  }
}

export function buildKey(o: {
  channel: string
  product: string
  version: string
  ext: string
  platform?: string
}): string {
  const prefix = o.platform ? `${o.platform}-` : ''
  return `${o.channel}/${o.product}/${o.product}-${prefix}${o.version}.${o.ext}`
}

export function planUploads(files: string[], opts: PlanOptions): UploadPlan[] {
  if (opts.product === '') throw new Error('product is required (hub entry filter tag)')
  if (opts.version === '') throw new Error('version is required (pass input or tooling.json)')
  if (files.length === 0) throw new Error('no files matched')

  return files.map((file) => {
    const dot = file.lastIndexOf('.')
    if (dot <= 0) throw new Error(`cannot determine extension of "${file}" (needed for the object name)`)
    const ext = file.slice(dot + 1)

    const key = buildKey({
      channel: opts.channel,
      product: opts.product,
      version: opts.version,
      ext,
      platform: opts.platform,
    })

    const tags: Record<string, string> = {
      product: opts.product,
      version: opts.version,
      channel: opts.channel,
    }
    if (opts.type) tags.type = opts.type
    if (opts.platform) tags.platform = opts.platform
    if (opts.sha) tags.sha = opts.sha
    if (opts.runId) tags.run_id = opts.runId

    return { file, key, tags }
  })
}
