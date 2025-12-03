import { useState } from 'react'

export default function EventList({ events, loading, onCreateEvent, onEditEvent, onDeleteEvent }) {
  const [expandedEvent, setExpandedEvent] = useState(null)

  const toggleEvent = (eventId) => {
    setExpandedEvent(expandedEvent === eventId ? null : eventId)
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Engagement': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Navigation': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Transaction': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'User': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    }
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Loading events...
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Events ({events.length})
        </h2>
        <button
          onClick={onCreateEvent}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + New Event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>No events found. Create your first event to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Event Header */}
              <div
                className="p-4 bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                onClick={() => toggleEvent(event.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-medium text-gray-900 dark:text-white">
                        {expandedEvent === event.id ? '▼' : '▶'} {event.name}
                      </span>
                      {event.category && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(event.category)}`}>
                          {event.category}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{event.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {event.properties.length} properties
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditEvent(event)
                      }}
                      className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteEvent(event.id)
                      }}
                      className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Event Details */}
              {expandedEvent === event.id && (
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Properties</h3>
                  {event.properties.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No properties added yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Required</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Example</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {event.properties.map((prop) => (
                            <tr key={prop.id}>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">{prop.property_name}</td>
                              <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  prop.property_type === 'event' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                  prop.property_type === 'user' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                }`}>
                                  {prop.property_type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">{prop.data_type}</td>
                              <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                                {prop.is_required ? '✓' : '—'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {prop.example_value || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {event.created_by && (
                    <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                      Last modified: {new Date(event.updated_at).toLocaleString()} by {event.created_by}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
