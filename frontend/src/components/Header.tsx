interface HeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Header({ isDarkMode, onToggleDarkMode }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-brand dark:bg-gradient-brand-dark rounded-lg blur-md opacity-50"></div>
              <div className="relative bg-gradient-brand dark:bg-gradient-brand-dark p-2 rounded-lg shadow-medium">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-brand dark:bg-gradient-brand-dark bg-clip-text text-transparent">
                Event Taxonomy
              </h1>
              <p className="text-xs text-muted-foreground">Analytics Management</p>
            </div>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Stats */}
          <div className="hidden md:flex items-center gap-3 mr-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-medium text-muted-foreground">All Systems Operational</span>
            </div>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="relative inline-flex items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? (
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>

          {/* User Profile */}
          <div className="relative">
            <button className="flex items-center gap-2 rounded-lg p-1.5 pr-3 transition-colors hover:bg-accent">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-brand dark:bg-gradient-brand-dark flex items-center justify-center text-white text-sm font-semibold shadow-medium">
                  U
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background"></div>
              </div>
              <span className="hidden md:inline-block text-sm font-medium">user@example.com</span>
              <svg
                className="hidden md:block w-4 h-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
