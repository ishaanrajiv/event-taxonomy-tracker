import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

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
        // Update event metadata
        await axios.put(`${apiBase}/events/${event.id}`, {
          name: formData.name,
          description: formData.description,
          category: formData.category
        }, {
          params: { changed_by: formData.created_by }
        })

        // Handle property changes - diff current vs original
        const originalProps = event.properties || []
        const currentProps = properties

        // Find properties to remove (in original but not in current)
        for (const origProp of originalProps) {
          const stillExists = currentProps.some(cp => cp.id === origProp.id)
          if (!stillExists) {
            await axios.delete(`${apiBase}/events/${event.id}/properties/${origProp.id}`, {
              params: { changed_by: formData.created_by }
            })
          }
        }

        // Find properties to add (in current but not in original)
        for (const currProp of currentProps) {
          const isNew = !originalProps.some(op => op.id === currProp.id)
          if (isNew) {
            await axios.post(`${apiBase}/events/${event.id}/properties`, {
              property_name: currProp.property_name,
              property_type: currProp.property_type,
              data_type: currProp.data_type,
              is_required: currProp.is_required,
              example_value: currProp.example_value,
              description: currProp.description
            }, {
              params: { changed_by: formData.created_by }
            })
          }
        }
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
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose(false)
        }
      }}
    >
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-2xl font-bold">
              {event ? 'Edit Event' : 'Create New Event'}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onClose(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
              {error}
            </div>
          )}

          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={handleViewModeChange} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="ui">UI Mode</TabsTrigger>
              <TabsTrigger value="json">JSON Mode</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit}>
              <TabsContent value="ui" className="space-y-6">
                {/* Event Details */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="event-name">Event Name *</Label>
                    <Input
                      id="event-name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Content Shared"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-description">Description</Label>
                    <Textarea
                      id="event-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Describe when this event is triggered..."
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-category">Feature</Label>
                    <Input
                      id="event-category"
                      type="text"
                      list="features-list"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Select or type a custom feature"
                      className="mt-1"
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      {features.recent.length > 0
                        ? `Recently used: ${features.recent.join(', ')}`
                        : 'Start typing to add a custom feature'}
                    </p>
                  </div>
                </div>

                {/* Properties */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Properties</h3>

                  {/* Add Property Form */}
                  <Card className="p-4 mb-4 bg-muted/30">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Label htmlFor="prop-name" className="text-xs">Property Name *</Label>
                        <Input
                          id="prop-name"
                          type="text"
                          value={currentProperty.property_name}
                          onChange={(e) => handlePropertyNameChange(e.target.value)}
                          placeholder="e.g., user_id"
                          className="mt-1"
                        />
                        {suggestions.length > 0 && (
                          <Card className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto">
                            <div className="p-2 bg-yellow-500/10 border-b border-yellow-500/20 text-xs text-yellow-900 dark:text-yellow-200">
                              Similar properties found:
                            </div>
                            {suggestions.map((sug, idx) => (
                              <div
                                key={idx}
                                onClick={() => selectSuggestion(sug)}
                                className="px-3 py-2 hover:bg-accent cursor-pointer border-b last:border-b-0"
                              >
                                <div className="text-sm font-medium">{sug.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {sug.data_type} • {Math.round(sug.similarity * 100)}% match
                                </div>
                              </div>
                            ))}
                          </Card>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="prop-type" className="text-xs">Property Type</Label>
                        <Select
                          value={currentProperty.property_type}
                          onValueChange={(value) => setCurrentProperty({ ...currentProperty, property_type: value })}
                        >
                          <SelectTrigger id="prop-type" className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="event">Event</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="super">Super</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="prop-datatype" className="text-xs">Data Type</Label>
                        <Select
                          value={currentProperty.data_type}
                          onValueChange={(value) => setCurrentProperty({ ...currentProperty, data_type: value })}
                        >
                          <SelectTrigger id="prop-datatype" className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="String">String</SelectItem>
                            <SelectItem value="Int">Int</SelectItem>
                            <SelectItem value="Float">Float</SelectItem>
                            <SelectItem value="Boolean">Boolean</SelectItem>
                            <SelectItem value="List">List</SelectItem>
                            <SelectItem value="JSON">JSON</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="prop-example" className="text-xs">Example Value</Label>
                        <Input
                          id="prop-example"
                          type="text"
                          value={currentProperty.example_value}
                          onChange={(e) => setCurrentProperty({ ...currentProperty, example_value: e.target.value })}
                          placeholder="e.g., abc123"
                          className="mt-1"
                        />
                      </div>

                      <div className="col-span-2 flex items-center space-x-2">
                        <Checkbox
                          id="prop-required"
                          checked={currentProperty.is_required}
                          onCheckedChange={(checked) => setCurrentProperty({ ...currentProperty, is_required: checked })}
                        />
                        <Label htmlFor="prop-required" className="text-sm font-normal cursor-pointer">
                          Required property
                        </Label>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={addProperty}
                      className="mt-3"
                      size="sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Property
                    </Button>
                  </Card>

                  {/* Properties List */}
                  {properties.length > 0 && (
                    <div className="space-y-2">
                      {properties.map((prop) => (
                        <Card key={prop.id} className="p-3 flex items-center justify-between">
                          <div className="flex-1 flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{prop.property_name}</span>
                            <Badge variant="secondary">{prop.property_type}</Badge>
                            <Badge variant="outline">{prop.data_type}</Badge>
                            {prop.is_required && (
                              <Badge variant="destructive">Required</Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProperty(prop.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="json" className="space-y-4">
                <div>
                  <Label htmlFor="json-editor">Event JSON</Label>
                  <Textarea
                    id="json-editor"
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    className="h-96 font-mono text-sm mt-1"
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
                  <p className="mt-2 text-xs text-muted-foreground">
                    Edit the JSON directly. Switch back to UI Mode to apply changes.
                  </p>
                </div>
              </TabsContent>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onClose(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
                </Button>
              </div>
            </form>
          </Tabs>
        </div>
      </Card>
    </div>
  )
}
