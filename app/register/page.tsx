'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

function RegisterForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('uid')

  const [email, setEmail] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validSession, setValidSession] = useState<boolean | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setValidSession(false)
      return
    }
    supabase
      .from('sessions')
      .select('id, label')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => setValidSession(!!data))
  }, [sessionId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !sessionId) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, email, marketingOptIn }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/photos/${data.accessToken}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (validSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid QR Code</h1>
          <p className="text-gray-600">This QR code is not valid. Please contact the photographer.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/images/St.John-Final-logo-small.png"
            alt="St. John Armenian Apostolic Church"
            width={72}
            height={72}
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">St. John Photo Station</h1>
          <p className="text-gray-500 mt-2 text-sm">Enter your email to receive a link to your family photos.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-gray-100 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
            />
            <span className="text-sm text-gray-600">
              Keep me updated with news and events from St. John Armenian Apostolic Church.
            </span>
          </label>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving...' : 'Get My Photos Link'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          Your email is only used to provide access to your photos and, if opted in, church updates.
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-500">Loading...</div></div>}>
      <RegisterForm />
    </Suspense>
  )
}
