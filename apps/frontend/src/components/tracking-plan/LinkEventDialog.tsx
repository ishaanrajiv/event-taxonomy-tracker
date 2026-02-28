import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Event, LinkEventRequest } from '../../types/api';
import { Skeleton } from '../Skeleton';

interface LinkEventDialogProps {
  apiBase: string;
  planId: number;
  currentUser: string;
  existingEventIds: number[];
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function LinkEventDialog({
  apiBase,
  planId,
  currentUser,
  existingEventIds,
  onClose,
  onSuccess,
  onError,
}: LinkEventDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchEvents();
  }, [searchQuery]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params: any = { is_published: 'true' };
      if (searchQuery) {
        params.q = searchQuery;
      }
      const { data } = await axios.get<Event[]>(`${apiBase}/events`, { params });

      // Filter out events already in the plan
      const filtered = data.filter((e) => !existingEventIds.includes(e.id));
      setEvents(filtered);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      onError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEvent = (eventId: number) => {
    const newSelected = new Set(selectedEventIds);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEventIds(newSelected);
  };

  const handleLinkSelected = async () => {
    if (selectedEventIds.size === 0) return;

    try {
      const promises = Array.from(selectedEventIds).map((eventId) => {
        const payload: LinkEventRequest = {
          event_id: eventId,
          added_by: currentUser,
        };
        return axios.post(`${apiBase}/tracking-plans/${planId}/events`, payload);
      });

      await Promise.all(promises);
      onSuccess(`Linked ${selectedEventIds.size} event${selectedEventIds.size > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Failed to link events:', error);
      onError('Failed to link events');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-card border border-border rounded-lg shadow-strong w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Link Existing Events</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-border">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Event List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No events found matching your search' : 'No published events available'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const isSelected = selectedEventIds.has(event.id);
                return (
                  <button
                    key={event.id}
                    onClick={() => handleToggleEvent(event.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-border/80 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                      }`}>
                        {isSelected && (
                          <svg className="h-3 w-3 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-foreground">{event.name}</h3>
                          {event.category && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                              {event.category}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.properties.length} properties
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {selectedEventIds.size} event{selectedEventIds.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLinkSelected}
              disabled={selectedEventIds.size === 0}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Link Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
