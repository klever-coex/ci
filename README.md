# klever-ci

Shared GitHub Actions for klever-coex projects.

## Actions

### release-notify

Telegram notification about a release or a long build.

```yaml
- uses: klever-coex/ci/.github/actions/release-notify@master
  if: always()
  with:
    telegram_token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    telegram_chat: ${{ secrets.TELEGRAM_TO }}
    status: ${{ job.status }}   # success | failure | cancelled
    kind: release               # release | build
    project: clover2
    tag: v0.2.0                 # also: channel, promoted_from, changelog, extra, template
```

Secrets per repo: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TO`.
Delivery failures are warnings, never job failures.

### artifact-push

Upload artifacts to S3/MinIO with [klever-doc.tech](https://klever-doc.tech)
hub tags (`product`, `version`, `channel`, `type`, `platform`).

```yaml
- uses: klever-coex/clover2-cli@v0.0.6
- uses: klever-coex/ci/.github/actions/artifact-push@master
  with:
    artifacts: "out/*.xz out/*.sha"
    product: klever5
    platform: rpi5b             # version/channel empty = clover2 version compose
```

## Dev

TypeScript + Handlebars; actions run on node24 from committed `dist/` bundles.
Full input contracts live in each `action.yml`.

```bash
npm run check   # oxlint + tsc + vitest + build + dist-sync
```
