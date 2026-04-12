/**
 * LINE Messaging API — Push Message
 * (LINE Notify ปิดให้บริการแล้ว มีนาคม 2025)
 *
 * วิธีตั้งค่า:
 * 1. สร้าง LINE Official Account ที่ https://developers.line.biz/
 * 2. สร้าง Messaging API Channel → ได้ Channel Access Token
 * 3. หา User ID ของตัวเอง: เพิ่มบอทเป็นเพื่อน → https://api.line.me/v2/bot/followers/ids
 *    หรือใช้ https://developers.line.biz/en/docs/messaging-api/getting-user-ids/
 *
 * Env vars:
 *   LINE_CHANNEL_ACCESS_TOKEN  — Channel Access Token (long-lived)
 *   LINE_USER_ID               — userId ที่จะส่งหา (หรือ groupId/roomId)
 */

export async function sendLineMessage(message: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const to = process.env.LINE_USER_ID

  if (!token || !to) {
    console.warn('[line] LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_USER_ID ไม่ได้ตั้งค่า')
    return false
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text: message }],
    }),
  })

  if (!res.ok) {
    console.error('[line] Push message failed:', res.status, await res.text())
    return false
  }
  return true
}

/** Alias ชื่อเดิม เพื่อไม่ให้ต้องแก้ไฟล์อื่น */
export const sendLineNotify = sendLineMessage
