import { TrackingValidationSummary } from '../utils/trackingValidation';

interface IssuesPanelProps {
  summary: TrackingValidationSummary;
  status: 'idle' | 'loading' | 'ready' | 'error';
  onRefresh: () => Promise<void>;
}

export default function IssuesPanel({ summary, status, onRefresh }: IssuesPanelProps) {
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="p-5">
        <h2 className="font-display text-lg font-bold text-foreground tracking-tight mb-1">
          Tracking Plan Validation
        </h2>
        <p className="text-xs text-muted-foreground">
          Running checks across all events and properties...
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="p-5">
        <h2 className="font-display text-lg font-bold text-foreground tracking-tight mb-1">
          Tracking Plan Validation
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Validation failed to load from the server.
        </p>
        <button
          onClick={() => {
            void onRefresh();
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Retry checks
        </button>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
          Tracking Plan Validation
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {summary.passChecks} checks passing, {summary.warningChecks} warnings across your taxonomy.
        </p>
      </div>

      <div className="space-y-2">
        {summary.checks.map((check) => {
          const isWarning = check.status === 'warning';
          return (
            <div
              key={check.id}
              className={`border rounded-lg overflow-hidden ${
                isWarning ? 'border-amber-200/70 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20' : 'border-border/60'
              }`}
            >
              <div className="flex items-center gap-2 px-3.5 py-3">
                {isWarning ? (
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.451 11.47c.75 1.334-.213 2.99-1.742 2.99H3.548c-1.53 0-2.493-1.656-1.743-2.99L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-7a1 1 0 00-.993.883L9 7v4a1 1 0 001.993.117L11 11V7a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{check.summary}</div>
                  {isWarning && (
                    <div className="text-[11px] text-amber-700/90 dark:text-amber-300/90 mt-0.5">{check.title}</div>
                  )}
                </div>
              </div>

              {isWarning && check.items.length > 0 && (
                <details className="border-t border-amber-200/70 dark:border-amber-900/40">
                  <summary className="cursor-pointer px-3.5 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 select-none hover:bg-amber-100/40 dark:hover:bg-amber-900/20">
                    View details
                  </summary>
                  <div className="px-3.5 pb-3">
                    <div className="space-y-1">
                      {check.items.map((item) => (
                        <div key={item} className="text-xs text-muted-foreground font-mono break-all">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
