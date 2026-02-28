import { MouseEvent, useEffect, useState } from 'react';
import axios from 'axios';
import type { Event, EventVersionDetail, EventVersionSummary } from '../types/api';
import { describeProperty, parseMetadataChanges, parsePropertyChanges } from '../utils/versionDiff';

interface EventHistoryDrawerProps {
  event: Event;
  apiBase: string;
  currentUser: string;
  onClose: () => void;
  onRefresh: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

type ActionTone = {
  chip: string;
  dot: string;
  border: string;
};

const getActionTone = (action: EventVersionSummary['action']): ActionTone => {
  switch (action) {
    case 'create':
      return {
        chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
        dot: 'bg-emerald-500',
        border: 'border-emerald-200/50 dark:border-emerald-800/40',
      };
    case 'update':
      return {
        chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
        dot: 'bg-sky-500',
        border: 'border-sky-200/50 dark:border-sky-800/40',
      };
    case 'archive':
      return {
        chip: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
        dot: 'bg-slate-500',
        border: 'border-slate-200/50 dark:border-slate-800/40',
      };
    case 'restore':
      return {
        chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        dot: 'bg-amber-500',
        border: 'border-amber-200/50 dark:border-amber-800/40',
      };
    case 'revert':
      return {
        chip: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
        dot: 'bg-rose-500',
        border: 'border-rose-200/50 dark:border-rose-800/40',
      };
  }
};

export default function EventHistoryDrawer({
  event,
  apiBase,
  currentUser,
  onClose,
  onRefresh,
  onSuccess,
  onError,
}: EventHistoryDrawerProps) {
  const [versions, setVersions] = useState<EventVersionSummary[]>([]);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<EventVersionDetail | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [loadingVersionDetail, setLoadingVersionDetail] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchVersions = async () => {
      setLoadingVersions(true);
      try {
        const response = await axios.get<EventVersionSummary[]>(`${apiBase}/events/${event.id}/versions`);
        if (cancelled) return;
        setVersions(response.data);
        setSelectedVersionNumber(response.data[0]?.version_number ?? null);
      } catch (error) {
        console.error('Error fetching event versions:', error);
        if (!cancelled) onError('Failed to load version history');
      } finally {
        if (!cancelled) setLoadingVersions(false);
      }
    };

    void fetchVersions();
    return () => {
      cancelled = true;
    };
  }, [apiBase, event.id, onError]);

  useEffect(() => {
    if (!selectedVersionNumber) {
      setSelectedVersion(null);
      return;
    }

    let cancelled = false;

    const fetchVersionDetail = async () => {
      setLoadingVersionDetail(true);
      try {
        const response = await axios.get<EventVersionDetail>(
          `${apiBase}/events/${event.id}/versions/${selectedVersionNumber}`
        );
        if (!cancelled) setSelectedVersion(response.data);
      } catch (error) {
        console.error('Error fetching version detail:', error);
        if (!cancelled) onError('Failed to load version detail');
      } finally {
        if (!cancelled) setLoadingVersionDetail(false);
      }
    };

    void fetchVersionDetail();
    return () => {
      cancelled = true;
    };
  }, [apiBase, event.id, onError, selectedVersionNumber]);

  const handleRestoreVersion = async () => {
    if (!selectedVersion || selectedVersion.is_current || restoring) return;
    if (!confirm(`Restore version ${selectedVersion.version_number} for ${event.name}?`)) return;

    setRestoring(true);
    try {
      await axios.post(
        `${apiBase}/events/${event.id}/versions/${selectedVersion.version_number}/revert`,
        {
          base_version_number: event.version_number,
          changed_by: currentUser,
          change_reason: `Restore version ${selectedVersion.version_number}`,
        }
      );
      onSuccess(`Restored version ${selectedVersion.version_number} for ${event.name}`);
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error restoring version:', error);
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        onError('This event changed since you opened history. Reload and retry.');
      } else {
        onError('Failed to restore version');
      }
    } finally {
      setRestoring(false);
    }
  };

  const metadataChanges = selectedVersion ? parseMetadataChanges(selectedVersion.diff) : [];
  const propertyChanges = selectedVersion ? parsePropertyChanges(selectedVersion.diff) : [];
  const eventSnapshot = selectedVersion?.snapshot.event;
  const snapshotProperties = selectedVersion?.snapshot.properties ?? [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm animate-fade-in"
      onClick={(eventTarget: MouseEvent<HTMLDivElement>) => {
        if (eventTarget.target === eventTarget.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-y-0 right-0 flex w-full justify-end">
        <div className="h-full w-full max-w-5xl overflow-hidden border-l border-border/70 bg-background shadow-strong">
          <div className="grid h-full grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="border-b border-border/60 bg-card xl:border-b-0 xl:border-r xl:border-border/60">
              <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.22),transparent_58%)] px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/80">
                      Event Control
                    </p>
                    <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-foreground">
                      {event.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Versioned definition history, diffs, and rollback.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Close history drawer"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="h-[calc(100vh-145px)] overflow-y-auto px-4 py-4">
                {loadingVersions ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="animate-pulse rounded-2xl border border-border/60 bg-muted/30 p-4">
                        <div className="h-3 w-20 rounded bg-muted" />
                        <div className="mt-3 h-4 w-40 rounded bg-muted" />
                        <div className="mt-2 h-3 w-full rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {versions.map((version) => {
                      const tone = getActionTone(version.action);
                      const isSelected = version.version_number === selectedVersionNumber;

                      return (
                        <button
                          key={version.id}
                          onClick={() => setSelectedVersionNumber(version.version_number)}
                          className={`w-full rounded-2xl border p-4 text-left transition-all ${
                            isSelected
                              ? `bg-card shadow-soft ${tone.border}`
                              : 'border-border/60 bg-card/60 hover:border-border hover:bg-card'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${tone.chip}`}>
                              {version.action}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              v{version.version_number}
                            </span>
                            {version.is_current && (
                              <span className="rounded-full bg-primary/12 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                                Head
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-sm font-semibold text-foreground">
                            {version.summary}
                          </p>
                          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                            {version.created_by || 'Unknown'} · {new Date(version.created_at).toLocaleString()}
                          </p>
                          {version.change_reason && (
                            <p className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                              {version.change_reason}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            <section className="h-full overflow-y-auto bg-background">
              {loadingVersionDetail || !selectedVersion ? (
                <div className="space-y-5 p-6">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="animate-pulse rounded-3xl border border-border/60 bg-card p-5">
                      <div className="h-4 w-32 rounded bg-muted" />
                      <div className="mt-4 h-20 rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6 p-6">
                  <div className="overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-soft">
                    <div className="border-b border-border/60 bg-[linear-gradient(120deg,hsl(var(--primary)/0.15),transparent_48%)] px-6 py-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">
                          Selected entry
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold text-foreground">
                          v{selectedVersion.version_number}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getActionTone(selectedVersion.action).chip}`}>
                          {selectedVersion.action}
                        </span>
                        {selectedVersion.reverted_from_version_number && (
                          <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
                            From v{selectedVersion.reverted_from_version_number}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
                        {selectedVersion.snapshot.event.name}
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        {selectedVersion.summary}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 px-6 py-4">
                      <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-xs">
                        <div className="font-semibold text-foreground">Changed by</div>
                        <div className="mt-1 text-muted-foreground">{selectedVersion.created_by || 'Unknown'}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-xs">
                        <div className="font-semibold text-foreground">Timestamp</div>
                        <div className="mt-1 text-muted-foreground">{new Date(selectedVersion.created_at).toLocaleString()}</div>
                      </div>
                      {selectedVersion.change_reason && (
                        <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-xs">
                          <div className="font-semibold text-foreground">Note</div>
                          <div className="mt-1 text-muted-foreground">{selectedVersion.change_reason}</div>
                        </div>
                      )}
                      <div className="ml-auto">
                        <button
                          onClick={handleRestoreVersion}
                          disabled={selectedVersion.is_current || restoring}
                          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-all hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10M3 10l4-4m-4 4l4 4m4 6h8a2 2 0 002-2V8a2 2 0 00-2-2h-8" />
                          </svg>
                          {selectedVersion.is_current ? 'Current Version' : restoring ? 'Restoring...' : 'Restore Version'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-6">
                      <div className="rounded-[28px] border border-border/60 bg-card p-6 shadow-soft">
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                          Event changes
                        </p>
                        <h4 className="mt-2 text-lg font-semibold text-foreground">
                          Metadata
                        </h4>

                        {metadataChanges.length === 0 ? (
                          <p className="mt-4 text-sm text-muted-foreground">No metadata changes in this version.</p>
                        ) : (
                          <div className="mt-5 space-y-3">
                            {metadataChanges.map((change) => (
                              <div key={change.field} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                    {change.label}
                                  </div>
                                  <div className="text-xs text-foreground">{change.summary}</div>
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <div className="rounded-2xl border border-rose-200/40 bg-rose-50/60 px-4 py-3 text-xs dark:border-rose-900/40 dark:bg-rose-950/20">
                                    <div className="font-semibold text-foreground">Before</div>
                                    <div className="mt-2 text-muted-foreground">{change.from}</div>
                                  </div>
                                  <div className="rounded-2xl border border-emerald-200/40 bg-emerald-50/60 px-4 py-3 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                    <div className="font-semibold text-foreground">After</div>
                                    <div className="mt-2 text-muted-foreground">{change.to}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-[28px] border border-border/60 bg-card p-6 shadow-soft">
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                          Property changes
                        </p>
                        <h4 className="mt-2 text-lg font-semibold text-foreground">
                          Schema updates
                        </h4>

                        {propertyChanges.length === 0 ? (
                          <p className="mt-4 text-sm text-muted-foreground">No property changes in this version.</p>
                        ) : (
                          <div className="mt-5 space-y-3">
                            {propertyChanges.map((change) => {
                              const tone =
                                change.kind === 'added'
                                  ? 'border-emerald-200/40 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                                  : change.kind === 'removed'
                                    ? 'border-rose-200/40 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20'
                                    : 'border-sky-200/40 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20';

                              return (
                                <div key={change.key} className={`rounded-2xl border p-4 ${tone}`}>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                      {change.kind}
                                    </span>
                                    <span className="text-sm font-semibold text-foreground">{change.name}</span>
                                  </div>
                                  <p className="mt-2 text-xs text-muted-foreground">{change.descriptor}</p>
                                  <p className="mt-2 text-sm text-foreground">{change.summary}</p>
                                  {change.fieldChanges.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                      {change.fieldChanges.map((fieldChange) => (
                                        <div key={`${change.key}:${fieldChange.field}`} className="rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-xs">
                                          <div className="font-semibold text-foreground">{fieldChange.label}</div>
                                          <div className="mt-1 text-muted-foreground">
                                            {fieldChange.from} to {fieldChange.to}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-border/60 bg-card p-6 shadow-soft">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                        Version snapshot
                      </p>
                      <h4 className="mt-2 text-lg font-semibold text-foreground">
                        Current definition at v{selectedVersion.version_number}
                      </h4>

                      {eventSnapshot && (
                        <div className="mt-5 space-y-4">
                          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-semibold text-foreground">{eventSnapshot.name}</span>
                              {eventSnapshot.category && (
                                <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                  {eventSnapshot.category}
                                </span>
                              )}
                              <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                {eventSnapshot.is_archived ? 'Archived' : 'Active'}
                              </span>
                            </div>
                            {eventSnapshot.description && (
                              <p className="mt-3 text-sm text-muted-foreground">{eventSnapshot.description}</p>
                            )}
                          </div>

                          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                Properties
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {snapshotProperties.length} total
                              </div>
                            </div>
                            {snapshotProperties.length === 0 ? (
                              <p className="mt-3 text-sm text-muted-foreground">No properties in this version.</p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {snapshotProperties.map((property) => (
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
                                    {(property.description || property.example_value) && (
                                      <div className="mt-2 text-xs text-muted-foreground">
                                        {property.description || property.example_value}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="text-[11px] text-muted-foreground">
                            Checksum {selectedVersion.checksum.slice(0, 12)}...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
