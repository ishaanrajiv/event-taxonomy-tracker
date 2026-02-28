import { useState } from 'react';
import axios from 'axios';
import type { EventWriteProperty } from '../../types/api';

interface SuggestedEvent {
  name: string;
  description: string;
  category: string | null;
  reasoning: string;
  duplicate_of_name: string | null;
  duplicate_of_id?: number | null;
  properties: EventWriteProperty[];
}

interface GenerateEventsPanelProps {
  planId: number;
  apiBase: string;
  onClose: () => void;
  onAccept: (events: SuggestedEvent[]) => void;
  onError: (message: string) => void;
}

export default function GenerateEventsPanel({
  planId,
  apiBase,
  onClose,
  onAccept,
  onError,
}: GenerateEventsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedEvent[]>([]);
  const [usage, setUsage] = useState<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setSuggestions([]);
      setUsage(null);
      setSelectedIds(new Set());

      const { data } = await axios.post(`${apiBase}/tracking-plans/${planId}/generate`);

      setSuggestions(data.suggested_events);
      setUsage(data.usage);

      // Auto-select all non-duplicate suggestions
      const autoSelected = new Set<number>(
        data.suggested_events
          .map((_: any, idx: number) => idx)
          .filter((idx: number) => !data.suggested_events[idx].duplicate_of_id)
      );
      setSelectedIds(autoSelected);
    } catch (error: any) {
      console.error('Failed to generate events:', error);
      onError(error.response?.data?.detail || 'Failed to generate events from PRD');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEvent = (index: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIds(newSelected);
  };

  const handleAcceptSelected = () => {
    const selectedEvents = Array.from(selectedIds)
      .sort((a, b) => a - b)
      .map((idx) => suggestions[idx]);

    onAccept(selectedEvents);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-card border border-border rounded-lg shadow-strong w-full max-w-4xl max-h-[85vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Generate Events from PRD</h2>
            {usage && (
              <p className="text-xs text-muted-foreground mt-1">
                {usage.totalTokens.toLocaleString()} tokens used ({usage.promptTokens.toLocaleString()} prompt + {usage.completionTokens.toLocaleString()} completion)
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {suggestions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 22l-.394-1.433a2.25 2.25 0 00-1.423-1.423L13.25 19l1.433-.394a2.25 2.25 0 001.423-1.423L16.5 16l.394 1.183a2.25 2.25 0 001.423 1.423L19.75 19l-1.433.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
              <p className="text-sm text-muted-foreground mb-6">
                Click the button below to generate event suggestions from your PRD
              </p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8m0 16a8 8 0 01-8-8" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Generate Events
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((event, idx) => {
                const isSelected = selectedIds.has(idx);
                const isDuplicate = !!event.duplicate_of_id;

                return (
                  <div
                    key={idx}
                    className={`border rounded-lg overflow-hidden transition-all ${
                      isDuplicate
                        ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20'
                        : isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleEvent(idx)}
                          className="mt-1 h-4 w-4 rounded border-muted-foreground"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-foreground">{event.name}</h3>
                            {event.category && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                                {event.category}
                              </span>
                            )}
                            {isDuplicate && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-orange-500 text-white rounded">
                                Possible Duplicate
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-foreground mb-2">{event.description}</p>

                          <div className="bg-muted/50 rounded p-2 mb-2">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Reasoning:</span> {event.reasoning}
                            </p>
                          </div>

                          {isDuplicate && event.duplicate_of_name && (
                            <div className="bg-orange-100 dark:bg-orange-900/30 rounded p-2 mb-2">
                              <p className="text-xs text-orange-900 dark:text-orange-200">
                                ⚠️ Similar to existing event: <span className="font-medium">{event.duplicate_of_name}</span>
                              </p>
                            </div>
                          )}

                          {event.properties.length > 0 && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground mb-2">
                                {event.properties.length} properties
                              </summary>
                              <div className="space-y-1 ml-4">
                                {event.properties.map((prop, propIdx) => (
                                  <div key={propIdx} className="flex items-center gap-2">
                                    <code className="font-mono text-foreground">{prop.property_name}</code>
                                    <span className="text-muted-foreground">({prop.data_type})</span>
                                    {prop.is_required && <span className="text-destructive">*</span>}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {suggestions.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground">
                {selectedIds.size} of {suggestions.length} selected
              </p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Regenerate
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptSelected}
                disabled={selectedIds.size === 0}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Accept Selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
