import { useState } from 'react';
import { ChangelogEntry } from '../types/api';
import EmptyState from './EmptyState';

interface ChangelogProps {
  changelog: ChangelogEntry[];
}

type ActionType = 'create' | 'update' | 'delete';

export default function Changelog({ changelog }: ChangelogProps) {
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
  };

  const getStringValue = (value: unknown): string | null => {
    return typeof value === 'string' ? value : null;
  };

  const getPropertySummary = (value: Record<string, unknown> | null | undefined) => {
    if (!value || !isRecord(value.property)) return null;

    const prop = value.property;
    const name = getStringValue(prop.name);
    const type = getStringValue(prop.type);
    const dataType = getStringValue(prop.data_type);
    if (!name || !type || !dataType) return null;

    return { name, type, dataType };
  };

  const getPropertiesCount = (value: Record<string, unknown> | null | undefined): number | null => {
    if (!value || !Array.isArray(value.properties)) return null;
    return value.properties.length;
  };

  const getActionStyle = (action: string): { bg: string; text: string; dot: string } => {
    const styles: Record<ActionType, { bg: string; text: string; dot: string }> = {
      'create': { bg: 'bg-emerald-100 dark:bg-emerald-900/25', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
      'update': { bg: 'bg-sky-100 dark:bg-sky-900/25', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
      'delete': { bg: 'bg-red-100 dark:bg-red-900/25', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
    };
    return styles[action as ActionType] || { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };
  };

  const formatValue = (value: Record<string, unknown> | string | null | undefined): string => {
    if (!value) return '\u2014';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return value;
  };

  const getEntityName = (entry: ChangelogEntry): string => {
    if (entry.entity_type === 'event') {
      const name = getStringValue(entry.new_value?.name) || getStringValue(entry.old_value?.name);
      return name ? `"${name}"` : `#${entry.entity_id}`;
    }
    return `#${entry.entity_id}`;
  };

  const getChangeSummary = (entry: ChangelogEntry): string | null => {
    if (entry.new_value?.action === 'property_added') {
      const prop = getPropertySummary(entry.new_value);
      if (prop) {
        return `Added property: ${prop.name} (${prop.type}, ${prop.dataType})`;
      }
    }
    if (entry.old_value?.action === 'property_removed') {
      const prop = getPropertySummary(entry.old_value);
      if (prop) {
        return `Removed property: ${prop.name} (${prop.type}, ${prop.dataType})`;
      }
    }

    if (entry.action === 'create' && entry.entity_type === 'event') {
      const propCount = getPropertiesCount(entry.new_value);
      if (propCount === null) return null;
      return `Created with ${propCount} ${propCount === 1 ? 'property' : 'properties'}`;
    }

    if (entry.action === 'delete' && entry.entity_type === 'event') {
      const propCount = getPropertiesCount(entry.old_value);
      if (propCount === null) return null;
      return `Deleted (had ${propCount} ${propCount === 1 ? 'property' : 'properties'})`;
    }

    return null;
  };

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
          Changelog
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Audit trail of all changes to events and properties
        </p>
      </div>

      {changelog.length === 0 ? (
        <EmptyState
          title="No changes yet"
          description="Changes will appear here as you create, update, or delete events."
          icon="changelog"
        />
      ) : (
        <div className="space-y-1.5">
          {changelog.map((entry, index) => {
            const summary = getChangeSummary(entry);
            const actionStyle = getActionStyle(entry.action);
            const isExpanded = expandedEntry === entry.id;

            return (
              <div
                key={entry.id}
                className="border border-border/40 rounded-lg overflow-hidden transition-all hover:border-border/80 animate-fade-in"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <div
                  className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                >
                  {/* Timeline dot */}
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${actionStyle.dot}`} />

                  {/* Action badge */}
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${actionStyle.bg} ${actionStyle.text}`}>
                    {entry.action}
                  </span>

                  {/* Entity */}
                  <span className="text-xs font-medium text-foreground">
                    {entry.entity_type} {getEntityName(entry)}
                  </span>

                  {/* Summary */}
                  {summary && (
                    <span className="hidden sm:inline text-[11px] text-muted-foreground truncate">
                      {summary}
                    </span>
                  )}

                  <div className="flex-1" />

                  {/* Timestamp */}
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(entry.changed_at).toLocaleDateString()}
                  </span>

                  {/* Expand indicator */}
                  <svg
                    className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border/40 bg-muted/10 px-3.5 py-3 animate-fade-in">
                    {entry.changed_by && (
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Changed by <span className="font-medium text-foreground">{entry.changed_by}</span> at {new Date(entry.changed_at).toLocaleString()}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {entry.old_value && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Before</div>
                          <pre className="text-[11px] leading-relaxed bg-red-50/50 dark:bg-red-950/20 text-foreground p-2.5 rounded-md border border-red-200/30 dark:border-red-800/20 overflow-x-auto font-mono">
                            {formatValue(entry.old_value)}
                          </pre>
                        </div>
                      )}
                      {entry.new_value && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">After</div>
                          <pre className="text-[11px] leading-relaxed bg-emerald-50/50 dark:bg-emerald-950/20 text-foreground p-2.5 rounded-md border border-emerald-200/30 dark:border-emerald-800/20 overflow-x-auto font-mono">
                            {formatValue(entry.new_value)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
