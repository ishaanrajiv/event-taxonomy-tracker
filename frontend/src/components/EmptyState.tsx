interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: 'events' | 'properties' | 'changelog' | 'search';
}

export default function EmptyState({ title, description, action, icon = 'events' }: EmptyStateProps) {
  const getIcon = () => {
    switch (icon) {
      case 'events':
        return (
          <svg
            className="w-16 h-16 text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
        );
      case 'properties':
        return (
          <svg
            className="w-16 h-16 text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        );
      case 'changelog':
        return (
          <svg
            className="w-16 h-16 text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'search':
        return (
          <svg
            className="w-16 h-16 text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      {/* Icon with gradient background */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-brand dark:bg-gradient-brand-dark opacity-10 blur-3xl rounded-full"></div>
        <div className="relative bg-muted/50 rounded-full p-6">{getIcon()}</div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>

      {/* Description */}
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-brand dark:bg-gradient-brand-dark text-white font-medium rounded-lg shadow-medium hover:shadow-glow transition-all duration-200 hover:scale-105"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {action.label}
        </button>
      )}

      {/* Additional help text */}
      <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-border/50 max-w-md">
        <p className="text-xs text-muted-foreground">
          💡 <span className="font-medium">Pro tip:</span> Use keyboard shortcuts to speed up your workflow.
          Press <kbd className="px-2 py-0.5 bg-background border border-border rounded text-xs font-mono">⌘</kbd>{' '}
          + <kbd className="px-2 py-0.5 bg-background border border-border rounded text-xs font-mono">K</kbd> for
          quick actions.
        </p>
      </div>
    </div>
  );
}
