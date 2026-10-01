import * as core from '@actions/core'

export interface NotifyInputs {
  telegramToken: string
  telegramChat: string
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
  repo: string
  runId: string
  releaseUrl: string
  template: string
  dryRun: boolean
}

export function readInputs(): NotifyInputs {
  return {
    telegramToken: core.getInput('telegram_token', { required: true }),
    telegramChat: core.getInput('telegram_chat', { required: true }),
    status: core.getInput('status'),
    kind: core.getInput('kind'),
    project: core.getInput('project'),
    tag: core.getInput('tag'),
    channel: core.getInput('channel'),
    promotedFrom: core.getInput('promoted_from'),
    changelog: core.getInput('changelog'),
    extra: core.getInput('extra'),
    changelogMaxEntries: Number(core.getInput('changelog_max_entries')) || 12,
    ref: core.getInput('ref'),
    sha: core.getInput('sha'),
    actor: core.getInput('actor'),
    repo: core.getInput('repo'),
    runId: core.getInput('run_id'),
    releaseUrl: core.getInput('release_url'),
    template: core.getInput('template'),
    dryRun: core.getInput('dry_run') === 'true',
  }
}
