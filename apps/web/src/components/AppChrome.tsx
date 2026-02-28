import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { getActorName, setActorName } from '../lib/profile'

const nav = [
  { to: '/features', label: 'Features' },
  { to: '/catalog', label: 'Catalog Events' },
  { to: '/catalog/properties', label: 'Property Registry' },
]

export const AppChrome = () => {
  const [displayName, setDisplayNameState] = useState(getActorName())

  return (
    <div className="min-h-screen bg-shell text-shell-ink">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-50" />
      <header className="sticky top-0 z-20 border-b border-shell-stroke/70 bg-shell/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-6 py-4">
          <Link to="/features" className="font-display text-2xl uppercase tracking-[0.18em] text-shell-ink">
            Tracking Control Room
          </Link>
          <nav className="flex items-center gap-2 rounded-full border border-shell-stroke bg-shell-soft px-2 py-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    isActive
                      ? 'bg-shell-ink text-shell'
                      : 'text-shell-ink/70 hover:bg-shell-ink/10 hover:text-shell-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <label className="hidden items-center gap-2 rounded-full border border-shell-stroke bg-shell-soft px-3 py-2 text-xs text-shell-ink/70 lg:flex">
              <span className="uppercase tracking-[0.08em]">Profile</span>
              <input
                value={displayName}
                onChange={(event) => {
                  const value = event.target.value
                  setDisplayNameState(value)
                  setActorName(value)
                }}
                className="w-28 bg-transparent text-shell-ink outline-none"
                placeholder="Display name"
              />
            </label>
            <Link to="/features/new" className="action-btn">
              New Tracking Plan
            </Link>
            <Link to="/events/new" className="action-btn alt">
              New Event
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
