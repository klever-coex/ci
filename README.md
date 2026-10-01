# klever-ci

Shared GitHub Actions plumbing for klever-coex projects.

TypeScript + [Handlebars](https://handlebarsjs.com/) under the hood: actions are
`node24` programs (`src/` → committed `dist/` bundle via tsup), message layout
lives in `.hbs` templates. Dev: `npm run check` (oxlint + tsc + vitest + build +
dist-sync).

## Actions

### `.github/actions/release-notify`

Formatted Telegram notification about a release or a long build: 🚀 stable,
🧪 pre-release, ⬆️ promoted rc, ✅/❌/⚪ build result, ❌ failure. Renders one
HTML message and sends it straight to the Telegram Bot API — no third-party
actions.

```yaml
- name: Telegram notify
  if: always()
  uses: klever-coex/ci/.github/actions/release-notify@master
  with:
    telegram_token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    telegram_chat: ${{ secrets.TELEGRAM_TO }}
    status: ${{ job.status }}                       # success | failure | cancelled
    project: clover2
    tag: ${{ steps.prepare.outputs.tag }}
    channel: ${{ inputs.channel }}                  # stable | pre-release (rc → silent send)
    promoted_from: ${{ inputs.promote_from }}       # shows "⬆️ promoted from rc" when set
    changelog: ${{ steps.changelog.outputs.changelog }}  # mikepenz format; truncated to 12 entries
    extra: "Image build will need a manual dispatch"
```

`kind: build` turns the action into a plain build-result ping (image builds,
long jobs): ✅/❌/⚪ `Build <succeeded|failed|cancelled> — project` header,
context line (`ref @ sha · actor`), `extra` (e.g. image/config/upload info) and
a run link; no release tag/changelog blocks.

- Secrets per repo: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TO`.
- **Templates are Handlebars** (`templates/default.hbs`): `{{var}}` is
  HTML-escaped automatically, `{{{raw}}}` opts out, `{{#if}}`/`{{else}}` build
  the layout. Helpers: `eq`, `shortSha`. View variables: `kind`, `status`,
  `failed`, `cancelled`, `build`, `project`, `tag`, `channel`, `promotedFrom`,
  `extra`, `src`, `ref`, `sha`, `actor`, `releaseUrl`, `runUrl`, `changelogHtml`.
- **Custom template**: keep your own layout in the caller's repo (mikepenz-style)
  and pass `template: .github/notify-template.html` (path relative to the
  workspace). See [`notify-template.example.html`](.github/notify-template.example.html).
  A missing template file fails the step; unknown variables render empty.
- Messages are cut at 3900 chars (Telegram limit 4096).
- Delivery problems are warnings, never job failures. `outputs.sent` says
  whether the message was delivered; `outputs.message` returns the rendered HTML.
- Format is covered by vitest unit tests (`tests/`) and the smoke workflow
  `.github/workflows/release-notify-test.yml`
  (runs on push/PR; `workflow_dispatch` with `send: true` sends a real message).
