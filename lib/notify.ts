import { supabaseAdmin } from './supabase-admin'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL

export async function sendPhotoReadyEmail(email: string, accessToken: string): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')
  if (!FROM_EMAIL) throw new Error('RESEND_FROM_EMAIL is not set')

  const photoUrl = `${SITE_URL}/photos/${accessToken}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `St. John Photo Station <${FROM_EMAIL}>`,
      to: email,
      subject: 'Your St. John photos are ready',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <img src="${SITE_URL}/images/St.John-Final-logo-small.png"
               alt="St. John Armenian Apostolic Church"
               style="width:56px;height:56px;display:block;margin:0 auto 16px" />
          <h1 style="text-align:center;font-size:20px;color:#111;margin:0 0 8px">
            Your photos are ready
          </h1>
          <p style="text-align:center;color:#555;font-size:15px;margin:0 0 24px">
            Your St. John Armenian Apostolic Church photos are ready to view and download.
          </p>
          <div style="text-align:center">
            <a href="${photoUrl}"
               style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block">
              View My Photos
            </a>
          </div>
          <p style="text-align:center;color:#999;font-size:12px;margin:24px 0 0">
            Or open this link: ${photoUrl}
          </p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || `Resend error ${res.status}`)
  }
}

export async function notifySession(sessionId: string): Promise<{ sent: string[]; failed: string[]; errors: string[] }> {
  const { data: registrations } = await supabaseAdmin
    .from('registrations')
    .select('id, email, access_token')
    .eq('session_id', sessionId)
    .is('notified_at', null)

  const sent: string[] = []
  const failed: string[] = []

  const errors: string[] = []

  for (const reg of registrations ?? []) {
    try {
      await sendPhotoReadyEmail(reg.email, reg.access_token)
      await supabaseAdmin
        .from('registrations')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', reg.id)
      sent.push(reg.email)
    } catch (e) {
      failed.push(reg.email)
      errors.push(`${reg.email}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { sent, failed, errors }
}
