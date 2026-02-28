import { ChangeEvent, FormEvent, MouseEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Event, EventWriteProperty, PropertySuggestion } from '../types/api';

interface EventModalProps {
  event: Event | null;
  initialEvent: Event | null;
  onClose: (refresh: boolean) => void;
  apiBase: string;
  trackingPlanId?: number;
}

interface FormState {
  name: string;
  description: string;
  category: string;
  created_by: string;
  change_reason: string;
}

interface PropertyFormState extends EventWriteProperty {
  id: number;
}

type ViewMode = 'ui' | 'json';

const DEFAULT_USER = 'user@example.com';

const createLocalId = () => Date.now() + Math.floor(Math.random() * 1000);

const toNullable = (value: string) => {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};

const toPropertyFormState = (property: EventWriteProperty, id = createLocalId()): PropertyFormState => ({
  ...property,
  id,
  example_value: property.example_value || '',
  description: property.description || '',
});

export default function EventModal({ event, initialEvent, onClose, apiBase, trackingPlanId }: EventModalProps) {
  const [formState, setFormState] = useState<FormState>({
    name: '',
    description: '',
    category: '',
    created_by: DEFAULT_USER,
    change_reason: '',
  });
  const [properties, setProperties] = useState<PropertyFormState[]>([]);
  const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([]);
  const [currentProperty, setCurrentProperty] = useState<PropertyFormState>({
    id: createLocalId(),
    property_name: '',
    property_type: 'event',
    data_type: 'String',
    is_required: false,
    example_value: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('ui');
  const [jsonText, setJsonText] = useState('');
  const [features, setFeatures] = useState<{ recent: string[]; all: string[] }>({
    recent: [],
    all: [],
  });

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const response = await axios.get<{ recent: string[]; all: string[]; default?: string }>(`${apiBase}/features`);
        setFeatures({
          recent: response.data.recent ?? [],
          all: response.data.all ?? [],
        });
      } catch (fetchError) {
        console.error('Error fetching features:', fetchError);
      }
    };

    void fetchFeatures();
  }, [apiBase]);

  useEffect(() => {
    const source = event ?? initialEvent;
    if (source) {
      setFormState({
        name: source.name,
        description: source.description || '',
        category: source.category || '',
        created_by: source.created_by || DEFAULT_USER,
        change_reason: '',
      });
      setProperties(source.properties.map((property, index) => toPropertyFormState(property, Date.now() + index)));
      return;
    }

    setFormState({
      name: '',
      description: '',
      category: '',
      created_by: DEFAULT_USER,
      change_reason: '',
    });
    setProperties([]);
  }, [event, initialEvent]);

  const syncToJson = () => {
    setJsonText(
      JSON.stringify(
        {
          name: formState.name,
          description: toNullable(formState.description),
          category: toNullable(formState.category),
          properties: properties.map((property) => ({
            property_name: property.property_name,
            property_type: property.property_type,
            data_type: property.data_type,
            is_required: property.is_required,
            example_value: toNullable(property.example_value || ''),
            description: toNullable(property.description || ''),
          })),
        },
        null,
        2
      )
    );
  };

  const syncFromJson = (): boolean => {
    try {
      const parsed = JSON.parse(jsonText) as {
        name?: string;
        description?: string | null;
        category?: string | null;
        properties?: EventWriteProperty[];
      };

      setFormState((current) => ({
        ...current,
        name: parsed.name || '',
        description: parsed.description || '',
        category: parsed.category || '',
      }));
      setProperties((parsed.properties || []).map((property, index) => toPropertyFormState(property, Date.now() + index)));
      setError('');
      return true;
    } catch {
      setError('Invalid JSON format');
      return false;
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === viewMode) return;
    if (mode === 'json') {
      syncToJson();
    } else if (!syncFromJson()) {
      return;
    }
    setViewMode(mode);
  };

  const checkPropertySuggestions = async (propertyName: string) => {
    if (propertyName.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await axios.get<{ suggestions: PropertySuggestion[] }>(`${apiBase}/properties/suggest`, {
        params: { q: propertyName },
      });
      setSuggestions(response.data.suggestions || []);
    } catch (fetchError) {
      console.error('Error fetching suggestions:', fetchError);
    }
  };

  const handlePropertyNameChange = (value: string) => {
    setCurrentProperty((current) => ({ ...current, property_name: value }));
    void checkPropertySuggestions(value);
  };

  const selectSuggestion = (suggestion: PropertySuggestion) => {
    setCurrentProperty((current) => ({
      ...current,
      property_name: suggestion.name,
      data_type: suggestion.data_type,
    }));
    setSuggestions([]);
  };

  const addProperty = () => {
    if (!currentProperty.property_name.trim()) {
      alert('Property name is required');
      return;
    }

    if (
      properties.some(
        (property) =>
          property.property_name === currentProperty.property_name.trim() &&
          property.property_type === currentProperty.property_type
      )
    ) {
      alert('This property is already added');
      return;
    }

    setProperties((current) => [
      ...current,
      {
        ...currentProperty,
        property_name: currentProperty.property_name.trim(),
        id: createLocalId(),
      },
    ]);
    setCurrentProperty({
      id: createLocalId(),
      property_name: '',
      property_type: 'event',
      data_type: 'String',
      is_required: false,
      example_value: '',
      description: '',
    });
    setSuggestions([]);
  };

  const removeProperty = (propertyId: number) => {
    setProperties((current) => current.filter((property) => property.id !== propertyId));
  };

  const buildPayload = (form: FormState, eventProperties: PropertyFormState[]) => ({
    name: form.name.trim(),
    description: toNullable(form.description),
    category: toNullable(form.category),
    properties: eventProperties.map((property) => ({
      property_name: property.property_name.trim(),
      property_type: property.property_type,
      data_type: property.data_type,
      is_required: property.is_required,
      example_value: toNullable(property.example_value || ''),
      description: toNullable(property.description || ''),
    })),
  });

  const handleSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setError('');
    setSaving(true);

    try {
      let nextFormState = formState;
      let nextProperties = properties;

      if (viewMode === 'json') {
        const synced = syncFromJson();
        if (!synced) {
          setSaving(false);
          return;
        }

        const parsed = JSON.parse(jsonText) as {
          name?: string;
          description?: string | null;
          category?: string | null;
          properties?: EventWriteProperty[];
        };
        nextFormState = {
          ...formState,
          name: parsed.name || '',
          description: parsed.description || '',
          category: parsed.category || '',
        };
        nextProperties = (parsed.properties || []).map((property, index) => toPropertyFormState(property, Date.now() + index));
      }

      const payload = buildPayload(nextFormState, nextProperties);

      if (event) {
        await axios.put(`${apiBase}/events/${event.id}`, {
          ...payload,
          base_version_number: event.version_number,
          changed_by: nextFormState.created_by,
          change_reason: toNullable(nextFormState.change_reason),
        });
      } else {
        // Create event - use tracking plan endpoint if trackingPlanId is provided
        const endpoint = trackingPlanId
          ? `${apiBase}/tracking-plans/${trackingPlanId}/events/create`
          : `${apiBase}/events`;

        await axios.post(endpoint, {
          ...payload,
          created_by: nextFormState.created_by,
          change_reason: toNullable(nextFormState.change_reason),
        });
      }

      onClose(true);
    } catch (submitError) {
      console.error('Error saving event:', submitError);
      if (axios.isAxiosError(submitError) && submitError.response?.status === 409) {
        setError('This event changed since you opened it. Reload and retry.');
      } else {
        setError(
          axios.isAxiosError(submitError)
            ? submitError.response?.data?.detail || 'Failed to save event'
            : 'Failed to save event'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(clickEvent: MouseEvent<HTMLDivElement>) => {
        if (clickEvent.target === clickEvent.currentTarget) onClose(false);
      }}
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-border bg-card shadow-strong animate-scale-in">
        <div className="max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-5 py-4 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                    {event ? 'Edit Event' : 'Create Event'}
                  </h2>
                  {event && (
                    <span className="inline-flex rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      v{event.version_number}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {event ? 'Submit a complete event definition as the next immutable version.' : 'Define a new analytics event and capture version 1.'}
                </p>
              </div>
              <button
                onClick={() => onClose(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-5">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/8 p-3 text-xs font-medium text-destructive animate-slide-down">
                <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="mb-5 flex w-fit gap-1 rounded-lg border border-border/50 bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => handleViewModeChange('ui')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === 'ui'
                    ? 'bg-card text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Form
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('json')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === 'json'
                    ? 'bg-card text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                JSON
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Event Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.name}
                      onChange={(changeEvent) => setFormState((current) => ({ ...current, name: changeEvent.target.value }))}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                      placeholder="e.g., Checkout Started"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Description
                    </label>
                    <textarea
                      value={formState.description}
                      onChange={(changeEvent) => setFormState((current) => ({ ...current, description: changeEvent.target.value }))}
                      className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                      rows={3}
                      placeholder="Describe when this event is triggered..."
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Category
                      </label>
                      <input
                        type="text"
                        list="features-list"
                        value={formState.category}
                        onChange={(changeEvent) => setFormState((current) => ({ ...current, category: changeEvent.target.value }))}
                        placeholder="Select or type a category"
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                      />
                      <datalist id="features-list">
                        {features.recent.map((feature) => (
                          <option key={`recent-${feature}`} value={feature} />
                        ))}
                        {features.all
                          .filter((feature) => !features.recent.includes(feature))
                          .map((feature) => (
                            <option key={`all-${feature}`} value={feature} />
                          ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Change Note
                      </label>
                      <input
                        type="text"
                        value={formState.change_reason}
                        onChange={(changeEvent) => setFormState((current) => ({ ...current, change_reason: changeEvent.target.value }))}
                        placeholder="Optional note for this version"
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                      />
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        Versioning
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {event
                          ? `Saving from base version v${event.version_number}. Any concurrent change will return a conflict instead of silently overwriting.`
                          : 'Creating version v1. Future edits will require the latest base version.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {viewMode === 'ui' ? (
                <div className="mb-5 border-t border-border pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Properties
                    </h3>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {properties.length}
                    </span>
                  </div>

                  <div className="mb-4 rounded-[24px] border border-border/60 bg-muted/30 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="relative sm:col-span-2">
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Name <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          value={currentProperty.property_name}
                          onChange={(changeEvent) => handlePropertyNameChange(changeEvent.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 font-mono text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                          placeholder="e.g., cart_id"
                        />
                        {suggestions.length > 0 && (
                          <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-strong animate-slide-down">
                            <div className="flex items-center gap-1.5 border-b border-border bg-primary/5 p-2 text-[10px] font-bold uppercase tracking-wider text-primary">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Similar properties
                            </div>
                            {suggestions.map((suggestion, index) => (
                              <div
                                key={`${suggestion.name}-${index}`}
                                onClick={() => selectSuggestion(suggestion)}
                                className="cursor-pointer border-b border-border/30 px-3 py-2 transition-colors last:border-b-0 hover:bg-muted/50"
                              >
                                <div className="font-mono text-xs font-medium text-foreground">{suggestion.name}</div>
                                <div className="mt-0.5 text-[10px] text-muted-foreground">
                                  {suggestion.data_type} / {Math.round(suggestion.similarity * 100)}% match
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Property Type
                        </label>
                        <select
                          value={currentProperty.property_type}
                          onChange={(changeEvent) =>
                            setCurrentProperty((current) => ({
                              ...current,
                              property_type: changeEvent.target.value as 'event' | 'user' | 'super',
                            }))
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                        >
                          <option value="event">Event</option>
                          <option value="user">User</option>
                          <option value="super">Super</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Data Type
                        </label>
                        <select
                          value={currentProperty.data_type}
                          onChange={(changeEvent) => setCurrentProperty((current) => ({ ...current, data_type: changeEvent.target.value }))}
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
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
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Example Value
                        </label>
                        <input
                          type="text"
                          value={currentProperty.example_value || ''}
                          onChange={(changeEvent) => setCurrentProperty((current) => ({ ...current, example_value: changeEvent.target.value }))}
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 font-mono text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                          placeholder="e.g., cart_123"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Description
                        </label>
                        <input
                          type="text"
                          value={currentProperty.description || ''}
                          onChange={(changeEvent) => setCurrentProperty((current) => ({ ...current, description: changeEvent.target.value }))}
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                          placeholder="What this property represents"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={currentProperty.is_required}
                            onChange={(changeEvent) => setCurrentProperty((current) => ({ ...current, is_required: changeEvent.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-2 focus:ring-ring/40"
                          />
                          <span className="text-xs font-medium text-foreground">
                            Required property
                          </span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addProperty}
                      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.97]"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Property
                    </button>
                  </div>

                  {properties.length > 0 ? (
                    <div className="space-y-2">
                      {properties.map((property, index) => (
                        <div
                          key={property.id}
                          className="group flex items-start justify-between gap-3 rounded-2xl border border-border/40 bg-background px-3 py-3 transition-all hover:border-border animate-slide-up"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {property.property_name}
                              </span>
                              {property.is_required && (
                                <span className="rounded bg-destructive/10 px-1 py-0.5 text-[9px] font-bold uppercase text-destructive">
                                  Req
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-bold uppercase">
                                {property.property_type}
                              </span>
                              <code className="rounded bg-muted px-1 py-0.5 text-[9px]">{property.data_type}</code>
                              {property.example_value && (
                                <span>e.g. {property.example_value}</span>
                              )}
                            </div>
                            {property.description && (
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                {property.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeProperty(property.id)}
                            className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/8 hover:text-destructive group-hover:opacity-100"
                            aria-label={`Remove ${property.property_name}`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
                      No properties added yet
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-5 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Event JSON
                    </label>
                    <textarea
                      value={jsonText}
                      onChange={(changeEvent: ChangeEvent<HTMLTextAreaElement>) => setJsonText(changeEvent.target.value)}
                      className="h-80 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
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
                      JSON mode edits the full event definition. The change note stays outside the snapshot and is submitted with the version write.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => onClose(false)}
                  className="h-8 rounded-lg border border-input px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    event ? 'Create Next Version' : 'Create Event'
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
