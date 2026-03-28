import { NavLink, useLocation } from 'react-router-dom'
import { NAV } from '../../shared/nav.js'

export default function SubNav() {
  const { pathname } = useLocation()

  // Trouver la section active (ME, EVA, Admin)
  const section = NAV.find(item => item.children && pathname.startsWith(item.path))

  if (!section) return null

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4">
      <div className="flex gap-1 max-w-7xl mx-auto">
        {section.children.map(child => (
          <NavLink
            key={child.path}
            to={child.path}
            className={({ isActive }) =>
              `px-3 py-2 text-sm transition-colors border-b-2 ${
                isActive
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`
            }
          >
            {child.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
