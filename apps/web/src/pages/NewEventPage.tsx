import { FormEvent, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { queryClient } from '../app/query-client'
import { api } from '../lib/api'
import { getActorName } from '../lib/profile'

export const NewEventPage = () => {
  const actorName = getActorName()
  const [mode, setMode] = useState<'publish' | 'attach'>('publish')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [trigger, setTrigger] = useState('')
  const [featureId, setFeatureId] = useState('')

  const featuresQuery = useQuery({
    queryKey: ['features'],
    queryFn: api.listFeatures,
  })

  const publishMutation = useMutation({
    mutationFn: () =>
      api.createCatalogEvent({
        name,
        description,
        trigger,
        platforms: ['web'],
        properties: [],
        actorName,
        publishMode: 'adhoc',
      }),
    onSuccess: () => {
      setName('')
      setDescription('')
      setTrigger('')
      void queryClient.invalidateQueries({ queryKey: ['catalog-events'] })
    },
  })

  const attachMutation = useMutation({
    mutationFn: () =>
      api.createPlanEvent(featureId, {
        name,
        description,
        trigger,
        platforms: ['web'],
        decisionType: 'new',
        properties: [],
        requirementIds: [],
        actorName,
      }),
    onSuccess: () => {
      setName('')
      setDescription('')
      setTrigger('')
      void queryClient.invalidateQueries({ queryKey: ['tracking-plan', featureId] })
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mode === 'publish') {
      publishMutation.mutate()
      return
    }
    attachMutation.mutate()
  }

  return (
    <section className="panel max-w-3xl space-y-4">
      <p className="eyebrow">Standalone Event Flow</p>
      <h1 className="font-display text-4xl font-bold tracking-tight">New Event</h1>

      <div className="flex flex-wrap gap-2">
        <button className={`chip ${mode === 'publish' ? 'active' : ''}`} type="button" onClick={() => setMode('publish')}>
          Publish standalone event
        </button>
        <button className={`chip ${mode === 'attach' ? 'active' : ''}`} type="button" onClick={() => setMode('attach')}>
          Add event to existing Tracking Plan
        </button>
      </div>

      <form className="grid gap-3" onSubmit={onSubmit}>
        <input className="input-shell" placeholder="Event name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input-shell" placeholder="Trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)} required />
        <textarea
          className="input-shell min-h-28"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        {mode === 'attach' ? (
          <label className="grid gap-1 text-xs uppercase tracking-[0.1em] text-shell-ink/65">
            Feature workspace
            <select className="input-shell" value={featureId} onChange={(e) => setFeatureId(e.target.value)} required>
              <option value="">Select feature</option>
              {(featuresQuery.data ?? []).map((feature) => (
                <option value={feature.id} key={feature.id}>
                  {feature.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button className="action-btn w-fit" disabled={publishMutation.isPending || attachMutation.isPending}>
          {mode === 'publish' ? 'Publish to Catalog' : 'Add to Tracking Plan'}
        </button>
      </form>
    </section>
  )
}
