import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { globSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import * as core from '@actions/core'
import { mapChannel, planUploads, type UploadPlan } from './plan.js'

interface ComposeResult {
  version: string
  buildMode: string
  gitHash: string
}

function composeVersion(root: string): ComposeResult | null {
  if (!existsSync(resolve(root, 'tooling', 'tooling.json'))) return null
  const args = ['version', 'compose', '--root', root, '--json']
  if (process.env.GITHUB_REF) args.push('--ref', process.env.GITHUB_REF)
  const r = spawnSync('clover2', args, { encoding: 'utf8' })
  if (r.error || r.status !== 0) {
    core.info(
      `clover2 version compose unavailable (${r.error ? String(r.error) : `exit ${r.status}`}); pass version/channel inputs explicitly`,
    )
    return null
  }
  try {
    const j = JSON.parse(r.stdout) as Record<string, unknown>
    return {
      version: String(j.version ?? ''),
      buildMode: String(j.build_mode ?? ''),
      gitHash: String(j.git_hash ?? ''),
    }
  } catch {
    return null
  }
}

function expandArtifacts(raw: string, workspace: string): string[] {
  const patterns = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
  const files = new Set<string>()
  for (const p of patterns) {
    const abs = isAbsolute(p) ? p : resolve(workspace, p)
    const globbed = globSync(abs)
    const matches = globbed.length > 0 ? globbed : existsSync(abs) ? [abs] : []
    if (matches.length === 0) {
      core.info(`artifact-push: no files match "${p}" — pattern skipped`)
      continue
    }
    for (const m of matches) files.add(m)
  }
  if (files.size === 0) throw new Error(`artifact-push: no files match any pattern`)
  return [...files].sort()
}

function pushOne(
  plan: UploadPlan,
  bucket: string,
  workspace: string,
  env: NodeJS.ProcessEnv,
): void {
  const args = ['artifact', 'push', plan.file, '--key', plan.key, '--bucket', bucket]
  for (const [k, v] of Object.entries(plan.tags)) args.push('--tag', `${k}=${v}`)
  const r = spawnSync('clover2', args, { encoding: 'utf8', cwd: workspace, env })
  if (r.error || r.status !== 0) {
    throw new Error(
      `artifact-push: clover2 failed for ${plan.key}: ${r.error ? String(r.error) : r.stderr || r.stdout}`,
    )
  }
}

function main(): void {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd()

  const artifacts = core.getInput('artifacts', { required: true })
  const product = core.getInput('product', { required: true })
  const bucket = core.getInput('bucket') || 'clover2'
  const platform = core.getInput('platform')
  const dryRun = core.getInput('dry_run') === 'true'

  const composed = composeVersion(workspace)
  const version = core.getInput('version') || composed?.version || ''
  const buildMode = composed?.buildMode || core.getInput('build-mode')
  const channel = mapChannel(core.getInput('channel'), buildMode)
  const sha = (core.getInput('sha') || composed?.gitHash || '').slice(0, 7)
  const runId = process.env.GITHUB_RUN_ID ?? ''

  if (version === '') {
    core.setFailed(
      'artifact-push: version is empty — pass the version/channel inputs or run in a repo with tooling/tooling.json',
    )
    return
  }

  const files = expandArtifacts(artifacts, workspace)
  const plans = planUploads(files, {
    product,
    version,
    channel,
    type: core.getInput('type'),
    platform,
    sha,
    runId,
  })

  core.info(
    plans
      .map(
        (p) =>
          `${relative(workspace, p.file)} → ${bucket}/${p.key} [${Object.entries(p.tags).map(([k, v]) => `${k}=${v}`).join(', ')}]`,
      )
      .join('\n'),
  )
  core.setOutput('keys', plans.map((p) => p.key).join('\n'))
  core.setOutput('count', String(plans.length))

  if (dryRun) {
    core.info('dry run — nothing uploaded')
    return
  }

  if (spawnSync('clover2', ['--version'], { encoding: 'utf8' }).error) {
    core.setFailed(
      'artifact-push: clover2 CLI not found on PATH — add the klever-coex/clover2-cli action step first',
    )
    return
  }

  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const [input, envName] of [
    ['s3-endpoint', 'CLOVER2_S3_ENDPOINT'],
    ['s3-access-key', 'CLOVER2_S3_ACCESS_KEY'],
    ['s3-secret-key', 'CLOVER2_S3_SECRET_KEY'],
  ] as const) {
    const v = core.getInput(input)
    if (v !== '') env[envName] = v
  }

  for (const plan of plans) pushOne(plan, bucket, workspace, env)
  core.info(`uploaded ${plans.length} artifact(s) to bucket ${bucket}`)
}

try {
  main()
} catch (e: unknown) {
  core.setFailed(e instanceof Error ? e.message : String(e))
}
