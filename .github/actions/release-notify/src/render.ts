import Handlebars from 'handlebars'

export interface RenderView {
  kind: string
  status: string
  failed: boolean
  cancelled: boolean
  build: boolean
  project: string
  tag: string
  channel: string
  promotedFrom: string
  extra: string
  src: string
  ref: string
  sha: string
  actor: string
  releaseUrl: string
  runUrl: string
  changelogHtml: string
}

export interface ViewParams {
  status: string
  kind: string
  project: string
  tag: string
  channel: string
  promotedFrom: string
  changelog: string
  extra: string
  changelogMaxEntries: number
  ref: string
  sha: string
  actor: string
  releaseUrl: string
  runUrl: string
}

export function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/**
 * mikepenz changelog ("## Category" + "- entry" lines) to Telegram HTML.
 * Truncates to maxEntries bullet lines, dropping the rest of the input,
 * and appends a "…and N more" link line to the release page.
 */
export function formatChangelog(raw: string, maxEntries: number, releaseUrl: string): string {
  if (!raw) return ''
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l !== '')

  const bullets = lines.filter((l) => l.startsWith('- ')).length
  const over = Math.max(0, bullets - maxEntries)

  const out: string[] = []
  let n = 0
  for (const line of lines) {
    if (line.startsWith('- ')) n++
    if (over > 0 && n > maxEntries) break
    const h = /^##\s+(.*)$/.exec(line)
    if (h && h[1] !== undefined) out.push(`<b>${escapeHtml(h[1])}</b>`)
    else if (line.startsWith('- ')) out.push(`• ${escapeHtml(line.slice(2))}`)
    else out.push(escapeHtml(line))
  }
  if (over > 0) out.push(`…and ${over} more — <a href="${releaseUrl}">full changelog</a>`)
  return out.join('\n')
}

export function buildView(p: ViewParams): RenderView {
  const failed = p.status === 'failure' || p.status === 'cancelled'
  const shaPart = p.sha ? ` @ ${p.sha.slice(0, 7)}` : ''
  return {
    kind: p.kind,
    status: p.status,
    failed,
    cancelled: p.status === 'cancelled',
    build: p.kind === 'build',
    project: p.project,
    tag: p.tag,
    channel: p.channel,
    promotedFrom: p.promotedFrom,
    extra: failed ? '' : p.extra,
    src: `${p.ref}${shaPart} · 👤 ${p.actor}`,
    ref: p.ref,
    sha: p.sha.slice(0, 7),
    actor: p.actor,
    releaseUrl: p.releaseUrl,
    runUrl: p.runUrl,
    changelogHtml:
      failed ? '' : formatChangelog(p.changelog, p.changelogMaxEntries, p.releaseUrl),
  }
}

/** Collapse blank-line runs and trim loose ends left by template conditionals. */
export function tidy(s: string): string {
  return s
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function renderTemplate(source: string, view: RenderView): string {
  const hbs = Handlebars.create()
  hbs.registerHelper('eq', (a: unknown, b: unknown) => a === b)
  hbs.registerHelper('shortSha', (s: unknown) => String(s ?? '').slice(0, 7))
  return tidy(hbs.compile(source)(view))
}
