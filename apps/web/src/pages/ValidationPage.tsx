import { useMutation, useQuery } from '@tanstack/react-query'

import { queryClient } from '../app/query-client'
import { useFeatureWorkspace } from '../components/FeatureWorkspaceLayout'
import { api } from '../lib/api'

export const ValidationPage = () => {
  const { featureId } = useFeatureWorkspace()

  const validationQuery = useQuery({
    queryKey: ['validation', featureId],
    queryFn: () => api.getValidation(featureId),
  })

  const recompute = useMutation({
    mutationFn: () => api.recomputeValidation(featureId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['validation', featureId] })
    },
  })

  return (
    <section className="panel space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl font-bold tracking-tight">Validation</h2>
        <button className="action-btn" onClick={() => recompute.mutate()} disabled={recompute.isPending}>
          Recompute Validation
        </button>
      </div>

      {validationQuery.isPending ? <p className="text-sm">Loading issues...</p> : null}

      {validationQuery.data ? (
        <div className="grid gap-3">
          {validationQuery.data.issues.map((issue) => (
            <article key={issue.id} className="rounded-xl border border-shell-stroke bg-shell-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{issue.title}</h3>
                <span className="text-xs uppercase tracking-[0.1em]">{issue.severity}</span>
              </div>
              <p className="mt-1 text-sm text-shell-ink/70">{issue.message}</p>
              <p className="mt-2 text-xs text-shell-ink/55">Code: {issue.code}</p>
            </article>
          ))}
          {validationQuery.data.issues.length === 0 ? (
            <p className="text-sm text-success">No validation findings right now.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
