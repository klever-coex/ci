#!/usr/bin/env bash
# Renders the release-notify message from template.html.
# INPUT_* variables come from the composite action's env block.
set -euo pipefail

esc() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' <<< "$1"; }

status="${INPUT_STATUS:-success}"
channel="${INPUT_CHANNEL:-stable}"
max_entries="${INPUT_MAX_ENTRIES:-12}"
failed=0
[[ "${status}" == "failure" || "${status}" == "cancelled" ]] && failed=1
build=0
[[ "${INPUT_KIND:-release}" == "build" ]] && build=1

project="$(esc "${INPUT_PROJECT}")"
tag="$(esc "${INPUT_TAG}")"
ref="$(esc "${INPUT_REF}")"
actor="$(esc "${INPUT_ACTOR}")"

server="${GITHUB_SERVER_URL:-https://github.com}"
repo="${INPUT_REPO}"
run_id="${INPUT_RUN_ID}"

release_url="${INPUT_RELEASE_URL:-}"
[[ -z "${release_url}" && -n "${INPUT_TAG}" ]] && release_url="${server}/${repo}/releases/tag/${INPUT_TAG}"
run_url=""
[[ -n "${repo}" && -n "${run_id}" ]] && run_url="${server}/${repo}/actions/runs/${run_id}"

sha=""
[[ -n "${INPUT_SHA}" ]] && sha=" @ ${INPUT_SHA:0:7}"
src="${ref}${sha} · 👤 ${actor}"

# --- header + release line ---------------------------------------------------
if (( build )); then
  case "${status}" in
    failure)   header="❌ <b>Build failed — ${project}</b>" ;;
    cancelled) header="⚪ <b>Build cancelled — ${project}</b>" ;;
    *)         header="✅ <b>Build succeeded — ${project}</b>" ;;
  esac
  promoted=""
  release_line=""
  src_line="${src}"
elif (( failed )); then
  case "${status}" in
    cancelled) header="⚪ <b>Release cancelled — ${project}</b>" ;;
    *)         header="❌ <b>Release failed — ${project}</b>" ;;
  esac
  promoted=""
  release_line=""
  src_line="${src}"
else
  if [[ "${channel}" == "pre-release" ]]; then
    header="🧪 <b>${project} ${tag}</b> — pre-release"
  else
    header="🚀 <b>${project} ${tag}</b> — stable release"
  fi
  promoted=""
  [[ -n "${INPUT_PROMOTED_FROM}" ]] && promoted="⬆️ promoted from $(esc "${INPUT_PROMOTED_FROM}")"
  release_line="📦 <a href=\"${release_url}\">${tag}</a> · ${src}"
  src_line=""
fi

# --- changelog: escape, markdown-ish → html, truncate -------------------------
changelog=""
if (( ! failed )) && [[ -n "${INPUT_CHANGELOG}" ]]; then
  changelog="$(printf '%s' "${INPUT_CHANGELOG}" \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' \
    | sed -E -e 's|^##[[:space:]]*(.+)$|<b>\1</b>|' -e 's/^- /• /' \
    | sed -e '/^[[:space:]]*$/d' \
    | awk -v max="${max_entries}" -v url="${release_url}" '
        /^• / { n++; if (n > max) { more++; next } }
        n > max { next }
              { print }
        END   { if (more) printf "…and %d more — <a href=\"%s\">full changelog</a>\n", more, url }
      ')"
fi

extra=""
if (( ! failed )) && [[ -n "${INPUT_EXTRA}" ]]; then
  extra="$(esc "${INPUT_EXTRA}")"
fi

footer=""
[[ -n "${run_url}" ]] && footer="▶️ <a href=\"${run_url}\">workflow run</a>"

# --- render template -----------------------------------------------------------
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
template_path="${INPUT_TEMPLATE:-${script_dir}/template.html}"
if [[ ! -f "${template_path}" ]]; then
  echo "::error::release-notify: template not found: ${template_path}" >&2
  exit 1
fi
msg="$(cat "${template_path}")"

msg="${msg//'{{HEADER}}'/"${header}"}"
msg="${msg//'{{PROMOTED}}'/"${promoted}"}"
msg="${msg//'{{RELEASE_LINE}}'/"${release_line}"}"
msg="${msg//'{{SRC}}'/"${src_line}"}"
msg="${msg//'{{CHANGELOG}}'/"${changelog}"}"
msg="${msg//'{{EXTRA}}'/"${extra}"}"
msg="${msg//'{{FOOTER}}'/"${footer}"}"

# scalars for custom templates
msg="${msg//'{{PROJECT}}'/"${project}"}"
msg="${msg//'{{TAG}}'/"${tag}"}"
msg="${msg//'{{CHANNEL}}'/"${channel}"}"
msg="${msg//'{{ACTOR}}'/"${actor}"}"
msg="${msg//'{{REF}}'/"${ref}"}"
msg="${msg//'{{SHA}}'/"${INPUT_SHA:0:7}"}"
msg="${msg//'{{RELEASE_URL}}'/"${release_url}"}"
msg="${msg//'{{RUN_URL}}'/"${run_url}"}"
msg="${msg//'{{STATUS}}'/"${status}"}"

# unknown placeholders resolve to empty; empty blocks leave bare lines — squeeze
msg="$(sed -E 's/\{\{[A-Z_]+\}\}//g' <<< "${msg}")"
msg="$(awk '/^[[:space:]]*$/ { blank++; if (blank <= 1) print ""; next } { blank = 0; print }' <<< "${msg}")"
msg="${msg#"${msg%%[![:space:]]*}"}"
msg="${msg%"${msg##*[![:space:]]}"}"
msg="${msg:0:3900}"

# --- outputs ---------------------------------------------------------------------
printf '%s' "${msg}" > "${GITHUB_WORKSPACE:-.}/.release-notify-message.html"
echo "--- release-notify message ---"
echo "${msg}"
echo "------------------------------"
{
  echo "message<<__RN_EOF__"
  printf '%s\n' "${msg}"
  echo "__RN_EOF__"
} >> "${GITHUB_OUTPUT}"
