import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { getActorName, setActorName } from '../lib/profile'

const nav = [
  { to: '/features', label: 'Features' },
  { to: '/catalog', label: 'Catalog Events' },
  { to: '/catalog/properties', label: 'Property Registry' },
]

const getInitialTheme = (): 'light' | 'dark' => {
  const stored = localStorage.getItem('tracker.theme')
  if (stored === 'dark' || stored === 'light') {
    return stored
  }
  return 'light'
}

export const AppChrome = () => {
  const [displayName, setDisplayNameState] = useState(getActorName())
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('tracker.theme', theme)
  }, [theme])

  return (
    <div className="min-h-screen bg-background text-foreground dot-grid transition-colors">
      <header className="sticky top-0 z-20 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
                />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <Link to="/features" className="font-display text-base font-bold tracking-tight text-foreground">
                Event Taxonomy
              </Link>
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Tracker</span>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-lg border border-border/70 bg-card p-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    isActive ? 'bg-muted text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                  />
                </svg>
              ) : (
                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                  />
                </svg>
              )}
            </button>

            <input
              value={displayName}
              onChange={(event) => {
                const value = event.target.value
                setDisplayNameState(value)
                setActorName(value)
              }}
              className="hidden h-8 w-28 rounded-lg border border-input bg-card px-2 text-xs text-foreground outline-none focus:border-primary/50 lg:block"
              placeholder="Display name"
            />

            <Link to="/features/new" className="action-btn hidden sm:inline-flex">
              New Tracking Plan
            </Link>
            <Link to="/events/new" className="action-btn alt hidden sm:inline-flex">
              New Event
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1320px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
