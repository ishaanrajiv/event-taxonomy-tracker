import { useState } from 'react';
import { ChangelogEntry } from '../types/api';
import EmptyState from './EmptyState';
import { countVersionDiffs, describeProperty, parseMetadataChanges, parsePropertyChanges } from '../utils/versionDiff';

interface ChangelogProps {
  changelog: ChangelogEntry[];
}

const getActionStyle = (action: ChangelogEntry['action']) => {
  switch (action) {
    case 'create':
      return {
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        dot: 'bg-emerald-500',
      };
    case 'update':
      return {
        badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
        dot: 'bg-sky-500',
      };
    case 'archive':
      return {
        badge: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
        dot: 'bg-slate-500',
      };
    case 'restore':
      return {
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        dot: 'bg-amber-500',
      };
    case 'revert':
      return {
        badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
        dot: 'bg-rose-500',
      };
  }
};

export default function Changelog({ changelog }: ChangelogProps) {
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Changelog
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Version-backed activity feed across all events.
        </p>
      </div>

      {changelog.length === 0 ? (
        <EmptyState
          title="No changes yet"
          description="Changes will appear here as you create, update, archive, or restore event definitions."
          icon="changelog"
        />
      ) : (
        <div className="space-y-2">
          {changelog.map((entry, index) => {
            const isExpanded = expandedEntry === entry.id;
            const actionStyle = getActionStyle(entry.action);
            const diffCounts = countVersionDiffs(entry.diff);
            const metadataChanges = entry.action === 'create' ? [] : parseMetadataChanges(entry.diff);
            const propertyChanges = parsePropertyChanges(entry.diff);
            const isCreateEntry = entry.action === 'create';

            return (
              <div
                key={entry.id}
                className="overflow-hidden rounded-2xl border border-border/50 bg-card transition-all hover:border-border animate-fade-in"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
                  onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                >
                  <div className={`h-1.5 w-1.5 rounded-full ${actionStyle.dot}`} />
                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${actionStyle.badge}`}>
                    {entry.action}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {entry.event_name}
                  </span>
                  <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    v{entry.version_number}
                  </span>
                  {entry.is_current && (
                    <span className="hidden rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary sm:inline-flex">
                      Current
                    </span>
                  )}
                  <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
                    {entry.summary}
                  </span>
                  <div className="flex-1" />
                  <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                    {new Date(entry.changed_at).toLocaleDateString()}
                  </span>
                  <svg
                    className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/50 bg-muted/10 px-4 py-4 animate-fade-in">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          Actor
                        </div>
                        <div className="mt-2 text-xs font-semibold text-foreground">
                          {entry.changed_by || 'Unknown'}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          {isCreateEntry ? 'Entry type' : 'Metadata'}
                        </div>
                        <div className="mt-2 text-xs font-semibold text-foreground">
                          {isCreateEntry ? 'Initial definition' : `${diffCounts.metadata} changed`}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          Properties
                        </div>
                        <div className="mt-2 text-xs font-semibold text-foreground">
                          {isCreateEntry
                            ? `${entry.snapshot.properties.length} defined`
                            : `+${diffCounts.added} / -${diffCounts.removed} / ~${diffCounts.updated}`}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          Change Note
                        </div>
                        <div className="mt-2 text-xs font-semibold text-foreground">
                          {entry.change_reason || 'No note'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                      <div className="rounded-[24px] border border-border/60 bg-card p-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          {isCreateEntry ? 'Creation summary' : 'Parsed changes'}
                        </div>
                        <div className="mt-3 space-y-3">
                          {isCreateEntry ? (
                            <>
                              <div className="rounded-[18px] border border-emerald-200/50 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                                  Created event
                                </div>
                                <div className="mt-2 text-sm font-semibold text-foreground">
                                  {entry.event_name}
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                  {entry.summary}
                                </div>
                              </div>

                              <div className="rounded-[18px] border border-border/60 bg-muted/20 p-4">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                  Initial definition
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                  {entry.snapshot.event.category && (
                                    <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 font-semibold text-muted-foreground">
                                      {entry.snapshot.event.category}
                                    </span>
                                  )}
                                  <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 font-semibold text-muted-foreground">
                                    {entry.snapshot.event.is_archived ? 'Archived' : 'Active'}
                                  </span>
                                  <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 font-semibold text-muted-foreground">
                                    v{entry.version_number}
                                  </span>
                                </div>
                                {entry.snapshot.event.description && (
                                  <p className="mt-3 text-sm text-muted-foreground">
                                    {entry.snapshot.event.description}
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              {metadataChanges.length === 0 && propertyChanges.length === 0 && (
                                <p className="text-sm text-muted-foreground">No differences recorded for this entry.</p>
                              )}

                              {metadataChanges.map((change) => (
                                <div key={change.field} className="rounded-[18px] border border-border/60 bg-muted/20 p-3">
                                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                    {change.label}
                                  </div>
                                  <div className="mt-2 text-sm text-foreground">{change.summary}</div>
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    {change.from} to {change.to}
                                  </div>
                                </div>
                              ))}

                              {propertyChanges.map((change) => (
                                <div key={change.key} className="rounded-[18px] border border-border/60 bg-muted/20 p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                      {change.kind}
                                    </span>
                                    <span className="text-sm font-semibold text-foreground">{change.name}</span>
                                  </div>
                                  <div className="mt-2 text-xs text-muted-foreground">{change.descriptor}</div>
                                  {change.fieldChanges.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {change.fieldChanges.map((fieldChange) => (
                                        <div key={`${change.key}:${fieldChange.field}`} className="text-xs text-muted-foreground">
                                          {fieldChange.label}: {fieldChange.from} to {fieldChange.to}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-border/60 bg-card p-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          {isCreateEntry ? 'Initial properties' : 'Resulting definition'}
                        </div>
                        <div className="mt-3 rounded-[18px] border border-border/60 bg-muted/20 p-4">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-foreground">{entry.snapshot.event.name}</span>
                            {entry.snapshot.event.category && (
                              <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                {entry.snapshot.event.category}
                              </span>
                            )}
                            <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                              {entry.snapshot.event.is_archived ? 'Archived' : 'Active'}
                            </span>
                          </div>
                          {entry.snapshot.event.description && (
                            <p className="mt-3 text-sm text-muted-foreground">{entry.snapshot.event.description}</p>
                          )}
                          <div className="mt-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                              {isCreateEntry ? 'Defined properties' : 'Properties'}
                            </div>
                            {entry.snapshot.properties.length === 0 ? (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {isCreateEntry ? 'This event started without any properties.' : 'No properties in this version.'}
                              </p>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {entry.snapshot.properties.map((property) => (
                                  <div
                                    key={`${property.property_name}:${property.property_type}`}
                                    className="rounded-xl border border-border/50 bg-background/80 px-3 py-3"
                                  >
                                    <div className="text-sm font-semibold text-foreground">
                                      {property.property_name}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {describeProperty(property)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
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
