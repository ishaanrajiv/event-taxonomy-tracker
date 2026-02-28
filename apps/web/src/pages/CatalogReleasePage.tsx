import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { api } from '../lib/api'

export const CatalogReleasePage = () => {
  const { releaseId = '' } = useParams()

  const query = useQuery({
    queryKey: ['release', releaseId],
    queryFn: () => api.getRelease(releaseId),
    enabled: Boolean(releaseId),
  })

  if (query.isPending) {
    return <div className="panel">Loading release...</div>
  }

  if (query.isError || !query.data) {
    return <div className="panel text-destructive">Release not found.</div>
  }

  const { release, versions } = query.data

  return (
    <section className="space-y-4">
      <header className="panel">
        <p className="eyebrow">Release Detail</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Release R{release.releaseNumber}</h1>
        <p className="mt-1 text-sm text-shell-ink/70">{release.summary ?? 'No summary.'}</p>
      </header>

      <section className="panel space-y-3">
        {versions.map((version) => (
          <article key={version.id} className="rounded-xl border border-shell-stroke bg-shell-soft p-3 text-sm">
            <p className="font-semibold">Catalog Event {version.catalogEventId}</p>
            <p className="text-xs uppercase tracking-[0.1em] text-shell-ink/60">
              {version.action} • v{version.versionNumber}
            </p>
          </article>
        ))}
      </section>
    </section>
  )
}
