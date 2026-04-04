import Link from 'next/link'
import Image from 'next/image'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Image
              src="/images/St.John-Final-logo-small.png"
              alt="St. John Armenian Apostolic Church"
              width={48}
              height={48}
            />
            <h1 className="text-3xl font-bold text-gray-900">Photo Station Admin</h1>
          </div>
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Logout
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/sessions"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 01-.5.5h-15a.5.5 0 01-.5-.5v-11a.5.5 0 01.5-.5h15a.5.5 0 01.5.5v11z" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-900">Sessions & QR Codes</h2>
            <p className="text-sm text-gray-500 mt-1">Create sessions and print QR cards</p>
          </Link>

          <Link
            href="/admin/upload"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-900">Upload Photos</h2>
            <p className="text-sm text-gray-500 mt-1">Assign photos to sessions</p>
          </Link>

          <Link
            href="/admin/registrations"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-900">Registrations</h2>
            <p className="text-sm text-gray-500 mt-1">View who has registered</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
