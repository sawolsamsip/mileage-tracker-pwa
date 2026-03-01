import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Route, Car, FileText, Settings } from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trips', icon: Route, label: 'Trips' },
  { to: '/vehicles', icon: Car, label: 'Vehicles' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Nav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 safe-bottom border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-6xl justify-around py-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                isActive ? 'text-[var(--accent)]' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
