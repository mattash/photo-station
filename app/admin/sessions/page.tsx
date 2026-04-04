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
  const displayUrl = siteUrl.replace(/^https?:\/\//, '')
  return (
    <div className="qr-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/St.John-Final-logo-large-trans.png" alt="St. John Armenian Apostolic Church" className="qr-card-logo" />
      <p className="qr-card-label">{session.label || 'Photo Session'}</p>
      <QRCodeSVG value={url} size={160} level="M" />
      <p className="qr-card-instruction">Scan to access your photos</p>
      <p className="qr-card-url">{displayUrl}</p>
    </div>
  )
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [count, setCount] = useState(1)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function loadSessions() {
    const res = await fetch('/api/admin/sessions')
    const data = await res.json()
    setSessions(Array.isArray(data) ? data : [])
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
    await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' })
    await loadSessions()
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} session(s) and all their photos/registrations?`)) return
    setDeleting(true)
    await Promise.all([...selected].map((id) => fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' })))
    setSelected(new Set())
    await loadSessions()
    setDeleting(false)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === sessions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sessions.map((s) => s.id)))
    }
  }

  const allSelected = sessions.length > 0 && selected.size === sessions.length
  const someSelected = selected.size > 0 && selected.size < sessions.length
  const printableSessions = sessions.filter((s) => selected.has(s.id))

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          body > div > *:not(#print-area) { display: none !important; }
          #print-area { display: flex !important; flex-wrap: wrap; gap: 0; }
        }
        .qr-card {
          width: 3.5in;
          height: 2.5in;
          box-sizing: border-box;
          border: 1.5px dashed #aaa;
          padding: 0.15in 0.2in;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          background: white;
          font-family: sans-serif;
        }
        .qr-card-logo {
          width: 44px;
          height: 44px;
          object-fit: contain;
        }
        .qr-card-label {
          font-size: 17px;
          font-weight: 700;
          color: #111;
          text-align: center;
          margin: 0;
        }
        .qr-card-instruction {
          font-size: 11px;
          color: #444;
          text-align: center;
          margin: 0;
        }
        .qr-card-url {
          font-size: 10px;
          color: #888;
          text-align: center;
          margin: 0;
        }
      `}</style>

      {/* Print area - hidden on screen, shown only when printing */}
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
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Session Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSessions()}
                placeholder="e.g. Smith Family"
                className="w-full px-4 py-2 bg-gray-100 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-20 px-3 py-2 bg-gray-100 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={createSessions}
              disabled={creating || !label.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Set Qty &gt; 1 to create multiple sessions at once (e.g. &quot;Family 1&quot;, &quot;Family 2&quot;, ...)</p>
        </div>

        {/* Selection action bar */}
        {selected.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between">
            <span className="text-blue-800 text-sm font-medium">{selected.size} session(s) selected</span>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set())} className="text-blue-600 text-sm hover:underline">
                Clear
              </button>
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Selected'}
              </button>
              <button
                onClick={() => window.print()}
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Select-all header */}
            <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected }}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {allSelected ? 'Deselect all' : 'Select all'}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center gap-4 px-4 py-4 transition-colors ${
                    selected.has(session.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(session.id)}
                    onChange={() => toggleSelect(session.id)}
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
          </div>
        )}
      </div>
    </div>
  )
}
