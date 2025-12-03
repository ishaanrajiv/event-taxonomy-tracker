import { useState, useEffect } from 'react'
import axios from 'axios'
import EventList from './components/EventList'
import EventModal from './components/EventModal'
import PropertyRegistry from './components/PropertyRegistry'
import Changelog from './components/Changelog'
import BulkImport from './components/BulkImport'

const API_BASE = 'http://localhost:8000/api'

function App() {
  const [activeTab, setActiveTab] = useState('events')
  const [events, setEvents] = useState([])
  const [properties, setProperties] = useState([])
  const [changelog, setChangelog] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_BASE}/events`, {
        params: searchQuery ? { q: searchQuery } : {}
      })
      setEvents(response.data)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProperties = async () => {
    try {
      const response = await axios.get(`${API_BASE}/properties`)
      setProperties(response.data)
    } catch (error) {
      console.error('Error fetching properties:', error)
    }
  }

  const fetchChangelog = async () => {
    try {
      const response = await axios.get(`${API_BASE}/changelog`)
      setChangelog(response.data)
    } catch (error) {
      console.error('Error fetching changelog:', error)
    }
  }

  useEffect(() => {
    fetchEvents()
    fetchProperties()
    fetchChangelog()
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchEvents()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const handleCreateEvent = () => {
    setEditingEvent(null)
    setIsModalOpen(true)
  }

  const handleEditEvent = (event) => {
    setEditingEvent(event)
    setIsModalOpen(true)
  }

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      await axios.delete(`${API_BASE}/events/${eventId}`)
      fetchEvents()
      fetchChangelog()
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Failed to delete event')
    }
  }

  const handleModalClose = (shouldRefresh) => {
    setIsModalOpen(false)
    setEditingEvent(null)
    if (shouldRefresh) {
      fetchEvents()
      fetchProperties()
      fetchChangelog()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Event Taxonomy Manager</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage events, properties, and track changes across your analytics taxonomy
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('events')}
              className={`${
                activeTab === 'events'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Events ({events.length})
            </button>
            <button
              onClick={() => setActiveTab('properties')}
              className={`${
                activeTab === 'properties'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Property Registry ({properties.length})
            </button>
            <button
              onClick={() => setActiveTab('changelog')}
              className={`${
                activeTab === 'changelog'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Changelog
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`${
                activeTab === 'import'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Bulk Import
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow">
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
            <PropertyRegistry properties={properties} onRefresh={fetchProperties} />
          )}
          {activeTab === 'changelog' && (
            <Changelog changelog={changelog} />
          )}
          {activeTab === 'import' && (
            <BulkImport
              apiBase={API_BASE}
              onImportComplete={() => {
                fetchEvents()
                fetchProperties()
                fetchChangelog()
                setActiveTab('events')
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
  )
}

export default App
