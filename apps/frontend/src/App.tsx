import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import BulkImport from './components/BulkImport';
import Changelog from './components/Changelog';
import EventHistoryDrawer from './components/EventHistoryDrawer';
import EventList from './components/EventList';
import EventModal from './components/EventModal';
import FilterBar from './components/FilterBar';
import Header from './components/Header';
import IssuesPanel from './components/IssuesPanel';
import PropertyRegistry from './components/PropertyRegistry';
import { ToastContainer } from './components/Toast';
import TrackingPlanList from './components/tracking-plan/TrackingPlanList';
import { useDarkMode } from './hooks/useDarkMode';
import { useToast } from './hooks/useToast';
import type { ChangelogEntry, Event, FilterOptions, Property, ActiveFilters } from './types/api';
import { buildTrackingValidationSummary } from './utils/trackingValidation';

const API_BASE = 'http://localhost:8000/api';
const PAGE_SIZE = 25;
const CURRENT_USER = 'user@example.com';

type TabType = 'events' | 'tracking-plans' | 'issues' | 'properties' | 'changelog' | 'import';
type SortOrder = 'asc' | 'desc';
type ConnectionState = 'connected' | 'connecting' | 'disconnected';

const TABS: { id: TabType; label: string; icon: ReactNode }[] = [
  {
    id: 'events',
    label: 'Events',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: 'tracking-plans',
    label: 'Tracking Plans',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'issues',
    label: 'Issues',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.4 12.8A2 2 0 004.62 20h14.76a2 2 0 001.73-3.34l-7.38-12.8a2 2 0 00-3.44 0z" />
      </svg>
    ),
  },
  {
    id: 'properties',
    label: 'Properties',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    id: 'changelog',
    label: 'Changelog',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'import',
    label: 'Import',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
];

