import { useMemo } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { api } from '../lib/api'

type FeatureWorkspaceContext = {
  featureId: string
  actorName: string
  refetchFeature: () => void
}

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'prd', label: 'PRD' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'tracking-plan', label: 'Tracking Plan' },
  { key: 'validation', label: 'Validation' },
  { key: 'review', label: 'Review' },
]

const getActorName = (): string => {
  const stored = localStorage.getItem('tracker.profile.displayName')
  return stored?.trim() ? stored : 'Local Analyst'
}

export const FeatureWorkspaceLayout = () => {
  const { featureId = '' } = useParams()
  const actorName = getActorName()

  const featureQuery = useQuery({
    queryKey: ['feature', featureId],
    queryFn: () => api.getFeature(featureId),
    enabled: Boolean(featureId),
  })

  const context = useMemo<FeatureWorkspaceContext>(
    () => ({
      featureId,
      actorName,
      refetchFeature: () => {
        void featureQuery.refetch()
      },
    }),
    [actorName, featureId, featureQuery],
  )

  if (featureQuery.isPending) {
    return <div className="panel">Loading workspace...</div>
  }

  if (featureQuery.isError || !featureQuery.data) {
    return (
      <div className="panel">
        <p className="text-sm text-red-300">Failed to load this feature workspace.</p>
        <Link to="/features" className="link-inline">
          Back to Features
        </Link>
      </div>
    )
  }

  const { feature } = featureQuery.data

  return (
    <section className="space-y-6">
      <header className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Feature Workspace</p>
          <h1 className="font-display text-4xl uppercase tracking-[0.08em]">{feature.title}</h1>
          <p className="mt-2 text-sm text-shell-ink/70">{feature.summary ?? 'No summary yet.'}</p>
        </div>
        <div className="rounded-2xl border border-shell-stroke bg-shell-soft px-4 py-3 text-xs uppercase tracking-[0.12em] text-shell-ink/80">
          Status: {feature.workflowStatus}
        </div>
      </header>

      <nav className="panel flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.key}
            to={`/features/${featureId}/${tab.key}`}
            className={({ isActive }) =>
              `rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                isActive
                  ? 'border-shell-ink bg-shell-ink text-shell'
                  : 'border-shell-stroke bg-shell-soft text-shell-ink/80 hover:border-shell-ink/40 hover:text-shell-ink'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={context} />
    </section>
  )
}

export const useFeatureWorkspace = (): FeatureWorkspaceContext => {
  return useOutletContext<FeatureWorkspaceContext>()
}
