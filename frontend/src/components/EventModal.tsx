import { useState, useEffect, FormEvent, MouseEvent, ChangeEvent } from 'react';
import axios from 'axios';
import { Event, EventPropertyCreate, PropertySuggestion } from '../types/api';

interface EventModalProps {
  event: Event | null;
  onClose: (refresh: boolean) => void;
  apiBase: string;
}

interface FormData {
  name: string;
  description: string;
  category: string;
  created_by: string;
}

interface PropertyFormData extends EventPropertyCreate {
  id?: number;
}

type ViewMode = 'ui' | 'json';

export default function EventModal({ event, onClose, apiBase }: EventModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    category: '',
    created_by: 'user@example.com'
  });
  const [properties, setProperties] = useState<PropertyFormData[]>([]);
  const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([]);
  const [currentProperty, setCurrentProperty] = useState<PropertyFormData>({
    property_name: '',
    property_type: 'event',
    data_type: 'String',
    is_required: false,
    example_value: '',
    description: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('ui');
  const [jsonText, setJsonText] = useState('');
  const [features, setFeatures] = useState<{ recent: string[]; all: string[]; default: string }>({
    recent: [],
    all: [],
    default: 'Engagement'
  });

  useEffect(() => {
    // Fetch available features
    const fetchFeatures = async () => {
      try {
        const response = await axios.get<{ recent: string[]; all: string[]; default: string }>(`${apiBase}/features`);
        setFeatures(response.data);
      } catch (error) {
        console.error('Error fetching features:', error);
      }
    };
    fetchFeatures();
  }, [apiBase]);

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name,
        description: event.description || '',
        category: event.category || '',
        created_by: event.created_by || 'user@example.com'
      });
      setProperties(event.properties || []);
    } else {
      // Set default feature for new events
      setFormData(prev => ({ ...prev, category: features.default }));
    }
  }, [event, features.default]);

  const checkPropertySuggestions = async (propertyName: string) => {
    if (propertyName.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await axios.get<{ suggestions: PropertySuggestion[] }>(`${apiBase}/properties/suggest`, {
        params: { q: propertyName }
      });
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handlePropertyNameChange = (value: string) => {
    setCurrentProperty({ ...currentProperty, property_name: value });
    checkPropertySuggestions(value);
  };

  const selectSuggestion = (suggestion: PropertySuggestion) => {
    setCurrentProperty({
      ...currentProperty,
      property_name: suggestion.name,
      data_type: suggestion.data_type
    });
    setSuggestions([]);
  };

  const addProperty = () => {
    if (!currentProperty.property_name) {
      alert('Property name is required');
      return;
    }

    // Check for duplicates
    if (properties.some(p => p.property_name === currentProperty.property_name && p.property_type === currentProperty.property_type)) {
      alert('This property is already added');
      return;
    }

    setProperties([...properties, { ...currentProperty, id: Date.now() }]);
    setCurrentProperty({
      property_name: '',
      property_type: 'event',
      data_type: 'String',
      is_required: false,
      example_value: '',
      description: ''
    });
    setSuggestions([]);
  };

  const removeProperty = (propId: number | undefined) => {
    setProperties(properties.filter(p => p.id !== propId));
  };

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
    };
    setJsonText(JSON.stringify(eventObj, null, 2));
  };

  const syncFromJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setFormData({
        name: parsed.name || '',
        description: parsed.description || '',
        category: parsed.category || '',
        created_by: formData.created_by
      });
      setProperties((parsed.properties || []).map((p: EventPropertyCreate, idx: number) => ({ ...p, id: Date.now() + idx })));
      setError('');
    } catch {
      setError('Invalid JSON format');
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === 'json' && viewMode === 'ui') {
      syncToJson();
    } else if (mode === 'ui' && viewMode === 'json') {
      syncFromJson();
    }
    setViewMode(mode);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // If in JSON mode, parse JSON directly for submission
      let submitFormData = formData;
      let submitProperties = properties;

      if (viewMode === 'json') {
        try {
          const parsed = JSON.parse(jsonText);
          submitFormData = {
            name: parsed.name || '',
            description: parsed.description || '',
            category: parsed.category || '',
            created_by: formData.created_by
          };
          submitProperties = (parsed.properties || []).map((p: EventPropertyCreate, idx: number) => ({ ...p, id: Date.now() + idx }));
        } catch {
          setError('Invalid JSON format');
          setSaving(false);
          return;
        }
      }

      const payload = {
        ...submitFormData,
        properties: submitProperties.map(p => ({
          property_name: p.property_name,
          property_type: p.property_type,
          data_type: p.data_type,
          is_required: p.is_required,
          example_value: p.example_value,
          description: p.description
        }))
      };

      if (event) {
        // Update event metadata only if changed
        const metadataChanged =
          submitFormData.name !== event.name ||
          submitFormData.description !== event.description ||
          submitFormData.category !== event.category;

        if (metadataChanged) {
          await axios.put(`${apiBase}/events/${event.id}`, {
            name: submitFormData.name,
            description: submitFormData.description,
            category: submitFormData.category
          }, {
            params: { changed_by: submitFormData.created_by }
          });
        }

        // Handle property changes - diff current vs original
        const originalProps = event.properties || [];
        const currentProps = submitProperties;

        // Find properties to remove (in original but not in current)
        const propsToRemove = originalProps.filter(
          origProp => !currentProps.some(cp => cp.id === origProp.id)
        );

        // Find properties to add (in current but not in original)
        const propsToAdd = currentProps.filter(
          currProp => !originalProps.some(op => op.id === currProp.id)
        );

        // Execute all property changes in parallel for better performance
        const deletePromises = propsToRemove.map(origProp =>
          axios.delete(`${apiBase}/events/${event.id}/properties/${origProp.id}`, {
            params: { changed_by: submitFormData.created_by }
          }).catch(err => ({ error: err, type: 'delete', property: origProp.property_name }))
        );

        const addPromises = propsToAdd.map(currProp =>
          axios.post(`${apiBase}/events/${event.id}/properties`, {
            property_name: currProp.property_name,
            property_type: currProp.property_type,
            data_type: currProp.data_type,
            is_required: currProp.is_required,
            example_value: currProp.example_value,
            description: currProp.description
          }, {
            params: { changed_by: submitFormData.created_by }
          }).catch(err => ({ error: err, type: 'add', property: currProp.property_name }))
        );

        // Wait for all operations to complete
        const results = await Promise.all([...deletePromises, ...addPromises]);

        // Check for partial failures
        const failures = results.filter(r => r && typeof r === 'object' && 'error' in r) as Array<{ error: unknown; type: string; property: string }>;
        if (failures.length > 0) {
          const failedOps = failures.map(f => `${f.type} '${f.property}'`).join(', ');
          console.error('Partial failures:', failures);
          // Still close but show warning - data was partially saved
          setError(`Some property changes failed: ${failedOps}. Please refresh and try again.`);
          setSaving(false);
          return;
        }
      } else {
        // Create event
        await axios.post(`${apiBase}/events`, payload);
      }

      onClose(true); // true = refresh data
    } catch (error) {
      console.error('Error saving event:', error);
      setError(axios.isAxiosError(error) ? error.response?.data?.detail || 'Failed to save event' : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
          onClose(false);
        }
      }}
    >
      <div className="bg-background border border-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden relative shadow-strong animate-scale-in">
        <div className="overflow-y-auto max-h-[90vh]">
          {/* Header with gradient accent */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-gradient-brand dark:bg-gradient-brand-dark shadow-medium">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {event ? 'Edit Event' : 'Create New Event'}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground ml-12">
                  {event ? 'Update event details and properties' : 'Define a new analytics event for your application'}
                </p>
              </div>
              <button
                onClick={() => onClose(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-start gap-3 animate-slide-down">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="mb-6 inline-flex p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => handleViewModeChange('ui')}
                className={`px-4 py-2 font-medium text-sm rounded-md transition-all ${viewMode === 'ui'
                  ? 'bg-background text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  UI Mode
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('json')}
                className={`px-4 py-2 font-medium text-sm rounded-md transition-all ${viewMode === 'json'
                  ? 'bg-background text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  JSON Mode
                </div>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {viewMode === 'ui' ? (
                <>
                  {/* Event Details */}
                  <div className="space-y-5 mb-8">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Event Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                        placeholder="e.g., Content Shared"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow resize-none"
                        rows={3}
                        placeholder="Describe when this event is triggered..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Category
                      </label>
                      <input
                        type="text"
                        list="features-list"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="Select or type a custom category"
                        className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
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
                            <option disabled>── All Categories ──</option>
                            {features.all
                              .filter(f => !features.recent.includes(f))
                              .map((f) => (
                                <option key={`all-${f}`} value={f} />
                              ))}
                          </>
                        )}
                      </datalist>
                      {features.recent.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Recently used: {features.recent.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Properties Section */}
                  <div className="border-t border-border pt-8 mb-8">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="p-2 rounded-lg bg-muted">
                        <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Properties</h3>
                      <span className="text-sm text-muted-foreground">({properties.length})</span>
                    </div>

                    {/* Add Property Form */}
                    <div className="bg-muted/50 border border-border p-5 rounded-lg mb-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative md:col-span-2">
                          <label className="block text-xs font-semibold text-foreground mb-2">
                            Property Name <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            value={currentProperty.property_name}
                            onChange={(e) => handlePropertyNameChange(e.target.value)}
                            className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                            placeholder="e.g., user_id"
                          />
                          {suggestions.length > 0 && (
                            <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-lg shadow-strong max-h-48 overflow-y-auto animate-slide-down">
                              <div className="sticky top-0 p-2.5 bg-accent/10 border-b border-accent/20 text-xs font-semibold text-accent-foreground flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Similar properties found
                              </div>
                              {suggestions.map((sug, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => selectSuggestion(sug)}
                                  className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0 transition-colors"
                                >
                                  <div className="text-sm font-medium text-foreground">{sug.name}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {sug.data_type} • {Math.round(sug.similarity * 100)}% match
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-2">
                            Property Type
                          </label>
                          <select
                            value={currentProperty.property_type}
                            onChange={(e) => setCurrentProperty({ ...currentProperty, property_type: e.target.value as 'event' | 'user' | 'super' })}
                            className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                          >
                            <option value="event">Event</option>
                            <option value="user">User</option>
                            <option value="super">Super</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-2">
                            Data Type
                          </label>
                          <select
                            value={currentProperty.data_type}
                            onChange={(e) => setCurrentProperty({ ...currentProperty, data_type: e.target.value })}
                            className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                          >
                            <option value="String">String</option>
                            <option value="Int">Int</option>
                            <option value="Float">Float</option>
                            <option value="Boolean">Boolean</option>
                            <option value="List">List</option>
                            <option value="JSON">JSON</option>
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-foreground mb-2">
                            Example Value
                          </label>
                          <input
                            type="text"
                            value={currentProperty.example_value || ''}
                            onChange={(e) => setCurrentProperty({ ...currentProperty, example_value: e.target.value })}
                            className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                            placeholder="e.g., abc123"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={currentProperty.is_required}
                              onChange={(e) => setCurrentProperty({ ...currentProperty, is_required: e.target.checked })}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
                            />
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Required property</span>
                          </label>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={addProperty}
                        className="mt-4 px-5 py-2.5 bg-gradient-brand dark:bg-gradient-brand-dark text-white font-medium rounded-lg hover:shadow-glow transition-all duration-200 hover:scale-105 active:scale-95 inline-flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Property
                      </button>
                    </div>

                    {/* Properties List */}
                    {properties.length > 0 && (
                      <div className="space-y-2">
                        {properties.map((prop, index) => (
                          <div key={prop.id} className="group flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-all duration-200 animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-foreground">{prop.property_name}</span>
                                {prop.is_required && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-destructive/10 text-destructive">
                                    Required
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${prop.property_type === 'event' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                  prop.property_type === 'user' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                                  }`}>
                                  {prop.property_type}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{prop.data_type}</code>
                                {prop.example_value && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-xs">e.g., {prop.example_value}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProperty(prop.id)}
                              className="ml-4 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {properties.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <p className="text-sm">No properties added yet</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* JSON Mode */
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Event JSON
                    </label>
                    <textarea
                      value={jsonText}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setJsonText(e.target.value)}
                      className="w-full h-96 px-4 py-3 border border-border rounded-lg bg-background text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow resize-none"
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
                    <p className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Edit the JSON directly. Switch back to UI Mode to apply changes.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => onClose(false)}
                  className="px-6 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-brand dark:bg-gradient-brand-dark text-white font-medium rounded-lg hover:shadow-glow transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 inline-flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {event ? 'Update Event' : 'Create Event'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
