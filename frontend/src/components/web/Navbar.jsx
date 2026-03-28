import { NavLink } from 'react-router-dom'
import { auth } from '../../shared/api.js'

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/ventes', label: 'Ventes' },
  { to: '/admin', label: 'Admin' },
  { to: '/logs', label: 'Journaux' }
]

export default function Navbar() {
  const user = auth.getUser()

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-blue-600 text-lg">EVA</span>
        <div className="flex gap-1">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-gray-500">{user.prenom || user.email}</span>
        )}
        <button
          onClick={auth.logout}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  )
}
