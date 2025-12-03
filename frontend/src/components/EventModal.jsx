import { useState, useEffect } from 'react'
import axios from 'axios'

export default function EventModal({ event, onClose, apiBase }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    created_by: 'user@example.com'
  })
  const [properties, setProperties] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [currentProperty, setCurrentProperty] = useState({
    property_name: '',
    property_type: 'event',
    data_type: 'String',
    is_required: false,
    example_value: '',
    description: ''
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState('ui') // 'ui' or 'json'
  const [jsonText, setJsonText] = useState('')
  const [features, setFeatures] = useState({ recent: [], all: [], default: 'Engagement' })

  useEffect(() => {
    // Fetch available features
    const fetchFeatures = async () => {
      try {
        const response = await axios.get(`${apiBase}/features`)
        setFeatures(response.data)
      } catch (error) {
        console.error('Error fetching features:', error)
      }
    }
    fetchFeatures()
  }, [apiBase])

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name,
        description: event.description || '',
        category: event.category || '',
        created_by: event.created_by || 'user@example.com'
      })
      setProperties(event.properties || [])
    } else {
      // Set default feature for new events
      setFormData(prev => ({ ...prev, category: features.default }))
    }
  }, [event, features.default])

  const checkPropertySuggestions = async (propertyName) => {
    if (propertyName.length < 2) {
      setSuggestions([])
      return
    }

    try {
      const response = await axios.get(`${apiBase}/properties/suggest`, {
        params: { q: propertyName }
      })
      setSuggestions(response.data.suggestions || [])
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    }
  }

  const handlePropertyNameChange = (value) => {
    setCurrentProperty({ ...currentProperty, property_name: value })
    checkPropertySuggestions(value)
  }

  const selectSuggestion = (suggestion) => {
    setCurrentProperty({
      ...currentProperty,
      property_name: suggestion.name,
      data_type: suggestion.data_type
    })
    setSuggestions([])
  }

  const addProperty = () => {
    if (!currentProperty.property_name) {
      alert('Property name is required')
      return
    }

    // Check for duplicates
    if (properties.some(p => p.property_name === currentProperty.property_name && p.property_type === currentProperty.property_type)) {
      alert('This property is already added')
      return
    }

    setProperties([...properties, { ...currentProperty, id: Date.now() }])
    setCurrentProperty({
      property_name: '',
      property_type: 'event',
      data_type: 'String',
      is_required: false,
      example_value: '',
      description: ''
    })
    setSuggestions([])
  }

  const removeProperty = (propId) => {
    setProperties(properties.filter(p => p.id !== propId))
  }

  const syncToJson = () => {
    const eventObj = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      properties: properties.map(p => ({
        property_name: p.property_name,
        property_type: p.property_type,
        data_type: p.data_type,
        is_required: p.is_required,
        example_value: p.example_value,
        description: p.description
      }))
    }
    setJsonText(JSON.stringify(eventObj, null, 2))
  }

  const syncFromJson = () => {
    try {
      const parsed = JSON.parse(jsonText)
      setFormData({
        name: parsed.name || '',
        description: parsed.description || '',
        category: parsed.category || '',
        created_by: formData.created_by
      })
      setProperties((parsed.properties || []).map((p, idx) => ({ ...p, id: Date.now() + idx })))
      setError('')
    } catch (e) {
      setError('Invalid JSON format')
    }
  }

  const handleViewModeChange = (mode) => {
    if (mode === 'json' && viewMode === 'ui') {
      syncToJson()
    } else if (mode === 'ui' && viewMode === 'json') {
      syncFromJson()
    }
    setViewMode(mode)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const payload = {
        ...formData,
        properties: properties.map(p => ({
          property_name: p.property_name,
          property_type: p.property_type,
          data_type: p.data_type,
          is_required: p.is_required,
          example_value: p.example_value,
          description: p.description
        }))
      }

      if (event) {
        // Update event
        await axios.put(`${apiBase}/events/${event.id}`, {
          name: formData.name,
          description: formData.description,
          category: formData.category
        })

        // Handle property changes (simplified for POC)
        // In production, you'd want to diff and update individually
      } else {
        // Create event
        await axios.post(`${apiBase}/events`, payload)
      }

      onClose(true) // true = refresh data
    } catch (error) {
      console.error('Error saving event:', error)
      setError(error.response?.data?.detail || 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose(false)
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {event ? 'Edit Event' : 'Create New Event'}
            </h2>
            <button
              onClick={() => onClose(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => handleViewModeChange('ui')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${viewMode === 'ui'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              UI Mode
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('json')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${viewMode === 'json'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              JSON Mode
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {viewMode === 'ui' ? (
              <>
                {/* Event Details */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Event Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Content Shared"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows="3"
                      placeholder="Describe when this event is triggered..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Feature
                    </label>
                    <input
                      type="text"
                      list="features-list"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Select or type a custom feature"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <datalist id="features-list">
                      {features.recent.length > 0 && (
                        <>
                          <option disabled>── Recently Used ──</option>
                          {features.recent.map((f) => (
                            <option key={`recent-${f}`} value={f} />
                          ))}
                        </>
                      )}
                      {features.all.filter(f => !features.recent.includes(f)).length > 0 && (
                        <>
                          <option disabled>── All Features ──</option>
                          {features.all
                            .filter(f => !features.recent.includes(f))
                            .map((f) => (
                              <option key={`all-${f}`} value={f} />
                            ))}
                        </>
                      )}
                    </datalist>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {features.recent.length > 0
                        ? `Recently used: ${features.recent.join(', ')}`
                        : 'Start typing to add a custom feature'}
                    </p>
                  </div>
                </div>

                {/* Properties */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Properties</h3>

                  {/* Add Property Form */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Property Name *
                        </label>
                        <input
                          type="text"
                          value={currentProperty.property_name}
                          onChange={(e) => handlePropertyNameChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., user_id"
                        />
                        {suggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-200">
                              Similar properties found:
                            </div>
                            {suggestions.map((sug, idx) => (
                              <div
                                key={idx}
                                onClick={() => selectSuggestion(sug)}
                                className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                              >
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{sug.name}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {sug.data_type} • {Math.round(sug.similarity * 100)}% match
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Property Type
                        </label>
                        <select
                          value={currentProperty.property_type}
                          onChange={(e) => setCurrentProperty({ ...currentProperty, property_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="event">Event</option>
                          <option value="user">User</option>
                          <option value="super">Super</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Data Type
                        </label>
                        <select
                          value={currentProperty.data_type}
                          onChange={(e) => setCurrentProperty({ ...currentProperty, data_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="String">String</option>
                          <option value="Int">Int</option>
                          <option value="Float">Float</option>
                          <option value="Boolean">Boolean</option>
                          <option value="List">List</option>
                          <option value="JSON">JSON</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Example Value
                        </label>
                        <input
                          type="text"
                          value={currentProperty.example_value}
                          onChange={(e) => setCurrentProperty({ ...currentProperty, example_value: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder="e.g., abc123"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={currentProperty.is_required}
                            onChange={(e) => setCurrentProperty({ ...currentProperty, is_required: e.target.checked })}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Required property</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addProperty}
                      className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      + Add Property
                    </button>
                  </div>

                  {/* Properties List */}
                  {properties.length > 0 && (
                    <div className="space-y-2">
                      {properties.map((prop) => (
                        <div key={prop.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium text-gray-900 dark:text-white">{prop.property_name}</span>
                            <span className="mx-2 text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-sm text-gray-600 dark:text-gray-300">{prop.property_type}</span>
                            <span className="mx-2 text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-sm text-gray-600 dark:text-gray-300">{prop.data_type}</span>
                            {prop.is_required && (
                              <>
                                <span className="mx-2 text-gray-400 dark:text-gray-500">•</span>
                                <span className="text-xs text-red-600 dark:text-red-400 font-medium">Required</span>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeProperty(prop.id)}
                            className="ml-4 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* JSON Mode */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Event JSON
                  </label>
                  <textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    className="w-full h-96 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`{
  "name": "Event Name",
  "description": "Event description",
  "category": "Engagement",
  "properties": [
    {
      "property_name": "property_name",
      "property_type": "event",
      "data_type": "String",
      "is_required": true,
      "example_value": "example",
      "description": "Property description"
    }
  ]
}`}
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Edit the JSON directly. Switch back to UI Mode to apply changes.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
