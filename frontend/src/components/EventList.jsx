import { useState } from 'react'

export default function EventList({ events, loading, onCreateEvent, onEditEvent, onDeleteEvent }) {
  const [expandedEvent, setExpandedEvent] = useState(null)

  const toggleEvent = (eventId) => {
    setExpandedEvent(expandedEvent === eventId ? null : eventId)
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Engagement': 'bg-purple-100 text-purple-800',
      'Navigation': 'bg-blue-100 text-blue-800',
      'Transaction': 'bg-green-100 text-green-800',
      'User': 'bg-yellow-100 text-yellow-800',
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading events...
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
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
        <div className="text-center py-12 text-gray-500">
          <p>No events found. Create your first event to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Event Header */}
              <div
                className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                onClick={() => toggleEvent(event.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-medium text-gray-900">
                        {expandedEvent === event.id ? '▼' : '▶'} {event.name}
                      </span>
                      {event.category && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(event.category)}`}>
                          {event.category}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="mt-1 text-sm text-gray-600">{event.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {event.properties.length} properties
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditEvent(event)
                      }}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteEvent(event.id)
                      }}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Event Details */}
              {expandedEvent === event.id && (
                <div className="p-4 bg-white border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Properties</h3>
                  {event.properties.length === 0 ? (
                    <p className="text-sm text-gray-500">No properties added yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Example</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {event.properties.map((prop) => (
                            <tr key={prop.id}>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900">{prop.property_name}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  prop.property_type === 'event' ? 'bg-blue-100 text-blue-800' :
                                  prop.property_type === 'user' ? 'bg-green-100 text-green-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {prop.property_type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600">{prop.data_type}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">
                                {prop.is_required ? '✓' : '—'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500 font-mono">
                                {prop.example_value || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {event.created_by && (
                    <p className="mt-4 text-xs text-gray-500">
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
