# klever-ci

Shared GitHub Actions plumbing for klever-coex projects.

## Actions

### `.github/actions/release-notify`

Formatted Telegram notification about a release: 🚀 stable, 🧪 pre-release,
⬆️ promoted rc, ❌/⚪ failure. Renders one HTML message (header, release link,
ref @ sha · actor, grouped changelog, footer link to the workflow run) and sends
it via [appleboy/telegram-action](https://github.com/appleboy/telegram-action)
(pinned `@v1.1.1`) — the only third-party dependency in this repo.

```yaml
- name: Telegram notify
  if: always()
  uses: klever-coex/ci/.github/actions/release-notify@master
  with:
    telegram_token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    telegram_chat: ${{ secrets.TELEGRAM_TO }}
    status: ${{ job.status }}                       # adds ❌/⚪ failure message
    project: clover2
    tag: ${{ steps.prepare.outputs.tag }}
    channel: ${{ inputs.channel }}                  # stable | pre-release (rc → silent send)
    promoted_from: ${{ inputs.promote_from }}       # shows "⬆️ promoted from rc" when set
    changelog: ${{ steps.changelog.outputs.changelog }}  # mikepenz format; truncated to 12 entries
    extra: "Image build will need a manual dispatch"
```

`kind: build` turns the action into a plain build-result ping (image builds, long
jobs): ✅/❌/⚪ `Build <succeeded|failed|cancelled> — project` header, context
line (`ref @ sha · actor`), `extra` (e.g. image/config/upload info) and a run
link; no release tag/changelog blocks.

```yaml
- uses: klever-coex/ci/.github/actions/release-notify@master
  if: always()
  with:
    telegram_token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    telegram_chat: ${{ secrets.TELEGRAM_TO }}
    kind: build
    status: ${{ job.status }}
    project: armbian-userpatches
    ref: ${{ matrix.config }}
    extra: "image: klever5-rpi5b (arm64) · clover2 @ v0.2.0 · uploaded to S3"
```

- Secrets per repo: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TO`.
- **Custom template**: a project can keep its own message layout in
  `.github/notify-template.html` (mikepenz-style, like `configuration` for
  changelog builder) and pass `template: .github/notify-template.html`.
  See [`notify-template.example.html`](.github/notify-template.example.html).
- `format: html` is used; changelog/extra text is HTML-escaped, so arbitrary
  PR titles are safe to pass through.
- Changelog longer than `changelog_max_entries` (default 12) is cut to
  `…and N more — full changelog` linking to the release page.
- Delivery problems are warnings, never job failures. `outputs.sent` says
  whether the message was delivered; `outputs.message` returns the rendered HTML.
- Layout lives in [`template.html`](.github/actions/release-notify/template.html);
  bash logic in `render.sh` / `report.sh` next to it. `action.yml` is only the
  inputs/outputs contract and the send step — edit the template to change the
  message shape, not YAML. Placeholders:
  - blocks: `{{HEADER}}`, `{{PROMOTED}}`, `{{RELEASE_LINE}}`, `{{SRC}}`,
    `{{CHANGELOG}}`, `{{EXTRA}}`, `{{FOOTER}}`
  - scalars: `{{PROJECT}}`, `{{TAG}}`, `{{CHANNEL}}`, `{{ACTOR}}`, `{{REF}}`,
    `{{SHA}}`, `{{STATUS}}`, `{{RELEASE_URL}}`, `{{RUN_URL}}`
  - unknown placeholders resolve to empty; a missing template file fails the step.
- Format is covered by `.github/workflows/release-notify-test.yml`
  (runs on push/PR; `workflow_dispatch` with `send: true` sends a real message).
