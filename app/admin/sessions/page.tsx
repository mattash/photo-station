'use client'

import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface Session {
  id: string
  label: string
  created_at: string
  photos_ready: boolean
  registrations: { count: number }[]
  photos: { count: number }[]
}

function QRCard({ session, siteUrl }: { session: Session; siteUrl: string }) {
  const url = `${siteUrl}/register?uid=${session.id}`
  return (
    <div className="qr-card bg-white border-2 border-gray-200 rounded-xl p-4 flex flex-col items-center gap-3 w-48">
      <p className="text-xs font-semibold text-gray-600 text-center">{session.label || 'Photo Session'}</p>
      <QRCodeSVG value={url} size={140} />
      <p className="text-[10px] text-gray-400 text-center break-all">{session.id.slice(0, 8)}...</p>
    </div>
  )
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [count, setCount] = useState(1)
  const [creating, setCreating] = useState(false)
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set())
  const printRef = useRef<HTMLDivElement>(null)
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function loadSessions() {
    const res = await fetch('/api/admin/sessions')
    const data = await res.json()
    setSessions(data)
    setLoading(false)
  }

  useEffect(() => { loadSessions() }, [])

  async function createSessions() {
    if (!label.trim()) return
    setCreating(true)
    await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim(), count }),
    })
    setLabel('')
    setCount(1)
    await loadSessions()
    setCreating(false)
  }

  async function deleteSession(id: string) {
    if (!confirm('Delete this session and all associated photos/registrations?')) return
    await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' })
    await loadSessions()
  }

  function togglePrint(id: string) {
    setSelectedForPrint((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function printSelected() {
    window.print()
  }

  const printableSessions = sessions.filter((s) => selectedForPrint.has(s.id))

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-area { display: flex !important; }
          #print-area { flex-wrap: wrap; gap: 16px; padding: 16px; }
        }
      `}</style>

      {/* Print area - hidden on screen, visible when printing */}
      <div id="print-area" className="hidden" ref={printRef}>
        {printableSessions.map((s) => (
          <QRCard key={s.id} session={s} siteUrl={siteUrl} />
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <a href="/admin" className="text-blue-600 hover:text-blue-700">← Admin</a>
          <h1 className="text-2xl font-bold text-gray-900">Sessions & QR Codes</h1>
        </div>

        {/* Create sessions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create Sessions</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Smith Family)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Number of sessions to create"
            />
            <button
              onClick={createSessions}
              disabled={creating || !label.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Set count &gt; 1 to create multiple sessions at once (e.g. &quot;Family 1&quot;, &quot;Family 2&quot;, ...)</p>
        </div>

        {/* Print selected */}
        {selectedForPrint.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between">
            <span className="text-blue-800 text-sm font-medium">{selectedForPrint.size} card(s) selected for printing</span>
            <div className="flex gap-2">
              <button onClick={() => setSelectedForPrint(new Set())} className="text-blue-600 text-sm hover:underline">Clear</button>
              <button
                onClick={printSelected}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Print QR Cards
              </button>
            </div>
          </div>
        )}

        {/* Sessions list */}
        {loading ? (
          <div className="text-gray-500 text-center py-8">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No sessions yet. Create one above.</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`bg-white rounded-xl border p-4 flex items-center gap-4 transition-colors ${
                  selectedForPrint.has(session.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedForPrint.has(session.id)}
                  onChange={() => togglePrint(session.id)}
                  className="w-4 h-4 accent-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{session.label || 'Unnamed Session'}</p>
                  <p className="text-xs text-gray-400 font-mono">{session.id}</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span title="Registrations">{session.registrations?.[0]?.count ?? 0} reg</span>
                  <span title="Photos">{session.photos?.[0]?.count ?? 0} photos</span>
                  {session.photos_ready && (
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">Ready</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <QRCodeSVG
                    value={`${siteUrl}/register?uid=${session.id}`}
                    size={48}
                    className="rounded"
                  />
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="text-red-400 hover:text-red-600 p-1"
                    title="Delete session"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
