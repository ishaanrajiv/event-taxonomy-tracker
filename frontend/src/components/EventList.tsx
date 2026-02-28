import { useState } from 'react';
import { Event } from '../types/api';
import { EventListSkeleton } from './Skeleton';
import EmptyState from './EmptyState';
import EventSnippetViewer from './EventSnippetViewer';

interface EventListProps {
  events: Event[];
  loading: boolean;
  totalEvents: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onCreateEvent: () => void;
  onEditEvent: (event: Event) => void;
  onDuplicateEvent: (event: Event) => void;
  onArchiveEvent: (event: Event) => void;
  onRestoreEvent: (event: Event) => void;
  onOpenHistory: (event: Event) => void;
  onCopySuccess: (message: string) => void;
  onCopyError: (message: string) => void;
}

export default function EventList({
  events,
  loading,
  totalEvents,
  currentPage,
  pageSize,
  onPageChange,
  onCreateEvent,
  onEditEvent,
  onDuplicateEvent,
  onArchiveEvent,
  onRestoreEvent,
  onOpenHistory,
  onCopySuccess,
  onCopyError,
}: EventListProps) {
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [activeSnippetView, setActiveSnippetView] = useState<{ event: Event; platform: 'ios' | 'android' } | null>(null);
  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));
  const startIndex = totalEvents === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = totalEvents === 0 ? 0 : Math.min(currentPage * pageSize, totalEvents);

  const toggleEvent = (eventId: number) => {
    setExpandedEvent(expandedEvent === eventId ? null : eventId);
  };

  const getCategoryColor = (category: string | null | undefined): string => {
    const map: Record<string, string> = {
      Engagement: 'bg-amber-100 text-amber-800 dark:bg-amber-900/25 dark:text-amber-300',
      Navigation: 'bg-sky-100 text-sky-800 dark:bg-sky-900/25 dark:text-sky-300',
      Transaction: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300',
      User: 'bg-violet-100 text-violet-800 dark:bg-violet-900/25 dark:text-violet-300',
    };
    return map[category ?? ''] || 'bg-muted text-muted-foreground';
  };

  const getPropertyTypeBadge = (type: string): string => {
    const map: Record<string, string> = {
      event: 'bg-sky-100 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300',
      user: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300',
      super: 'bg-violet-100 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300',
    };
    return map[type] || 'bg-muted text-muted-foreground';
  };

  const openSnippetViewer = (event: Event, platform: 'ios' | 'android') => {
    setActiveSnippetView({ event, platform });
  };

  if (loading) {
    return <EventListSkeleton />;
  }

  return (
    <div className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Events
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Showing {startIndex}-{endIndex} of {totalEvents} {totalEvents === 1 ? 'event' : 'events'}
          </p>
        </div>
        <button
          onClick={onCreateEvent}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-glow active:scale-[0.97]"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Event
        </button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events found"
          description="Create your first versioned event definition to start building a durable taxonomy."
          action={{
            label: 'Create First Event',
            onClick: onCreateEvent,
          }}
          icon="events"
        />
      ) : (
        <div className="space-y-2">
          {events.map((event, index) => (
            <div
              key={event.id}
              className={`group overflow-hidden rounded-2xl border transition-all animate-fade-in ${
                event.is_archived
                  ? 'border-slate-300/70 bg-slate-50/60 dark:border-slate-800/70 dark:bg-slate-950/30'
                  : 'border-border/60 bg-card hover:border-border'
              }`}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
                onClick={() => toggleEvent(event.id)}
              >
                <svg
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    expandedEvent === event.id ? 'rotate-90' : ''
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {event.name}
                    </span>
                    {event.category && (
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getCategoryColor(event.category)}`}>
                        {event.category}
                      </span>
                    )}
                    {event.is_archived && (
                      <span className="inline-flex rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        Archived
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  )}
                </div>

                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(evt) => {
                      evt.stopPropagation();
                      onOpenHistory(event);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Open version history"
                    aria-label="Open version history"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5M3.05 13A9 9 0 1012 3v0" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                    </svg>
                  </button>
                  <button
                    onClick={(evt) => {
                      evt.stopPropagation();
                      openSnippetViewer(event, 'ios');
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Open iOS snippets"
                    aria-label="Open iOS snippets"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M16.3 1.6c-.9.1-2 .6-2.7 1.4-.7.8-1.2 1.9-1 3 .9.1 2-.4 2.7-1.2.7-.8 1.2-1.9 1-3.2zM20.4 17.6c-.5 1.1-.8 1.6-1.4 2.5-.9 1.3-2.1 2.9-3.6 2.9-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9c-1.5 0-2.6-1.4-3.5-2.7-2.5-3.6-2.7-7.8-1.2-10.1 1.1-1.7 2.8-2.7 4.3-2.7 1.6 0 2.6.9 3.9.9 1.2 0 2-.9 3.9-.9 1.4 0 2.9.8 4 2.2-3.5 1.9-3 6.8 1 7.9z" />
                    </svg>
                  </button>
                  <button
                    onClick={(evt) => {
                      evt.stopPropagation();
                      openSnippetViewer(event, 'android');
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Open Android snippets"
                    aria-label="Open Android snippets"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M17.6 9.6l1.4-2.5a.5.5 0 10-.9-.5l-1.4 2.6A8.5 8.5 0 0012 8a8.5 8.5 0 00-4.7 1.2L5.9 6.6a.5.5 0 10-.9.5l1.4 2.5A7.5 7.5 0 003 16h18a7.5 7.5 0 00-3.4-6.4zM9 13a1 1 0 110-2 1 1 0 010 2zm6 0a1 1 0 110-2 1 1 0 010 2zM6 17v3.5A1.5 1.5 0 007.5 22h1A1.5 1.5 0 0010 20.5V17H6zm8 0v3.5A1.5 1.5 0 0015.5 22h1a1.5 1.5 0 001.5-1.5V17h-4zM4 17v2.5A1.5 1.5 0 005.5 21H6v-4H4zm14 0v4h.5a1.5 1.5 0 001.5-1.5V17h-2z" />
                    </svg>
                  </button>
                  {!event.is_archived && (
                    <button
                      onClick={(evt) => {
                        evt.stopPropagation();
                        onEditEvent(event);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Edit"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={(evt) => {
                      evt.stopPropagation();
                      onDuplicateEvent(event);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Duplicate"
                    aria-label="Duplicate event"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <rect x="9" y="9" width="10" height="10" rx="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 15H6a2 2 0 01-2-2V6a2 2 0 012-2h7a2 2 0 012 2v1" />
                    </svg>
                  </button>
                  {event.is_archived ? (
                    <button
                      onClick={(evt) => {
                        evt.stopPropagation();
                        onRestoreEvent(event);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      title="Restore"
                      aria-label="Restore event"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l-3-3m0 0l3-3m-3 3h11a4 4 0 110 8h-1" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={(evt) => {
                        evt.stopPropagation();
                        onArchiveEvent(event);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/8 hover:text-destructive"
                      title="Archive"
                      aria-label="Archive event"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2m-9 0v10a2 2 0 002 2h6a2 2 0 002-2V8" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 12v4m4-4v4" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {expandedEvent === event.id && (
                <div className="border-t border-border/60 bg-muted/20 animate-fade-in">
                  <div className="p-4">
                    <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 font-semibold text-foreground">
                        v{event.version_number}
                      </span>
                      <span>Current definition</span>
                      <span className="text-border">/</span>
                      <span>{event.properties.length} properties</span>
                      <span className="text-border">/</span>
                      <span>Updated {new Date(event.updated_at).toLocaleDateString()}</span>
                    </div>

                    <div className="mb-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          Status
                        </div>
                        <div className="mt-2 text-sm font-semibold text-foreground">
                          {event.is_archived ? 'Archived' : 'Active'}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          Properties
                        </div>
                        <div className="mt-2 text-sm font-semibold text-foreground">
                          {event.properties.length}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          Updated
                        </div>
                        <div className="mt-2 text-sm font-semibold text-foreground">
                          {new Date(event.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Current Projection
                    </h3>
                    {event.properties.length === 0 ? (
                      <p className="py-3 text-xs text-muted-foreground">No properties defined for this event.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-border/60">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-muted/40">
                              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Data Type</th>
                              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Required</th>
                              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Example</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {event.properties.map((prop) => (
                              <tr key={prop.id} className="transition-colors hover:bg-muted/20">
                                <td className="px-3 py-2 font-mono font-medium text-foreground">{prop.property_name}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${getPropertyTypeBadge(prop.property_type)}`}>
                                    {prop.property_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{prop.data_type}</code>
                                </td>
                                <td className="px-3 py-2">
                                  {prop.is_required ? (
                                    <span className="font-bold text-success">Yes</span>
                                  ) : (
                                    <span className="text-muted-foreground">No</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-mono text-muted-foreground">
                                  {prop.example_value || '\u2014'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {event.created_by && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>Created by {event.created_by}</span>
                        <span className="text-border">/</span>
                        <span>Modified {new Date(event.updated_at).toLocaleDateString()}</span>
                        {event.archived_at && (
                          <>
                            <span className="text-border">/</span>
                            <span>Archived {new Date(event.archived_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex h-8 items-center rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="inline-flex h-8 items-center rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {activeSnippetView && (
        <EventSnippetViewer
          event={activeSnippetView.event}
          platform={activeSnippetView.platform}
          onClose={() => setActiveSnippetView(null)}
          onCopySuccess={onCopySuccess}
          onCopyError={onCopyError}
        />
      )}
    </div>
  );
}
