import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildView, renderTemplate, type ViewParams } from '../.github/actions/release-notify/src/render.js'

const here = dirname(fileURLToPath(import.meta.url))
const defaultTemplate = readFileSync(
  join(here, '../.github/actions/release-notify/templates/default.hbs'),
  'utf8',
)

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const RELEASE_URL = 'https://github.com/klever-coex/ci/releases/tag/v1.2.3'
const RUN_URL = 'https://github.com/klever-coex/ci/actions/runs/12345'

function render(partial: Partial<ViewParams>): string {
  const p: ViewParams = {
    status: 'success',
    kind: 'release',
    project: 'klever-ci',
    tag: 'v1.2.3',
    channel: 'stable',
    promotedFrom: '',
    changelog: '',
    extra: '',
    changelogMaxEntries: 12,
    ref: 'master',
    sha: SHA,
    actor: 'motya',
    releaseUrl: '',
    runUrl: RUN_URL,
    ...partial,
  }
  const releaseUrl =
    p.releaseUrl || (p.tag ? `https://github.com/klever-coex/ci/releases/tag/${p.tag}` : '')
  return renderTemplate(defaultTemplate, buildView({ ...p, releaseUrl }))
}

describe('release scenarios', () => {
  it('stable release with changelog', () => {
    const msg = render({
      changelog: '## Features\n- nav: add obstacle avoidance (#42)\n- ui: brightness control for led strip (#41)\n\n## Bug Fixes\n- http: router panic on empty path (#40)',
    })
    expect(msg).toContain('🚀 <b>klever-ci v1.2.3</b> — stable release')
    expect(msg).toContain('📦 <a href="' + RELEASE_URL + '">v1.2.3</a> · master @ a1b2c3d · 👤 motya')
    expect(msg).toContain('<b>Features</b>')
    expect(msg).toContain('• nav: add obstacle avoidance (#42)')
    expect(msg).toContain('<b>Bug Fixes</b>')
    expect(msg).toContain('• http: router panic on empty path (#40)')
    expect(msg).toContain('▶️ <a href="' + RUN_URL + '">workflow run</a>')
    expect(msg).not.toMatch(/^## /m)
    expect(msg).not.toMatch(/^- /m)
    expect(msg).not.toContain('and .* more')
    expect(msg).not.toContain('more —')
  })

  it('pre-release with extra note', () => {
    const msg = render({
      tag: 'v1.2.3-rc.1',
      channel: 'pre-release',
      extra: 'Image build will need a manual dispatch',
    })
    expect(msg).toContain('🧪 <b>klever-ci v1.2.3-rc.1</b> — pre-release')
    expect(msg).toContain('Image build will need a manual dispatch')
    expect(msg).toContain('releases/tag/v1.2.3-rc.1')
    expect(msg).not.toContain('promoted from')
  })

  it('promoted from rc', () => {
    const msg = render({ promotedFrom: 'v1.2.3-rc.2' })
    expect(msg).toContain('🚀 <b>klever-ci v1.2.3</b> — stable release')
    expect(msg).toContain('⬆️ promoted from v1.2.3-rc.2')
  })

  it('truncates long changelogs', () => {
    const msg = render({
      changelogMaxEntries: 5,
      changelog: '## Features\n- one (#1)\n- two (#2)\n- three (#3)\n- four (#4)\n- five (#5)\n- six (#6)\n- seven (#7)',
    })
    expect(msg).toContain('• one (#1)')
    expect(msg).toContain('• five (#5)')
    expect(msg).toContain(`…and 2 more — <a href="${RELEASE_URL}">full changelog</a>`)
    expect(msg).not.toContain('• six (#6)')
    expect(msg).not.toContain('• seven (#7)')
  })

  it('HTML-escapes changelog content', () => {
    const msg = render({
      changelog: '## Bug Fixes\n- http: drop <script> tags & quotes',
    })
    expect(msg).toContain('• http: drop &lt;script&gt; tags &amp; quotes')
    expect(msg).not.toContain('<script>')
  })

  it('failed release', () => {
    const msg = render({ status: 'failure' })
    expect(msg).toContain('❌ <b>Release failed — klever-ci</b>')
    expect(msg).toContain('master @ a1b2c3d · 👤 motya')
    expect(msg).not.toContain('📦')
    expect(msg).not.toContain('releases/tag')
  })

  it('cancelled release', () => {
    const msg = render({ status: 'cancelled', tag: '' })
    expect(msg).toContain('⚪ <b>Release cancelled — klever-ci</b>')
  })
})

describe('build scenarios', () => {
  it('build success with extra', () => {
    const msg = render({
      kind: 'build',
      project: 'armbian-userpatches',
      tag: '',
      ref: 'klever5-rpi5b',
      extra: 'image: klever5-rpi5b (arm64) · clover2 @ v0.2.0 · uploaded to S3',
      runUrl: 'https://github.com/klever-coex/armbian-userpatches/actions/runs/99',
    })
    expect(msg).toContain('✅ <b>Build succeeded — armbian-userpatches</b>')
    expect(msg).toContain('klever5-rpi5b @ a1b2c3d · 👤 motya')
    expect(msg).toContain('image: klever5-rpi5b (arm64)')
    expect(msg).not.toContain('📦')
    expect(msg).not.toContain('releases/tag')
  })

  it('build failure', () => {
    const msg = render({ kind: 'build', status: 'failure', ref: 'clover2-vm-arm64' })
    expect(msg).toContain('❌ <b>Build failed — klever-ci</b>')
    expect(msg).toContain('clover2-vm-arm64 @ a1b2c3d')
  })
})

describe('custom templates', () => {
  it('renders a custom Handlebars template', () => {
    const tpl = '{{#if (eq kind "build")}}🛠 {{project}}{{else}}🔔 {{project}} {{tag}} ({{channel}}){{/if}}\n{{src}}\nby {{actor}} · {{#if runUrl}}<a href="{{runUrl}}">run</a>{{/if}}'
    const view = buildView({
      status: 'success',
      kind: 'release',
      project: 'klever-ci',
      tag: 'v9.9.9',
      channel: 'stable',
      promotedFrom: '',
      changelog: '## Features\n- custom template render (#1)',
      extra: '',
      changelogMaxEntries: 12,
      ref: 'master',
      sha: SHA,
      actor: 'motya',
      releaseUrl: RELEASE_URL,
      runUrl: RUN_URL,
    })
    const msg = renderTemplate(tpl, view)
    expect(msg).toContain('🔔 klever-ci v9.9.9 (stable)')
    expect(msg).toContain('master @ a1b2c3d · 👤 motya')
    expect(msg).toContain('by motya · <a href="' + RUN_URL + '">run</a>')
    expect(msg).not.toContain('{{')
  })

  it('escapes variables in custom templates', () => {
    const tpl = '{{project}}'
    const view = buildView({
      status: 'success',
      kind: 'release',
      project: 'a<b>&c',
      tag: '',
      channel: 'stable',
      promotedFrom: '',
      changelog: '',
      extra: '',
      changelogMaxEntries: 12,
      ref: '',
      sha: '',
      actor: '',
      releaseUrl: '',
      runUrl: '',
    })
    expect(renderTemplate(tpl, view)).toBe('a&lt;b&gt;&amp;c')
  })
})
