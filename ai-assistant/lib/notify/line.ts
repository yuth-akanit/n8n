/**
 * Line Notify integration.
 * Requires LINE_NOTIFY_TOKEN in env.
 * Get token at: https://notify-bot.line.me/my/
 */

export async function sendLineNotify(message: string): Promise<boolean> {
  const token = process.env.LINE_NOTIFY_TOKEN
  if (!token) {
    console.warn('[line] LINE_NOTIFY_TOKEN not set — skipping notification')
    return false
  }

  const res = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ message: `\n${message}` }),
  })

  if (!res.ok) {
    console.error('[line] Notify failed:', res.status, await res.text())
    return false
  }
  return true
}
