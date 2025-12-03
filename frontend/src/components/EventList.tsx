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

type CategoryType = 'Engagement' | 'Navigation' | 'Transaction' | 'User';

export default function EventList({ events, loading, onCreateEvent, onEditEvent, onDeleteEvent }: EventListProps) {
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

  const toggleEvent = (eventId: number) => {
    setExpandedEvent(expandedEvent === eventId ? null : eventId);
  };

  const getCategoryColor = (category: string | null | undefined): string => {
    const colors: Record<CategoryType, string> = {
      'Engagement': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Navigation': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Transaction': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'User': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return colors[category as CategoryType] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  if (loading) {
    return <EventListSkeleton />;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Events ({events.length})
        </h2>
        <button
          onClick={onCreateEvent}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-brand dark:bg-gradient-brand-dark text-white font-medium rounded-lg shadow-medium hover:shadow-glow transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
        <div className="space-y-3">
          {events.map((event, index) => (
            <div
              key={event.id}
              className="group border border-border rounded-lg overflow-hidden shadow-soft hover:shadow-medium transition-all duration-200 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Event Header */}
              <div
                className="p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleEvent(event.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground transition-transform group-hover:scale-110">
                        {expandedEvent === event.id ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                        {event.name}
                      </span>
                      {event.category && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getCategoryColor(event.category)}`}>
                          {event.category}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343" />
                        </svg>
                        {event.properties.length} {event.properties.length === 1 ? 'property' : 'properties'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEvent(event);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEvent(event.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Event Details */}
              {expandedEvent === event.id && (
                <div className="p-4 bg-background border-t border-border animate-slide-down">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343" />
                    </svg>
                    Properties
                  </h3>
                  {event.properties.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No properties added yet</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Type</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Required</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Example</th>
                          </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                          {event.properties.map((prop) => (
                            <tr key={prop.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-foreground">{prop.property_name}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  prop.property_type === 'event' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                  prop.property_type === 'user' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                                }`}>
                                  {prop.property_type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{prop.data_type}</code>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {prop.is_required ? (
                                  <span className="text-green-600 dark:text-green-400 font-semibold">✓</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                <code className="font-mono text-xs">{prop.example_value || '—'}</code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {event.created_by && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Last modified: {new Date(event.updated_at).toLocaleString()} by {event.created_by}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
