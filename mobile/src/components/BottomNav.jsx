import { NavLink } from 'react-router-dom'
import { useSession } from '../shared/SessionContext.jsx'

const TABS = [
  { to: '/caisse',   label: 'Caisse',   emoji: '🛒', sessionBadge: true },
  { to: '/stock',    label: 'Stock',    emoji: '📦' },
  { to: '/sessions', label: 'Sessions', emoji: '📊' },
  { to: '/compta',   label: 'Compta',   emoji: '💰' },
]

export default function BottomNav() {
  const { session } = useSession()

  return (
    <nav className="flex-shrink-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe" style={{ boxShadow: '0 -1px 12px rgba(0,0,0,0.06)' }}>
      <div className="flex">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className="flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5"
          >
            {({ isActive }) => (
              <>
                <div className="relative flex items-center justify-center w-11 h-10">
                  {isActive && (
                    <div className="absolute inset-0 bg-indigo-50 rounded-2xl" />
                  )}
                  <span className={`relative text-2xl leading-none transition-transform duration-150 ${isActive ? 'scale-110' : 'scale-100'}`}>
                    {tab.emoji}
                  </span>
                  {tab.sessionBadge && session && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <span className={`text-xs font-semibold transition-colors duration-150 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
