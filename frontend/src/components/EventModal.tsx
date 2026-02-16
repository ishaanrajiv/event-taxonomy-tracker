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

        const originalProps = event.properties || [];
        const currentProps = submitProperties;

        const propsToRemove = originalProps.filter(
          origProp => !currentProps.some(cp => cp.id === origProp.id)
        );

        const propsToAdd = currentProps.filter(
          currProp => !originalProps.some(op => op.id === currProp.id)
        );

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

        const results = await Promise.all([...deletePromises, ...addPromises]);

        const failures = results.filter(r => r && typeof r === 'object' && 'error' in r) as Array<{ error: unknown; type: string; property: string }>;
        if (failures.length > 0) {
          const failedOps = failures.map(f => `${f.type} '${f.property}'`).join(', ');
          console.error('Partial failures:', failures);
          setError(`Some property changes failed: ${failedOps}. Please refresh and try again.`);
          setSaving(false);
          return;
        }
      } else {
        await axios.post(`${apiBase}/events`, payload);
      }

      onClose(true);
    } catch (error) {
      console.error('Error saving event:', error);
      setError(axios.isAxiosError(error) ? error.response?.data?.detail || 'Failed to save event' : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      <div className="bg-card border border-border rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-strong animate-scale-in">
        <div className="overflow-y-auto max-h-[90vh]">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
                  {event ? 'Edit Event' : 'Create Event'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event ? 'Update event details and properties' : 'Define a new analytics event'}
                </p>
              </div>
              <button
                onClick={() => onClose(false)}
                className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-5">
            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-destructive/8 border border-destructive/20 rounded-lg text-destructive text-xs font-medium flex items-start gap-2 animate-slide-down">
                <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="mb-5 flex gap-1 p-1 bg-muted/50 rounded-lg w-fit border border-border/50">
              <button
                type="button"
                onClick={() => handleViewModeChange('ui')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'ui'
                    ? 'bg-card text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Form
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('json')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'json'
                    ? 'bg-card text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                JSON
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {viewMode === 'ui' ? (
                <>
                  {/* Event Details */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Event Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-9 px-3 text-sm border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all"
                        placeholder="e.g., Content Shared"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all resize-none"
                        rows={2}
                        placeholder="Describe when this event is triggered..."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Category
                      </label>
                      <input
                        type="text"
                        list="features-list"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="Select or type a category"
                        className="w-full h-9 px-3 text-sm border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all"
                      />
                      <datalist id="features-list">
                        {features.recent.length > 0 && (
                          <>
                            <option disabled>Recently Used</option>
                            {features.recent.map((f) => (
                              <option key={`recent-${f}`} value={f} />
                            ))}
                          </>
                        )}
                        {features.all.filter(f => !features.recent.includes(f)).length > 0 && (
                          <>
                            <option disabled>All Categories</option>
                            {features.all
                              .filter(f => !features.recent.includes(f))
                              .map((f) => (
                                <option key={`all-${f}`} value={f} />
                              ))}
                          </>
                        )}
                      </datalist>
                      {features.recent.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Recent: {features.recent.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Properties Section */}
                  <div className="border-t border-border pt-5 mb-5">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Properties
                      </h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {properties.length}
                      </span>
                    </div>

                    {/* Add Property Form */}
                    <div className="bg-muted/30 border border-border/60 p-4 rounded-lg mb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative sm:col-span-2">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Name <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            value={currentProperty.property_name}
                            onChange={(e) => handlePropertyNameChange(e.target.value)}
                            className="w-full h-8 px-2.5 text-xs border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all font-mono"
                            placeholder="e.g., user_id"
                          />
                          {suggestions.length > 0 && (
                            <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-strong max-h-40 overflow-y-auto animate-slide-down">
                              <div className="p-2 bg-primary/5 border-b border-border text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Similar properties
                              </div>
                              {suggestions.map((sug, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => selectSuggestion(sug)}
                                  className="px-3 py-2 hover:bg-muted/50 cursor-pointer border-b border-border/30 last:border-b-0 transition-colors"
                                >
                                  <div className="text-xs font-mono font-medium text-foreground">{sug.name}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {sug.data_type} / {Math.round(sug.similarity * 100)}% match
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Property Type
                          </label>
                          <select
                            value={currentProperty.property_type}
                            onChange={(e) => setCurrentProperty({ ...currentProperty, property_type: e.target.value as 'event' | 'user' | 'super' })}
                            className="w-full h-8 px-2.5 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all"
                          >
                            <option value="event">Event</option>
                            <option value="user">User</option>
                            <option value="super">Super</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Data Type
                          </label>
                          <select
                            value={currentProperty.data_type}
                            onChange={(e) => setCurrentProperty({ ...currentProperty, data_type: e.target.value })}
                            className="w-full h-8 px-2.5 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all"
                          >
                            <option value="String">String</option>
                            <option value="Int">Int</option>
                            <option value="Float">Float</option>
                            <option value="Boolean">Boolean</option>
                            <option value="List">List</option>
                            <option value="JSON">JSON</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Example Value
                          </label>
                          <input
                            type="text"
                            value={currentProperty.example_value || ''}
                            onChange={(e) => setCurrentProperty({ ...currentProperty, example_value: e.target.value })}
                            className="w-full h-8 px-2.5 text-xs border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all font-mono"
                            placeholder="e.g., abc123"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={currentProperty.is_required}
                              onChange={(e) => setCurrentProperty({ ...currentProperty, is_required: e.target.checked })}
                              className="w-3.5 h-3.5 rounded border-input text-primary focus:ring-2 focus:ring-ring/40"
                            />
                            <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                              Required property
                            </span>
                          </label>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={addProperty}
                        className="mt-3 inline-flex items-center gap-1.5 h-7 px-3 text-[11px] font-semibold bg-primary text-primary-foreground rounded-md hover:shadow-glow transition-all active:scale-[0.97]"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add
                      </button>
                    </div>

                    {/* Properties List */}
                    {properties.length > 0 && (
                      <div className="space-y-1.5">
                        {properties.map((prop, index) => (
                          <div
                            key={prop.id}
                            className="group flex items-center justify-between px-3 py-2.5 bg-background border border-border/40 rounded-lg hover:border-border transition-all animate-slide-up"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs font-semibold font-mono text-foreground">{prop.property_name}</span>
                                {prop.is_required && (
                                  <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-destructive/10 text-destructive uppercase">
                                    Req
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                                  prop.property_type === 'event' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300' :
                                  prop.property_type === 'user' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300' :
                                  'bg-violet-100 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300'
                                }`}>
                                  {prop.property_type}
                                </span>
                                <code className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">{prop.data_type}</code>
                                {prop.example_value && (
                                  <span className="text-[10px] truncate max-w-[120px]">e.g. {prop.example_value}</span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProperty(prop.id)}
                              className="ml-2 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/8 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {properties.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-xs">No properties added yet</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* JSON Mode */
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Event JSON
                    </label>
                    <textarea
                      value={jsonText}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setJsonText(e.target.value)}
                      className="w-full h-80 px-3 py-2.5 border border-input rounded-lg bg-background text-foreground font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all resize-none"
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
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Edit JSON directly. Switch to Form mode to apply changes.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => onClose(false)}
                  className="h-8 px-4 text-xs font-semibold border border-input rounded-lg text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 px-4 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:shadow-glow transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    event ? 'Update Event' : 'Create Event'
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
