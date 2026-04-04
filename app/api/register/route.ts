import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAccessToken } from '@/lib/utils'

export async function POST(request: Request) {
  const { sessionId, email, marketingOptIn } = await request.json()

  if (!sessionId || !email) {
    return NextResponse.json({ error: 'Missing sessionId or email' }, { status: 400 })
  }

  // Validate session exists
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 404 })
  }

  // Check if already registered with this email for this session
  const { data: existing } = await supabaseAdmin
    .from('registrations')
    .select('access_token')
    .eq('session_id', sessionId)
    .eq('email', email.toLowerCase())
    .single()

  if (existing) {
    return NextResponse.json({ accessToken: existing.access_token })
  }

  // Create new registration
  const accessToken = generateAccessToken()
  const { error } = await supabaseAdmin
    .from('registrations')
    .insert({ session_id: sessionId, email: email.toLowerCase(), access_token: accessToken, marketing_opt_in: marketingOptIn ?? true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ accessToken })
}
