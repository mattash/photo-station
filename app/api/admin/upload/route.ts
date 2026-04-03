import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const formData = await request.formData()
  const sessionId = formData.get('sessionId') as string
  const files = formData.getAll('photos') as File[]

  if (!sessionId || !files.length) {
    return NextResponse.json({ error: 'Missing sessionId or photos' }, { status: 400 })
  }

  const uploaded: string[] = []
  const errors: string[] = []

  for (const file of files) {
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${sessionId}/${timestamp}_${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('photos')
      .upload(storagePath, buffer, { contentType: file.type })

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`)
      continue
    }

    const { error: dbError } = await supabaseAdmin
      .from('photos')
      .insert({ session_id: sessionId, filename: file.name, storage_path: storagePath })

    if (dbError) {
      errors.push(`${file.name}: DB error: ${dbError.message}`)
    } else {
      uploaded.push(file.name)
    }
  }

  // Mark session as photos_ready if successful uploads
  if (uploaded.length > 0) {
    await supabaseAdmin
      .from('sessions')
      .update({ photos_ready: true })
      .eq('id', sessionId)
  }

  return NextResponse.json({ uploaded, errors })
}
