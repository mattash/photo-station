import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Look up registration by access token
  const { data: registration, error: regError } = await supabaseAdmin
    .from('registrations')
    .select('session_id, email')
    .eq('access_token', token)
    .single()

  if (regError || !registration) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Get photos for this session
  const { data: photos, error: photosError } = await supabaseAdmin
    .from('photos')
    .select('*')
    .eq('session_id', registration.session_id)
    .order('created_at', { ascending: true })

  if (photosError) {
    return NextResponse.json({ error: photosError.message }, { status: 500 })
  }

  // Generate signed URLs for each photo (1 hour expiry)
  const photosWithUrls = await Promise.all(
    (photos || []).map(async (photo) => {
      const { data } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 3600)
      return { ...photo, url: data?.signedUrl }
    })
  )

  return NextResponse.json({
    email: registration.email,
    photos: photosWithUrls,
  })
}
