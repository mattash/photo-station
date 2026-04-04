import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        <Image
          src="/images/St.John-Final-logo-small.png"
          alt="St. John Armenian Apostolic Church"
          width={96}
          height={96}
          className="mx-auto mb-6"
        />
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Photo Station</h1>
        <p className="text-gray-600 mb-8">
          Scan your QR code card to register and receive your family photos.
        </p>
        <Link
          href="/admin/login"
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Admin Login
        </Link>
      </div>
    </main>
  )
}
