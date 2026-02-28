import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { queryClient } from '../app/query-client'
import { useFeatureWorkspace } from '../components/FeatureWorkspaceLayout'
import { api } from '../lib/api'

export const RequirementsPage = () => {
  const { featureId, actorName } = useFeatureWorkspace()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const requirementsQuery = useQuery({
    queryKey: ['requirements', featureId],
    queryFn: () => api.listRequirements(featureId),
  })

  const trackingPlanQuery = useQuery({
    queryKey: ['tracking-plan', featureId],
    queryFn: () => api.getTrackingPlan(featureId),
  })

  const addRequirement = useMutation({
    mutationFn: () => api.createRequirement(featureId, { title, description, actorName }),
    onSuccess: () => {
      setTitle('')
      setDescription('')
      void queryClient.invalidateQueries({ queryKey: ['requirements', featureId] })
    },
  })

  const coverage = useMemo(() => {
    const links = trackingPlanQuery.data?.requirementLinks ?? []
    const map = new Map<string, number>()
    for (const link of links) {
      map.set(link.requirementId, (map.get(link.requirementId) ?? 0) + 1)
    }
    return map
  }, [trackingPlanQuery.data])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    addRequirement.mutate()
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="panel space-y-3">
        <h2 className="font-display text-3xl uppercase tracking-[0.08em]">Requirements</h2>
        <p className="text-sm text-shell-ink/70">
          Extracted and manual requirements live here. Coverage is tracked against plan events so publish readiness is
          auditable.
        </p>

        {(requirementsQuery.data ?? []).map((requirement) => (
          <article key={requirement.id} className="rounded-xl border border-shell-stroke bg-shell-soft p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{requirement.title}</h3>
              <span className="text-xs uppercase tracking-[0.1em] text-shell-ink/60">{requirement.status}</span>
            </div>
            <p className="mt-2 text-sm text-shell-ink/75">{requirement.description}</p>
            <p className="mt-2 text-xs text-shell-ink/60">Mapped events: {coverage.get(requirement.id) ?? 0}</p>
          </article>
        ))}
      </section>

      <aside className="panel space-y-3">
        <h3 className="font-display text-2xl uppercase tracking-[0.08em]">Add Manual Requirement</h3>
        <form onSubmit={onSubmit} className="grid gap-3">
          <input
            className="input-shell"
            placeholder="Requirement title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="input-shell min-h-32"
            placeholder="Requirement description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <button className="action-btn" disabled={addRequirement.isPending}>
            Add Requirement
          </button>
        </form>
      </aside>
    </div>
  )
}
