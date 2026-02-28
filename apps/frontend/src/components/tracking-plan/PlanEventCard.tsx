import { useState } from 'react';
import type { Event } from '../../types/api';

interface PlanEventCardProps {
  event: Event;
  disabled?: boolean;
  onUnlink: () => void;
}

export default function PlanEventCard({ event, disabled = false, onUnlink }: PlanEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg bg-background hover:border-border/80 transition-all overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0 mr-4">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground truncate">{event.name}</h3>
            {!event.is_archived && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                Draft
              </span>
            )}
            {event.category && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                {event.category}
              </span>
            )}
          </div>
          {event.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{event.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{event.properties.length} properties</span>
            <span>•</span>
            <span>v{event.version_number}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Remove this event from the tracking plan?')) {
                  onUnlink();
                }
              }}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Remove from plan"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/20">
          {event.description && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground">{event.description}</p>
            </div>
          )}

          {event.properties.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Properties</p>
              <div className="space-y-2">
                {event.properties.map((prop, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-xs p-2 bg-background rounded border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <code className="font-mono font-medium text-foreground">{prop.property_name}</code>
                        <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px]">
                          {prop.property_type}
                        </span>
                        {prop.is_required && (
                          <span className="text-destructive text-[10px]">*</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{prop.data_type}</span>
                        {prop.example_value && (
                          <>
                            <span>•</span>
                            <span className="truncate">e.g., {prop.example_value}</span>
                          </>
                        )}
                      </div>
                      {prop.description && (
                        <p className="mt-1 text-muted-foreground">{prop.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No properties defined</p>
          )}
        </div>
      )}
    </div>
  );
}
