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
  try {
    const res = await fetch(`https://api.telegram.org/bot${opts.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: opts.chat,
        text: opts.text,
        parse_mode: 'HTML',
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
