import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { roleMeta } from '../config/navigation'
import { Button } from '../components/ui'

export function NotFound() {
  const { user } = useApp()
  const home = user ? roleMeta[user.role]?.home : '/login'
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Compass className="h-8 w-8" />
      </span>
      <h1 className="text-4xl font-bold text-slate-800">404</h1>
      <p className="mt-2 text-sm text-slate-500">
        The page you are looking for does not exist or you do not have access to it.
      </p>
      <Link to={home} className="mt-6">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  )
}

export default NotFound
