'use client'

import { useState, useEffect, useCallback } from 'react'

interface Session {
  id: string
  label: string
  photos_ready: boolean
}

export default function UploadPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ uploaded: string[]; errors: string[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    fetch('/api/admin/sessions')
      .then((r) => r.json())
      .then(setSessions)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    setFiles((prev) => [...prev, ...dropped])
  }, [])

  async function handleUpload() {
    if (!selectedSession || !files.length) return
    setUploading(true)
    setResults(null)

    const formData = new FormData()
    formData.append('sessionId', selectedSession)
    files.forEach((f) => formData.append('photos', f))

    const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
    const data = await res.json()
    setResults(data)
    setFiles([])
    setUploading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <a href="/admin" className="text-blue-600 hover:text-blue-700">← Admin</a>
          <h1 className="text-2xl font-bold text-gray-900">Upload Photos</h1>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label || 'Unnamed'} — {s.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600 mb-2">Drag & drop photos here, or</p>
            <label className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
              browse files
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
              />
            </label>
            {files.length > 0 && (
              <p className="text-sm text-gray-500 mt-3">{files.length} file(s) selected</p>
            )}
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {results && (
            <div className="space-y-2">
              {results.uploaded.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 font-medium text-sm">✓ {results.uploaded.length} photo(s) uploaded successfully</p>
                </div>
              )}
              {results.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 font-medium text-sm mb-1">Errors:</p>
                  {results.errors.map((e, i) => (
                    <p key={i} className="text-red-700 text-xs">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedSession || !files.length || uploading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length || ''} Photos`}
          </button>
        </div>
      </div>
    </div>
  )
}
