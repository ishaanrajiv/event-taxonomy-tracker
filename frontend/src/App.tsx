import { useState, useEffect } from 'react';
import axios from 'axios';
import EventList from './components/EventList';
import EventModal from './components/EventModal';
import PropertyRegistry from './components/PropertyRegistry';
import Changelog from './components/Changelog';
import BulkImport from './components/BulkImport';
import { useDarkMode } from './hooks/useDarkMode';
import { Event, Property, ChangelogEntry } from './types/api';

const API_BASE = 'http://localhost:8000/api';

type TabType = 'events' | 'properties' | 'changelog' | 'import';

function App() {
  const [isDarkMode, setIsDarkMode] = useDarkMode();
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await axios.get<Event[]>(`${API_BASE}/events`, {
        params: searchQuery ? { q: searchQuery } : {}
      });
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
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
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchEvents();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

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
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Event Taxonomy Manager</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage events, properties, and track changes across your analytics taxonomy
            </p>
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? (
              <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('events')}
              className={`${
                activeTab === 'events'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Events ({events.length})
            </button>
            <button
              onClick={() => setActiveTab('properties')}
              className={`${
                activeTab === 'properties'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Property Registry ({properties.length})
            </button>
            <button
              onClick={() => setActiveTab('changelog')}
              className={`${
                activeTab === 'changelog'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Changelog
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`${
                activeTab === 'import'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Bulk Import
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50">
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
