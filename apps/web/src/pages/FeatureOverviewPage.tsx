import { useQuery } from '@tanstack/react-query'

import { api } from '../lib/api'
import { useFeatureWorkspace } from '../components/FeatureWorkspaceLayout'

export const FeatureOverviewPage = () => {
  const { featureId } = useFeatureWorkspace()

  const featureQuery = useQuery({
    queryKey: ['feature', featureId],
    queryFn: () => api.getFeature(featureId),
  })

  const releasesQuery = useQuery({
    queryKey: ['feature-releases', featureId],
    queryFn: () => api.listReleases(featureId),
  })

  if (featureQuery.isPending) {
    return <div className="panel">Loading overview...</div>
  }

  if (featureQuery.isError || !featureQuery.data) {
    return <div className="panel text-red-300">Failed to load overview.</div>
  }

  const { feature, trackingPlan } = featureQuery.data
  const latestRelease = releasesQuery.data?.[0]

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <section className="panel space-y-3">
        <p className="eyebrow">Workspace Snapshot</p>
        <h2 className="font-display text-3xl uppercase tracking-[0.08em]">{feature.title}</h2>
        <p className="text-sm text-shell-ink/75">{feature.summary ?? 'Add a summary to align product and engineering review.'}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-shell-ink/55">Product Area</dt>
            <dd>{feature.productArea ?? 'Unspecified'}</dd>
          </div>
          <div>
            <dt className="text-shell-ink/55">Owner</dt>
            <dd>{feature.ownerName ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt className="text-shell-ink/55">Workflow Status</dt>
            <dd>{feature.workflowStatus.replaceAll('_', ' ')}</dd>
          </div>
          <div>
            <dt className="text-shell-ink/55">Tracking Plan State</dt>
            <dd>{trackingPlan.generationState}</dd>
          </div>
        </dl>
      </section>

      <section className="panel space-y-3">
        <p className="eyebrow">Release Pulse</p>
        <div className="rounded-2xl border border-shell-stroke bg-shell-soft p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-shell-ink/55">Last Published</p>
          {latestRelease ? (
            <>
              <p className="mt-1 font-display text-4xl uppercase tracking-[0.08em]">R{latestRelease.releaseNumber}</p>
              <p className="mt-2 text-sm text-shell-ink/70">{latestRelease.summary ?? 'No summary provided.'}</p>
              <p className="mt-2 text-xs text-shell-ink/55">{new Date(latestRelease.publishedAt).toLocaleString()}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-shell-ink/70">No releases published yet.</p>
          )}
        </div>
        <p className="text-xs text-shell-ink/60">
          Publish creates immutable release records and catalog event versions. Subsequent edits reopen the workspace as
          unpublished.
        </p>
      </section>
    </div>
  )
}
