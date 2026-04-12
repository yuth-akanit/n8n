/**
 * Email notifications via Resend (https://resend.com).
 * Requires RESEND_API_KEY + NOTIFY_EMAIL_TO in env.
 */

export interface EmailPayload {
  to?: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email')
    return false
  }

  const recipient = to ?? process.env.NOTIFY_EMAIL_TO
  if (!recipient) {
    console.warn('[email] No recipient — set NOTIFY_EMAIL_TO or pass to param')
    return false
  }

  const fromDomain = process.env.NOTIFY_EMAIL_FROM ?? 'onboarding@resend.dev'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `AI Workspace <${fromDomain}>`,
      to: recipient,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    console.error('[email] Send failed:', res.status, await res.text())
    return false
  }
  return true
}
