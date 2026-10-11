import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as core from '@actions/core'
import { readInputs } from './inputs.js'
import { buildView, renderTemplate } from './render.js'
import { sendTelegram } from './telegram.js'

const here = dirname(fileURLToPath(import.meta.url))
const defaultTemplate = join(here, '..', 'templates', 'default.hbs')
const maxMessageLength = 3900 // Telegram hard limit is 4096

async function main(): Promise<void> {
  const inp = readInputs()

  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com'
  const releaseUrl =
    inp.releaseUrl || (inp.tag ? `${server}/${inp.repo}/releases/tag/${inp.tag}` : '')
  const runUrl = inp.repo && inp.runId ? `${server}/${inp.repo}/actions/runs/${inp.runId}` : ''

  const templatePath = inp.template
    ? resolve(process.env.GITHUB_WORKSPACE ?? process.cwd(), inp.template)
    : defaultTemplate
  if (!existsSync(templatePath)) {
    core.setFailed(`release-notify: template not found: ${templatePath}`)
    return
  }

  const view = buildView({
    status: inp.status,
    kind: inp.kind,
    project: inp.project,
    tag: inp.tag,
    channel: inp.channel,
    promotedFrom: inp.promotedFrom,
    changelog: inp.changelog,
    extra: inp.extra,
    changelogMaxEntries: inp.changelogMaxEntries,
    ref: inp.ref,
    sha: inp.sha,
    actor: inp.actor,
    releaseUrl,
    runUrl,
  })

  const message = renderTemplate(readFileSync(templatePath, 'utf8'), view).slice(
    0,
    maxMessageLength,
  )
  core.setOutput('message', message)
  core.info(`--- release-notify message ---\n${message}\n------------------------------`)

  if (inp.dryRun) {
    core.info('Telegram send skipped (dry_run)')
    core.setOutput('sent', 'false')
    return
  }

  // rc pings arrive silently; stable releases and failures are audible
  const silent = inp.channel === 'pre-release' && inp.status === 'success'
  const result = await sendTelegram({
    token: inp.telegramToken,
    chat: inp.telegramChat,
    text: message,
    silent,
  })
  if (result.ok) {
    core.setOutput('sent', 'true')
    core.info('Telegram message delivered')
  } else {
    core.setOutput('sent', 'false')
    core.warning(`Telegram delivery failed (release-notify) — ${result.error}`)
  }
}

main().catch((e: unknown) => {
  core.setFailed(e instanceof Error ? e.message : String(e))
})
