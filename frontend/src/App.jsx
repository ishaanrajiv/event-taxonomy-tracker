import { useState, useEffect } from 'react'
import axios from 'axios'
import { Moon, Sun } from 'lucide-react'
import EventList from './components/EventList'
import EventModal from './components/EventModal'
import PropertyRegistry from './components/PropertyRegistry'
import Changelog from './components/Changelog'
import BulkImport from './components/BulkImport'
import { useDarkMode } from './hooks/useDarkMode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'

const API_BASE = 'http://localhost:8000/api'

function App() {
  const [isDarkMode, setIsDarkMode] = useDarkMode()
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
      await axios.delete(`${API_BASE}/events/${eventId}`, {
        params: { changed_by: 'user@example.com' }
      })
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
    <div className="min-h-screen gradient-bg transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Event Taxonomy Manager
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage events, properties, and track changes across your analytics taxonomy
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="rounded-full"
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 lg:w-auto">
            <TabsTrigger value="events">
              Events ({events.length})
            </TabsTrigger>
            <TabsTrigger value="properties">
              Properties ({properties.length})
            </TabsTrigger>
            <TabsTrigger value="changelog">
              Changelog
            </TabsTrigger>
            <TabsTrigger value="import">
              Import
            </TabsTrigger>
          </TabsList>

          <Card className="glass border-border/50 shadow-xl">
            <TabsContent value="events" className="m-0">
              <EventList
                events={events}
                loading={loading}
                onCreateEvent={handleCreateEvent}
                onEditEvent={handleEditEvent}
                onDeleteEvent={handleDeleteEvent}
              />
            </TabsContent>

            <TabsContent value="properties" className="m-0">
              <PropertyRegistry properties={properties} onRefresh={fetchProperties} />
            </TabsContent>

            <TabsContent value="changelog" className="m-0">
              <Changelog changelog={changelog} />
            </TabsContent>

            <TabsContent value="import" className="m-0">
              <BulkImport
                apiBase={API_BASE}
                onImportComplete={() => {
                  fetchEvents()
                  fetchProperties()
                  fetchChangelog()
                  setActiveTab('events')
                }}
              />
            </TabsContent>
          </Card>
        </Tabs>
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
