import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('*, registrations(count), photos(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { label, count } = await request.json()

  const sessions = Array.from({ length: count || 1 }, (_, i) => ({
    label: count > 1 ? `${label} ${i + 1}` : label,
  }))

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert(sessions)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
