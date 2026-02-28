import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { api } from '../lib/api'

export const FeaturesListPage = () => {
  const [query, setQuery] = useState('')
  const featuresQuery = useQuery({
    queryKey: ['features'],
    queryFn: api.listFeatures,
  })

  const rows = useMemo(() => {
    const list = featuresQuery.data ?? []
    if (!query.trim()) {
      return list
    }
    const q = query.toLowerCase()
    return list.filter((feature) => [feature.title, feature.slug, feature.ownerName ?? ''].join(' ').toLowerCase().includes(q))
  }, [featuresQuery.data, query])

  return (
    <section className="space-y-5">
      <header className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Workflow-First Planning</p>
          <h1 className="font-display text-5xl uppercase tracking-[0.08em]">Features</h1>
          <p className="mt-2 max-w-2xl text-sm text-shell-ink/70">
            Start every analytics initiative from a feature workspace, not the catalog. Track blockers, requirement
            coverage, release status, and publication readiness in one control room.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/features/new" className="action-btn">
            New Tracking Plan
          </Link>
          <Link to="/events/new" className="action-btn alt">
            New Event
          </Link>
        </div>
      </header>

      <div className="panel flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, slug, owner"
          className="input-shell w-full max-w-md"
        />
        <span className="text-xs uppercase tracking-[0.12em] text-shell-ink/60">{rows.length} feature workspaces</span>
      </div>

      <div className="panel overflow-auto">
        {featuresQuery.isPending ? (
          <p className="text-sm text-shell-ink/70">Loading features...</p>
        ) : featuresQuery.isError ? (
          <p className="text-sm text-red-300">Failed to load features.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-shell-ink/70">No features found. Create one to start a tracking plan.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-shell-stroke text-left text-xs uppercase tracking-[0.12em] text-shell-ink/60">
                <th className="pb-3 pr-3">Feature</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3 pr-3">Owner</th>
                <th className="pb-3 pr-3">Last Release</th>
                <th className="pb-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((feature) => (
                <tr key={feature.id} className="border-b border-shell-stroke/60 hover:bg-shell-soft/70">
                  <td className="py-3 pr-3">
                    <Link to={`/features/${feature.id}/overview`} className="font-semibold hover:underline">
                      {feature.title}
                    </Link>
                    <p className="text-xs text-shell-ink/55">/{feature.slug}</p>
                  </td>
                  <td className="py-3 pr-3 uppercase tracking-[0.08em]">{feature.workflowStatus.replaceAll('_', ' ')}</td>
                  <td className="py-3 pr-3">{feature.ownerName ?? 'Unassigned'}</td>
                  <td className="py-3 pr-3">r{feature.lastPublishedReleaseNumber ?? '-'}</td>
                  <td className="py-3">{new Date(feature.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
