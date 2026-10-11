export const CHANNELS = ['stable', 'rc', 'dev'] as const
export type Channel = (typeof CHANNELS)[number]

const IMAGE_EXTS = new Set(['img', 'xz', 'qcow2', 'ova', 'vdi', 'vmdk'])
const EXTRA_EXTS = new Set(['sha', 'zip', 'ovf', 'txt', 'md5'])

export interface PlanOptions {
  product: string
  version: string
  channel: string
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

export function typeForExt(ext: string): 'image' | 'extra' | null {
  const e = ext.toLowerCase()
  if (IMAGE_EXTS.has(e)) return 'image'
  if (EXTRA_EXTS.has(e)) return 'extra'
  return null
}

export function buildKey(o: {
  channel: string
  product: string
  version: string
  ext: string
  platform?: string
}): string {
  const prefix = o.platform ? `${o.platform}-` : ''
  return `${o.channel}/${o.product}/${prefix}${o.version}.${o.ext}`
}

export interface PlanResult {
  uploads: UploadPlan[]
  skipped: string[]
}

export function planUploads(files: string[], opts: PlanOptions): PlanResult {
  if (opts.product === '') throw new Error('product is required (hub entry filter tag)')
  if (opts.version === '') throw new Error('version is required (pass input or tooling.json)')

  const uploads: UploadPlan[] = []
  const skipped: string[] = []
  for (const file of files) {
    const dot = file.lastIndexOf('.')
    const ext = dot > 0 ? file.slice(dot + 1) : ''
    const type = ext !== '' ? typeForExt(ext) : null
    if (type === null) {
      skipped.push(file)
      continue
    }
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
      type,
    }
    if (opts.platform) tags.platform = opts.platform
    if (opts.sha) tags.sha = opts.sha
    if (opts.runId) tags.run_id = opts.runId
    uploads.push({ file, key, tags })
  }
  if (uploads.length === 0) {
    throw new Error(
      `no uploadable artifacts among ${files.length} file(s); whitelist: ${[...IMAGE_EXTS, ...EXTRA_EXTS].join(', ')}`,
    )
  }
  return { uploads, skipped }
}
