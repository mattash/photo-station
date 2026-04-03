'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'

interface Photo {
  id: string
  filename: string
  url: string
  created_at: string
}

interface PhotoData {
  email: string
  photos: Photo[]
}

export default function PhotosPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<PhotoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/photos/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  async function downloadPhoto(url: string, filename: string) {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function downloadAll() {
    if (!data?.photos) return
    for (const photo of data.photos) {
      await downloadPhoto(photo.url, photo.filename)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading your photos...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Photos Not Found</h1>
          <p className="text-gray-600">This link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  if (!data || data.photos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Photos Coming Soon</h1>
          <p className="text-gray-600 text-sm">
            Your photos haven&apos;t been uploaded yet. Please check back later or bookmark this page.
          </p>
          <p className="text-gray-400 text-xs mt-4">Registered as: {data?.email}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Photos</h1>
            <p className="text-gray-500 text-sm mt-1">{data.email}</p>
          </div>
          <button
            onClick={downloadAll}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.photos.map((photo) => (
            <div key={photo.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.filename}
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="p-3 flex items-center justify-between">
                <span className="text-sm text-gray-600 truncate">{photo.filename}</span>
                <button
                  onClick={() => downloadPhoto(photo.url, photo.filename)}
                  className="text-blue-600 hover:text-blue-700 flex-shrink-0 ml-2"
                  title="Download"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
