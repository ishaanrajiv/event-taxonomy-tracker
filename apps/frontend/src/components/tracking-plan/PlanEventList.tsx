import { useState } from 'react';
import axios from 'axios';
import type { Event } from '../../types/api';
import PlanEventCard from './PlanEventCard';
import LinkEventDialog from './LinkEventDialog';
import EventModal from '../EventModal';

interface PlanEventListProps {
  planId: number;
  events: Event[];
  apiBase: string;
  currentUser: string;
  disabled?: boolean;
  onRefresh: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function PlanEventList({
  planId,
  events,
  apiBase,
  currentUser,
  disabled = false,
  onRefresh,
  onSuccess,
  onError,
}: PlanEventListProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleUnlinkEvent = async (eventId: number) => {
    try {
      await axios.delete(`${apiBase}/tracking-plans/${planId}/events/${eventId}`);
      onSuccess('Event removed from tracking plan');
      onRefresh();
    } catch (error) {
      console.error('Failed to unlink event:', error);
      onError('Failed to remove event');
    }
  };

  const handleCreateEvent = () => {
    setIsCreateModalOpen(true);
  };

  const handleModalClose = (shouldRefresh?: boolean) => {
    setIsCreateModalOpen(false);
    if (shouldRefresh) {
      onRefresh();
    }
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="text-lg font-semibold text-foreground">Events</h2>
          <span className="text-sm text-muted-foreground">({events.length})</span>
        </div>

        {!disabled && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLinkDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Link Existing
            </button>
            <button
              onClick={handleCreateEvent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Event
            </button>
          </div>
        )}
      </div>

      <div className="p-4">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <svg className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-muted-foreground mb-4">No events in this tracking plan yet</p>
            {!disabled && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleCreateEvent}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create First Event
                </button>
                <button
                  onClick={() => setIsLinkDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Link Existing Event
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <PlanEventCard
                key={event.id}
                event={event}
                disabled={disabled}
                onUnlink={() => handleUnlinkEvent(event.id)}
              />
            ))}
          </div>
        )}
      </div>

      {isLinkDialogOpen && (
        <LinkEventDialog
          apiBase={apiBase}
          planId={planId}
          currentUser={currentUser}
          existingEventIds={events.map((e) => e.id)}
          onClose={() => setIsLinkDialogOpen(false)}
          onSuccess={(message) => {
            onSuccess(message);
            setIsLinkDialogOpen(false);
            onRefresh();
          }}
          onError={onError}
        />
      )}

      {isCreateModalOpen && (
        <EventModal
          event={null}
          initialEvent={null}
          onClose={handleModalClose}
          apiBase={apiBase}
          trackingPlanId={planId}
        />
      )}
    </div>
  );
}
