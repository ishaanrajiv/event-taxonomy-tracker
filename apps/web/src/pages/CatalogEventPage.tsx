import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { api } from '../lib/api'

export const CatalogEventPage = () => {
  const { eventId = '' } = useParams()

  const eventQuery = useQuery({
    queryKey: ['catalog-event', eventId],
    queryFn: () => api.getCatalogEvent(eventId),
    enabled: Boolean(eventId),
  })

  const versionsQuery = useQuery({
    queryKey: ['catalog-event-versions', eventId],
    queryFn: () => api.listCatalogEventVersions(eventId),
    enabled: Boolean(eventId),
  })

  if (eventQuery.isPending) {
    return <div className="panel">Loading event...</div>
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <div className="panel">
        <p className="text-red-300">Catalog event not found.</p>
        <Link to="/catalog" className="link-inline">
          Back to catalog
        </Link>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <header className="panel">
        <p className="eyebrow">Catalog Event</p>
        <h1 className="font-display text-4xl uppercase tracking-[0.08em]">{eventQuery.data.event.name}</h1>
        <p className="mt-2 text-sm text-shell-ink/70">{eventQuery.data.event.description ?? 'No description.'}</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel space-y-3">
          <h2 className="font-display text-2xl uppercase tracking-[0.08em]">Properties</h2>
          {eventQuery.data.properties.map((item) => (
            <article key={`${item.property.id}:${item.scope}`} className="rounded-xl border border-shell-stroke bg-shell-soft p-3 text-sm">
              <p className="font-semibold">{item.property.name}</p>
              <p className="text-xs text-shell-ink/60">
                {item.scope} • {item.property.dataType} • {item.required ? 'required' : 'optional'}
              </p>
              <p className="mt-1 text-shell-ink/70">{item.property.description ?? 'No description.'}</p>
            </article>
          ))}
        </section>

        <section className="panel space-y-3">
          <h2 className="font-display text-2xl uppercase tracking-[0.08em]">Version History</h2>
          {(versionsQuery.data ?? []).map((version) => (
            <article key={version.id} className="rounded-xl border border-shell-stroke bg-shell-soft p-3 text-sm">
              <p className="font-semibold">v{version.versionNumber}</p>
              <p className="text-xs uppercase tracking-[0.1em] text-shell-ink/60">{version.action}</p>
              <p className="mt-1 text-xs text-shell-ink/60">{new Date(version.createdAt).toLocaleString()}</p>
              {version.sourceReleaseId ? (
                <Link className="link-inline mt-2 inline-block" to={`/catalog/releases/${version.sourceReleaseId}`}>
                  View source release
                </Link>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </section>
  )
}
