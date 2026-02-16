import { useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import EventList from './components/EventList';
import EventModal from './components/EventModal';
import PropertyRegistry from './components/PropertyRegistry';
import Changelog from './components/Changelog';
import BulkImport from './components/BulkImport';
import FilterBar from './components/FilterBar';
import Header from './components/Header';
import { ToastContainer } from './components/Toast';
import { useToast } from './hooks/useToast';
import { useDarkMode } from './hooks/useDarkMode';
import { Event, Property, ChangelogEntry, FilterOptions, ActiveFilters } from './types/api';

const API_BASE = 'http://localhost:8000/api';

type TabType = 'events' | 'properties' | 'changelog' | 'import';

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
  const [events, setEvents] = useState<Event[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ActiveFilters>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    categories: [],
    creators: [],
    date_range: { min: null, max: null }
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
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

  const fetchEvents = async () => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      toast.error('Created From date must be earlier than or equal to Created To date.');
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.q = searchQuery;
      if (filters.category) params.category = filters.category;
      if (filters.creator) params.created_by = filters.creator;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;

      const response = await axios.get<Event[]>(`${API_BASE}/events`, { params });
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error(getApiErrorMessage(error, 'Failed to fetch events'));
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await axios.get<FilterOptions>(`${API_BASE}/filter-options`);
      setFilterOptions(response.data);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await axios.get<Property[]>(`${API_BASE}/properties`);
      setProperties(response.data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchChangelog = async () => {
    try {
      const response = await axios.get<ChangelogEntry[]>(`${API_BASE}/changelog`);
      setChangelog(response.data);
    } catch (error) {
      console.error('Error fetching changelog:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchProperties();
    fetchChangelog();
    fetchFilterOptions();
    // Initial bootstrap only; follow-up event refreshes are handled by the debounced effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchEvents();
    }, 300);
    return () => clearTimeout(debounce);
    // Debounced by search/filter changes; fetchEvents intentionally closes over current filter state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filters]);

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await axios.delete(`${API_BASE}/events/${eventId}`, {
        params: { changed_by: 'user@example.com' }
      });
      fetchEvents();
      fetchChangelog();
      toast.success('Event deleted successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const handleModalClose = (shouldRefresh: boolean) => {
    setIsModalOpen(false);
    setEditingEvent(null);
    if (shouldRefresh) {
      fetchEvents();
      fetchProperties();
      fetchChangelog();
    }
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined).length;

  return (
    <div className="min-h-screen bg-background dot-grid transition-colors">
      <Header isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} />
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8 animate-fade-in">
          <h2 className="font-display text-2xl font-bold text-foreground tracking-tight mb-1">
            Taxonomy Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage events, properties, and track changes across your analytics taxonomy.
          </p>
        </div>

        {/* Search + Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5 animate-slide-up">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-8 text-sm border border-input rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all shadow-soft"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className={`inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border transition-colors ${
              activeFilterCount > 0
                ? 'border-primary/30 bg-primary/8 text-primary hover:bg-primary/12'
                : 'border-input bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          filterOptions={filterOptions}
          onToggle={() => setIsFilterExpanded(!isFilterExpanded)}
          isExpanded={isFilterExpanded}
        />

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit border border-border/50">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === tab.id
                    ? 'bg-card text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'events' && (
                  <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    activeTab === 'events'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {events.length}
                  </span>
                )}
                {tab.id === 'properties' && (
                  <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    activeTab === 'properties'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {properties.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-card rounded-xl border border-border/60 shadow-soft overflow-hidden transition-all">
          {activeTab === 'events' && (
            <EventList
              events={events}
              loading={loading}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
              onDeleteEvent={handleDeleteEvent}
            />
          )}
          {activeTab === 'properties' && (
            <PropertyRegistry properties={properties} />
          )}
          {activeTab === 'changelog' && (
            <Changelog changelog={changelog} />
          )}
          {activeTab === 'import' && (
            <BulkImport
              apiBase={API_BASE}
              onImportComplete={() => {
                fetchEvents();
                fetchProperties();
                fetchChangelog();
                setActiveTab('events');
              }}
            />
          )}
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <EventModal
          event={editingEvent}
          onClose={handleModalClose}
          apiBase={API_BASE}
        />
      )}
    </div>
  );
}

export default App;
