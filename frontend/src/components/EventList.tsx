import { useState } from 'react';
import { Event } from '../types/api';
import { EventListSkeleton } from './Skeleton';
import EmptyState from './EmptyState';

interface EventListProps {
  events: Event[];
  loading: boolean;
  onCreateEvent: () => void;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (id: number) => void;
}

export default function EventList({ events, loading, onCreateEvent, onEditEvent, onDeleteEvent }: EventListProps) {
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

  const toggleEvent = (eventId: number) => {
    setExpandedEvent(expandedEvent === eventId ? null : eventId);
  };

  const getCategoryColor = (category: string | null | undefined): string => {
    const map: Record<string, string> = {
      'Engagement': 'bg-amber-100 text-amber-800 dark:bg-amber-900/25 dark:text-amber-300',
      'Navigation': 'bg-sky-100 text-sky-800 dark:bg-sky-900/25 dark:text-sky-300',
      'Transaction': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300',
      'User': 'bg-violet-100 text-violet-800 dark:bg-violet-900/25 dark:text-violet-300',
    };
    return map[category ?? ''] || 'bg-muted text-muted-foreground';
  };

  const getPropertyTypeBadge = (type: string): string => {
    const map: Record<string, string> = {
      'event': 'bg-sky-100 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300',
      'user': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300',
      'super': 'bg-violet-100 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300',
    };
    return map[type] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return <EventListSkeleton />;
  }

  return (
    <div className="p-5">
      {/* Header Row */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
            Events
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {events.length} {events.length === 1 ? 'event' : 'events'} in taxonomy
          </p>
        </div>
        <button
          onClick={onCreateEvent}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg shadow-soft hover:shadow-glow transition-all active:scale-[0.97]"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Event
        </button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events found"
          description="Get started by creating your first event to track user interactions and analytics."
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
              className="group border border-border/60 rounded-lg overflow-hidden transition-all hover:border-border animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {/* Event Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => toggleEvent(event.id)}
              >
                {/* Chevron */}
                <svg
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                    expandedEvent === event.id ? 'rotate-90' : ''
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>

                {/* Name + Category */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {event.name}
                    </span>
                    {event.category && (
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getCategoryColor(event.category)}`}>
                        {event.category}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {event.description}
                    </p>
                  )}
                </div>

                {/* Property Count */}
                <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 text-[11px] font-medium text-muted-foreground">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {event.properties.length}
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditEvent(event);
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEvent(event.id);
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedEvent === event.id && (
                <div className="border-t border-border/60 bg-muted/20 animate-fade-in">
                  <div className="p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Properties
                    </h3>
                    {event.properties.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3">No properties defined for this event.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border/60">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-muted/40">
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Data Type</th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Required</th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Example</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {event.properties.map((prop) => (
                              <tr key={prop.id} className="hover:bg-muted/20 transition-colors">
                                <td className="px-3 py-2 font-medium text-foreground font-mono">{prop.property_name}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${getPropertyTypeBadge(prop.property_type)}`}>
                                    {prop.property_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <code className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono font-medium">{prop.data_type}</code>
                                </td>
                                <td className="px-3 py-2">
                                  {prop.is_required ? (
                                    <span className="text-success font-bold">Yes</span>
                                  ) : (
                                    <span className="text-muted-foreground">No</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground font-mono">
                                  {prop.example_value || '\u2014'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {event.created_by && (
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>Created by {event.created_by}</span>
                        <span className="text-border">/</span>
                        <span>Modified {new Date(event.updated_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
