import { NextResponse } from 'next/server'
import { notifySession } from '@/lib/notify'

export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const { sent, failed } = await notifySession(sessionId)
  return NextResponse.json({ sent: sent.length, failed: failed.length, emails: sent })
}
