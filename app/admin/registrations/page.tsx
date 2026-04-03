'use client'

import { useState, useEffect } from 'react'

interface Registration {
  id: string
  session_id: string
  email: string
  access_token: string
  created_at: string
  sessions: { label: string }
}

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    fetch('/api/admin/registrations')
      .then((r) => r.json())
      .then((d) => { setRegistrations(d); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <a href="/admin" className="text-blue-600 hover:text-blue-700">← Admin</a>
          <h1 className="text-2xl font-bold text-gray-900">Registrations</h1>
        </div>

        {loading ? (
          <div className="text-gray-500 text-center py-8">Loading...</div>
        ) : registrations.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No registrations yet.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Session</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Registered</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Access Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registrations.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{r.sessions?.label || r.session_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-700">{r.email}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`${siteUrl}/photos/${r.access_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono text-xs"
                      >
                        /photos/{r.access_token.slice(0, 8)}...
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
