import { useState, useEffect } from 'react';
import axios from 'axios';
import EventList from './components/EventList';
import EventModal from './components/EventModal';
import PropertyRegistry from './components/PropertyRegistry';
import Changelog from './components/Changelog';
import BulkImport from './components/BulkImport';
import FilterBar from './components/FilterBar';
import Header from './components/Header';
import { ToastContainer, useToast } from './components/Toast';
import { useDarkMode } from './hooks/useDarkMode';
import { Event, Property, ChangelogEntry, FilterOptions, ActiveFilters } from './types/api';

const API_BASE = 'http://localhost:8000/api';

type TabType = 'events' | 'properties' | 'changelog' | 'import';

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

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchQuery) params.q = searchQuery;
      if (filters.category) params.category = filters.category;
      if (filters.creator) params.created_by = filters.creator;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;

      const response = await axios.get<Event[]>(`${API_BASE}/events`, { params });
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
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
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchEvents();
    }, 300);
    return () => clearTimeout(debounce);
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

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <Header isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} />

      {/* Toast Container */}
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-foreground">Taxonomy Overview</h2>
            <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
              {events.length} Events
            </div>
          </div>
          <p className="text-muted-foreground">
            Manage events, properties, and track changes across your analytics taxonomy
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-4 animate-slide-up">
          <div className="relative">
            <input
              type="text"
              placeholder="Search events (name, category, description, properties, creator...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-11 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all shadow-soft hover:shadow-medium"
            />
            <svg
              className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 p-0.5 rounded-md hover:bg-muted transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          filterOptions={filterOptions}
          onToggle={() => setIsFilterExpanded(!isFilterExpanded)}
          isExpanded={isFilterExpanded}
        />

        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('events')}
              className={`group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all ${
                activeTab === 'events'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
              }`}
            >
              <svg className={`w-4 h-4 transition-transform ${activeTab === 'events' ? 'scale-110' : 'group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Events
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'events' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {events.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('properties')}
              className={`group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all ${
                activeTab === 'properties'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
              }`}
            >
              <svg className={`w-4 h-4 transition-transform ${activeTab === 'properties' ? 'scale-110' : 'group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343" />
              </svg>
              Properties
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'properties' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {properties.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('changelog')}
              className={`group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all ${
                activeTab === 'changelog'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
              }`}
            >
              <svg className={`w-4 h-4 transition-transform ${activeTab === 'changelog' ? 'scale-110' : 'group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Changelog
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all ${
                activeTab === 'import'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
              }`}
            >
              <svg className={`w-4 h-4 transition-transform ${activeTab === 'import' ? 'scale-110' : 'group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Bulk Import
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="bg-card rounded-lg shadow-medium border border-border/50 overflow-hidden transition-all hover:shadow-strong">
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
