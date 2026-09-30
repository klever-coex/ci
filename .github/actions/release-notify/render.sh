#!/usr/bin/env bash
# Renders the release-notify message from template.html.
# All INPUT_* variables come from the composite action's env block.
set -euo pipefail

esc() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' <<< "$1"; }

status="${INPUT_STATUS:-success}"
channel="${INPUT_CHANNEL:-stable}"
max_entries="${INPUT_MAX_ENTRIES:-12}"

project="$(esc "${INPUT_PROJECT}")"
tag="$(esc "${INPUT_TAG}")"
ref="$(esc "${INPUT_REF}")"
actor="$(esc "${INPUT_ACTOR}")"

server="${GITHUB_SERVER_URL:-https://github.com}"
repo="${INPUT_REPO}"
run_id="${INPUT_RUN_ID}"

release_url="${INPUT_RELEASE_URL}"
if [[ -z "${release_url}" && -n "${INPUT_TAG}" ]]; then
  release_url="${server}/${repo}/releases/tag/${INPUT_TAG}"
fi
run_url=""
if [[ -n "${repo}" && -n "${run_id}" ]]; then
  run_url="${server}/${repo}/actions/runs/${run_id}"
fi

sha_part=""
if [[ -n "${INPUT_SHA}" ]]; then
  sha_part=" @ ${INPUT_SHA:0:7}"
fi
src="${ref}${sha_part} · 👤 ${actor}"

# --- header + release line -------------------------------------------------
if [[ "${status}" == "failure" || "${status}" == "cancelled" ]]; then
  if [[ "${status}" == "cancelled" ]]; then
    header="⚪ <b>Release cancelled — ${project}</b>"
  else
    header="❌ <b>Release failed — ${project}</b>"
  fi
  promoted=""
  release_line=""
  src_line="${src}"
else
  if [[ "${channel}" == "pre-release" ]]; then
    header="🧪 <b>${project} ${tag}</b> — pre-release"
  else
    header="🚀 <b>${project} ${tag}</b> — stable release"
  fi
  if [[ -n "${INPUT_PROMOTED_FROM}" ]]; then
    promoted="⬆️ promoted from $(esc "${INPUT_PROMOTED_FROM}")"
  else
    promoted=""
  fi
  release_line="📦 <a href=\"${release_url}\">${tag}</a> · ${src}"
  src_line=""
fi

# --- changelog --------------------------------------------------------------
changelog=""
if [[ "${status}" != "failure" && "${status}" != "cancelled" && -n "${INPUT_CHANGELOG}" ]]; then
  changelog="$(printf '%s' "${INPUT_CHANGELOG}" \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' \
    | sed -E -e 's|^##[[:space:]]*(.+)$|<b>\1</b>|' -e 's/^- /• /' \
    | sed -e '/^[[:space:]]*$/d')"

  total="$(grep -c '^• ' <<< "${changelog}" || true)"
  if (( total > max_entries )); then
    over=$((total - max_entries))
    shown=0
    trunc=""
    while IFS= read -r line; do
      if [[ "${line}" == "• "* ]]; then
        shown=$((shown + 1))
        (( shown > max_entries )) && continue
      elif (( shown >= max_entries )); then
        continue
      fi
      trunc+="${line}"$'\n'
    done <<< "${changelog}"
    changelog="${trunc}…and ${over} more — <a href=\"${release_url}\">full changelog</a>"
  fi
fi

# --- extra / footer -----------------------------------------------------------
extra=""
if [[ "${status}" != "failure" && "${status}" != "cancelled" && -n "${INPUT_EXTRA}" ]]; then
  extra="$(esc "${INPUT_EXTRA}")"
fi

footer=""
if [[ -n "${run_url}" ]]; then
  footer="▶️ <a href=\"${run_url}\">workflow run</a>"
fi

# --- render template ----------------------------------------------------------
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
msg="$(cat "${script_dir}/template.html")"

msg="${msg//'{{HEADER}}'/"${header}"}"
msg="${msg//'{{PROMOTED}}'/"${promoted}"}"
msg="${msg//'{{RELEASE_LINE}}'/"${release_line}"}"
msg="${msg//'{{SRC}}'/"${src_line}"}"
msg="${msg//'{{CHANGELOG}}'/"${changelog}"}"
msg="${msg//'{{EXTRA}}'/"${extra}"}"
msg="${msg//'{{FOOTER}}'/"${footer}"}"

# placeholders that resolved to empty leave bare lines — squeeze repeats and trim
msg="$(awk '
  /^[[:space:]]*$/ { blank++; if (blank <= 1) print ""; next }
  { blank = 0; print }
' <<< "${msg}")"
msg="${msg#"${msg%%[![:space:]]*}"}"
msg="${msg%"${msg##*[![:space:]]}"}"

msg="${msg:0:3900}"

# --- outputs -------------------------------------------------------------------
printf '%s' "${msg}" > "${GITHUB_WORKSPACE:-.}/.release-notify-message.html"
echo "--- release-notify message ---"
echo "${msg}"
echo "------------------------------"
{
  echo "message<<__RN_EOF__"
  printf '%s\n' "${msg}"
  echo "__RN_EOF__"
} >> "${GITHUB_OUTPUT}"
