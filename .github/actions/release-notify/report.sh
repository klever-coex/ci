#!/usr/bin/env bash
# Reports the outcome of the Telegram send step (see action.yml, step "send").
set -euo pipefail

case "${OUTCOME}" in
  success)
    echo "sent=true" >> "${GITHUB_OUTPUT}"
    echo "Telegram message delivered"
    ;;
  skipped)
    echo "sent=false" >> "${GITHUB_OUTPUT}"
    echo "Telegram send skipped (dry_run)"
    ;;
  *)
    echo "sent=false" >> "${GITHUB_OUTPUT}"
    echo "::warning::Telegram delivery failed (release-notify) — check TELEGRAM_* secrets"
    ;;
esac
