import { Link, useLocation } from 'react-router-dom'
import { auth } from '../../shared/api.js'
import { NAV } from '../../shared/nav.js'
import { useSession } from '../../shared/SessionContext.jsx'

export default function Navbar() {
  const user = auth.getUser()
  const isAdmin = user?.role === 'admin'
  const { pathname } = useLocation()
  const { session } = useSession()

  const items = NAV.filter(item => !item.adminOnly || isAdmin)

  function isActive(item) {
    if (item.path === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(item.path)
  }

  function targetPath(item) {
    return item.children ? item.children[0].path : item.path
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 flex items-stretch justify-between h-14">
      <div className="flex items-stretch gap-1">
        <span className="font-bold text-blue-600 text-lg flex items-center pr-4 mr-2 border-r border-gray-200">
          EVA
        </span>
        {items.map(item => (
          <Link
            key={item.path}
            to={targetPath(item)}
            className={`flex items-center gap-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              isActive(item)
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {session && (
          <Link
            to="/me/ventes"
            className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full hover:bg-green-100 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>
            Session ouverte — {session.pointDeVente?.nom}
          </Link>
        )}
        {user && (
          <span className="text-sm text-gray-500">{user.prenom || user.email}</span>
        )}
        <button
          onClick={auth.logout}
          className="text-sm text-gray-400 hover:text-red-600 transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  )
}