function App() {
  const [isDarkMode, setIsDarkMode] = useDarkMode();
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [validationEvents, setValidationEvents] = useState<Event[]>([]);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
  const [totalEvents, setTotalEvents] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [properties, setProperties] = useState<Property[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filters, setFilters] = useState<ActiveFilters>({ archivedState: 'active' });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    categories: [],
    creators: [],
    date_range: { min: null, max: null },
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [prefillEvent, setPrefillEvent] = useState<Event | null>(null);
  const [historyEvent, setHistoryEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const isValidationInFlight = useRef(false);
  const hasQueuedValidationRefresh = useRef(false);
  const activeApiRequestCount = useRef(0);
  const requestCycleHadFailure = useRef(false);
  const toast = useToast();

  const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string' && detail.length > 0) {
        return detail;
      }
    }
    return fallback;
  };

  const beginApiRequest = useCallback(() => {
    if (activeApiRequestCount.current === 0) {
      requestCycleHadFailure.current = false;
    }
    activeApiRequestCount.current += 1;
    setConnectionState('connecting');
  }, []);

  const endApiRequest = useCallback((succeeded: boolean) => {
    requestCycleHadFailure.current ||= !succeeded;
    activeApiRequestCount.current = Math.max(0, activeApiRequestCount.current - 1);

    if (activeApiRequestCount.current === 0) {
      setConnectionState(requestCycleHadFailure.current ? 'disconnected' : 'connected');
    }
  }, []);

  const runApiRequest = useCallback(
    async <T,>(operation: () => Promise<T>) => {
      beginApiRequest();
      try {
        const result = await operation();
        endApiRequest(true);
        return result;
      } catch (error) {
        endApiRequest(false);
        throw error;
      }
    },
    [beginApiRequest, endApiRequest]
  );

  const fetchEvents = async () => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      toast.error('Created From date must be earlier than or equal to Created To date.');
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        skip: (currentPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        sort_order: sortOrder,
      };

      if (searchQuery) params.q = searchQuery;
      if (filters.category) params.category = filters.category;
      if (filters.creator) params.created_by = filters.creator;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.archivedState === 'all') params.include_archived = true;
      if (filters.archivedState === 'archived') params.only_archived = true;

      const response = await runApiRequest(() => axios.get<Event[]>(`${API_BASE}/events`, { params }));
      const parsedTotal = Number(response.headers['x-total-count']);
      const nextTotal = Number.isFinite(parsedTotal) ? parsedTotal : response.data.length;
      const maxPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));

      if (currentPage > maxPage) {
        setCurrentPage(maxPage);
        return;
      }

      setEvents(response.data);
      setTotalEvents(nextTotal);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error(getApiErrorMessage(error, 'Failed to fetch events'));
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await runApiRequest(() => axios.get<FilterOptions>(`${API_BASE}/filter-options`));
      setFilterOptions(response.data);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await runApiRequest(() => axios.get<Property[]>(`${API_BASE}/properties`));
      setProperties(response.data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchChangelog = async () => {
    try {
      const response = await runApiRequest(() => axios.get<ChangelogEntry[]>(`${API_BASE}/changelog`));
      setChangelog(response.data);
    } catch (error) {
      console.error('Error fetching changelog:', error);
    }
  };

  const fetchEventsForValidation = useCallback(async () => {
    if (isValidationInFlight.current) {
      hasQueuedValidationRefresh.current = true;
      return;
    }

    isValidationInFlight.current = true;
    setValidationStatus('loading');

    try {
      const batchSize = 500;
      let skip = 0;
      let hasMore = true;
      const allEvents: Event[] = [];

      while (hasMore) {
        const response = await runApiRequest(() =>
          axios.get<Event[]>(`${API_BASE}/events`, {
            params: {
              skip,
              limit: batchSize,
              sort_order: 'asc',
            },
          })
        );

        const batch = response.data;
        allEvents.push(...batch);
        const parsedTotal = Number(response.headers['x-total-count']);
        const knownTotal = Number.isFinite(parsedTotal) ? parsedTotal : null;

        if (knownTotal !== null) {
          hasMore = allEvents.length < knownTotal;
        } else {
          hasMore = batch.length === batchSize;
        }

        skip += batchSize;
      }

      setValidationEvents(allEvents);
      setValidationStatus('ready');
    } catch (error) {
      console.error('Error fetching events for validation:', error);
      setValidationStatus('error');
      toast.error(getApiErrorMessage(error, 'Failed to evaluate taxonomy issues'));
    } finally {
      isValidationInFlight.current = false;
      if (hasQueuedValidationRefresh.current) {
        hasQueuedValidationRefresh.current = false;
        void fetchEventsForValidation();
      }
    }
  }, [runApiRequest, toast]);

  const refreshAll = () => {
    fetchEvents();
    fetchProperties();
    fetchChangelog();
    void fetchEventsForValidation();
  };

  useEffect(() => {
    fetchEvents();
    fetchProperties();
    fetchChangelog();
    fetchFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchEvents();
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filters, currentPage, sortOrder]);

  useEffect(() => {
    void fetchEventsForValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setPrefillEvent(null);
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setPrefillEvent(null);
    setIsModalOpen(true);
  };

  const handleDuplicateEvent = (event: Event) => {
    setEditingEvent(null);
    setPrefillEvent({
      ...event,
      name: `${event.name} - Copy`,
    });
    setIsModalOpen(true);
  };

  const handleArchiveEvent = async (event: Event) => {
    if (!confirm(`Archive ${event.name}?`)) return;

    try {
      await runApiRequest(() =>
        axios.post(`${API_BASE}/events/${event.id}/archive`, {
          base_version_number: event.version_number,
          changed_by: CURRENT_USER,
          change_reason: 'Archived from event list',
        })
      );
      refreshAll();
      toast.success('Event archived successfully');
    } catch (error) {
      console.error('Error archiving event:', error);
      toast.error(getApiErrorMessage(error, 'Failed to archive event'));
    }
  };

  const handleRestoreEvent = async (event: Event) => {
    if (!confirm(`Restore ${event.name}?`)) return;

    try {
      await runApiRequest(() =>
        axios.post(`${API_BASE}/events/${event.id}/restore`, {
          base_version_number: event.version_number,
          changed_by: CURRENT_USER,
          change_reason: 'Restored from event list',
        })
      );
      refreshAll();
      toast.success('Event restored successfully');
    } catch (error) {
      console.error('Error restoring event:', error);
      toast.error(getApiErrorMessage(error, 'Failed to restore event'));
    }
  };

  const handleModalClose = (shouldRefresh: boolean) => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setPrefillEvent(null);
    if (shouldRefresh) {
      refreshAll();
    }
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'archivedState') {
      return value !== undefined && value !== 'active';
    }
    return value !== undefined;
  }).length;

  const validationSummary = useMemo(
    () => buildTrackingValidationSummary(validationEvents, properties),
    [validationEvents, properties]
  );

  return (
    <div className="min-h-screen bg-background dot-grid transition-colors">
      <Header
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        connectionState={connectionState}
      />
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <aside className="shrink-0 lg:w-56">
            <nav className="flex gap-2 overflow-x-auto rounded-xl border border-border/50 bg-muted/50 p-2 lg:sticky lg:top-24 lg:flex-col">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-semibold transition-all lg:w-full lg:justify-start ${
                    activeTab === tab.id
                      ? 'bg-card text-foreground shadow-soft'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === 'issues' && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        validationStatus === 'ready' && validationSummary.warningItems > 0
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : validationStatus === 'ready'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {validationStatus === 'loading' || validationStatus === 'idle'
                        ? '...'
                        : validationStatus === 'error'
                          ? '!'
                          : validationSummary.warningItems}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1">
            <div className="mb-8 animate-fade-in">
              <h2 className="mb-1 font-display text-2xl font-bold tracking-tight text-foreground">
                Taxonomy Overview
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage versioned event definitions, property registry consistency, and change history.
              </p>
            </div>

            {activeTab === 'events' && (
              <>
                <div className="mb-5 flex flex-col gap-3 animate-slide-up sm:flex-row">
                  <div className="relative flex-1">
                    <svg
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search events..."
                      value={searchQuery}
                      onChange={(changeEvent) => {
                        setSearchQuery(changeEvent.target.value);
                        setCurrentPage(1);
                      }}
                      className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-8 text-sm text-foreground shadow-soft transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setCurrentPage(1);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Clear search"
                      >
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
                        setCurrentPage(1);
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Toggle sort order"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h10M8 18h7M4 16v4m0 0l-2-2m2 2l2-2" />
                      </svg>
                      {sortOrder === 'asc' ? 'Oldest' : 'Latest'}
                    </button>

                    <button
                      onClick={() => setIsFilterExpanded((current) => !current)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                        activeFilterCount > 0
                          ? 'border-primary/30 bg-primary/8 text-primary hover:bg-primary/12'
                          : 'border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                      </svg>
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <FilterBar
                  filters={filters}
                  onFiltersChange={(nextFilters) => {
                    setFilters(nextFilters);
                    setCurrentPage(1);
                  }}
                  filterOptions={filterOptions}
                  onToggle={() => setIsFilterExpanded((current) => !current)}
                  isExpanded={isFilterExpanded}
                />
              </>
            )}

            <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft transition-all">
              {activeTab === 'events' && (
                <EventList
                  events={events}
                  loading={loading}
                  totalEvents={totalEvents}
                  currentPage={currentPage}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                  onCreateEvent={handleCreateEvent}
                  onEditEvent={handleEditEvent}
                  onDuplicateEvent={handleDuplicateEvent}
                  onArchiveEvent={handleArchiveEvent}
                  onRestoreEvent={handleRestoreEvent}
                  onOpenHistory={setHistoryEvent}
                  onCopySuccess={toast.success}
                  onCopyError={toast.error}
                />
              )}
              {activeTab === 'tracking-plans' && (
                <>
                  {selectedPlanId === null ? (
                    <TrackingPlanList
                      apiBase={API_BASE}
                      onSelectPlan={setSelectedPlanId}
                    />
                  ) : (
                    <div className="p-6">
                      <div className="text-muted-foreground">Tracking Plan Workspace (to be implemented)</div>
                      <button
                        onClick={() => setSelectedPlanId(null)}
                        className="mt-4 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                      >
                        Back to Plans
                      </button>
                    </div>
                  )}
                </>
              )}
              {activeTab === 'properties' && <PropertyRegistry properties={properties} />}
              {activeTab === 'issues' && (
                <IssuesPanel
                  summary={validationSummary}
                  status={validationStatus}
                  onRefresh={fetchEventsForValidation}
                />
              )}
              {activeTab === 'changelog' && <Changelog changelog={changelog} />}
              {activeTab === 'import' && (
                <BulkImport
                  apiBase={API_BASE}
                  onImportComplete={() => {
                    refreshAll();
                    setActiveTab('events');
                  }}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      {isModalOpen && (
        <EventModal
          event={editingEvent}
          initialEvent={prefillEvent}
          onClose={handleModalClose}
          apiBase={API_BASE}
        />
      )}

      {historyEvent && (
        <EventHistoryDrawer
          event={historyEvent}
          apiBase={API_BASE}
          currentUser={CURRENT_USER}
          onClose={() => setHistoryEvent(null)}
          onRefresh={refreshAll}
          onSuccess={toast.success}
          onError={toast.error}
        />
      )}
    </div>
  );
}

export default App;
