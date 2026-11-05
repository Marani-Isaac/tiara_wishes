import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="panel mx-auto mt-16 max-w-lg p-8 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-2 text-4xl">That page is not in the admin</h1>
      <Link className="btn btn-gold mt-6" to="/admin">
        Back to dashboard
      </Link>
    </div>
  )
}
