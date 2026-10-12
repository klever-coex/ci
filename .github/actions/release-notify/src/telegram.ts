export interface SendResult {
  ok: boolean
  error?: string
}

export async function sendTelegram(opts: {
  token: string
  chat: string
  text: string
  silent: boolean
}): Promise<SendResult> {
  const res = await post(opts, opts.text, 'HTML')
  if (res.ok) return { ok: true }
  // truncated/broken markup — retry once as plain text so the ping is never lost
  if (/can't parse entities|parse error/i.test(res.error ?? '')) {
    const plain = stripHtml(opts.text)
    const retry = await post(opts, plain, undefined)
    if (retry.ok) return { ok: true }
    return { ok: false, error: `HTML failed (${res.error}); plain-text retry failed (${retry.error})` }
  }
  return { ok: false, error: res.error }
}

/** Tags removed, entities unescaped (amp last so we don't double-decode). */
export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

async function post(
  opts: { token: string; chat: string; text: string; silent: boolean },
  text: string,
  parseMode: string | undefined,
): Promise<SendResult> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${opts.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: opts.chat,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
        disable_web_page_preview: true,
        disable_notification: opts.silent,
      }),
    })
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300)
      return { ok: false, error: `HTTP ${res.status}: ${body}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
