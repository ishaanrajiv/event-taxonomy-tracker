import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { queryClient } from '../app/query-client'
import { ValidationRail } from '../components/ValidationRail'
import { useFeatureWorkspace } from '../components/FeatureWorkspaceLayout'
import { api } from '../lib/api'

export const TrackingPlanPage = () => {
  const { featureId, actorName } = useFeatureWorkspace()
  const [eventName, setEventName] = useState('')
  const [eventTrigger, setEventTrigger] = useState('')
  const [eventDescription, setEventDescription] = useState('')

  const planQuery = useQuery({
    queryKey: ['tracking-plan', featureId],
    queryFn: () => api.getTrackingPlan(featureId),
  })

  const requirementsQuery = useQuery({
    queryKey: ['requirements', featureId],
    queryFn: () => api.listRequirements(featureId),
  })

  const addEvent = useMutation({
    mutationFn: () =>
      api.createPlanEvent(featureId, {
        name: eventName,
        trigger: eventTrigger,
        description: eventDescription,
        decisionType: 'new',
        properties: [],
        requirementIds: [],
        actorName,
      }),
    onSuccess: () => {
      setEventName('')
      setEventTrigger('')
      setEventDescription('')
      void queryClient.invalidateQueries({ queryKey: ['tracking-plan', featureId] })
      void queryClient.invalidateQueries({ queryKey: ['validation', featureId] })
    },
  })

  const requirementLinksByEvent = useMemo(() => {
    const map = new Map<string, number>()
    for (const link of planQuery.data?.requirementLinks ?? []) {
      map.set(link.planEventId, (map.get(link.planEventId) ?? 0) + 1)
    }
    return map
  }, [planQuery.data?.requirementLinks])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    addEvent.mutate()
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
      <section className="panel space-y-4">
        <h2 className="font-display text-3xl uppercase tracking-[0.08em]">Tracking Plan Editor</h2>

        <form className="grid gap-3 rounded-xl border border-shell-stroke bg-shell-soft p-3" onSubmit={onSubmit}>
          <p className="text-xs uppercase tracking-[0.1em] text-shell-ink/60">Add Manual Plan Event</p>
          <input
            className="input-shell"
            placeholder="Event name"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            required
          />
          <input
            className="input-shell"
            placeholder="Trigger"
            value={eventTrigger}
            onChange={(e) => setEventTrigger(e.target.value)}
            required
          />
          <textarea
            className="input-shell min-h-24"
            placeholder="Description"
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            required
          />
          <button className="action-btn w-fit" disabled={addEvent.isPending}>
            Add event to tracking plan
          </button>
        </form>

        <div className="space-y-3">
          {(planQuery.data?.events ?? []).map((event) => (
            <article key={event.id} className="rounded-xl border border-shell-stroke bg-shell-soft p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{event.name ?? 'Untitled event'}</h3>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em]">
                  <span className="rounded-full border border-shell-stroke px-2 py-1">{event.decisionType}</span>
                  <span className="rounded-full border border-shell-stroke px-2 py-1">{event.workflowState}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-shell-ink/70">{event.description ?? 'No description.'}</p>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-shell-ink/55">Trigger</dt>
                  <dd>{event.trigger ?? 'Missing'}</dd>
                </div>
                <div>
                  <dt className="text-shell-ink/55">Requirement links</dt>
                  <dd>{requirementLinksByEvent.get(event.id) ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-shell-ink/55">Catalog target</dt>
                  <dd>{event.linkedCatalogEventId ?? 'None'}</dd>
                </div>
              </dl>
            </article>
          ))}

          {planQuery.data?.events.length === 0 ? (
            <p className="text-sm text-shell-ink/70">No plan events yet. Add one manually or use AI generation from PRD.</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-shell-stroke p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-shell-ink/60">Requirement Coverage Matrix</p>
          <div className="mt-2 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-shell-stroke text-left">
                  <th className="py-2 pr-2">Requirement</th>
                  <th className="py-2 pr-2">Mapped Event Count</th>
                </tr>
              </thead>
              <tbody>
                {(requirementsQuery.data ?? []).map((requirement) => {
                  const linked = (planQuery.data?.requirementLinks ?? []).filter((link) => link.requirementId === requirement.id).length
                  return (
                    <tr key={requirement.id} className="border-b border-shell-stroke/60">
                      <td className="py-2 pr-2">{requirement.title}</td>
                      <td className="py-2 pr-2">{linked}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <ValidationRail featureId={featureId} title="Validation Rail" />
        <aside className="panel space-y-2 text-xs text-shell-ink/70">
          <h3 className="font-display text-xl uppercase tracking-[0.08em]">AI Assist</h3>
          <p>Generated suggestions should always be human-reviewed before publish.</p>
        </aside>
      </div>
    </div>
  )
}
