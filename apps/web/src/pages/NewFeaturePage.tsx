import { FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { api } from '../lib/api'
import { queryClient } from '../app/query-client'

const getActorName = (): string => localStorage.getItem('tracker.profile.displayName')?.trim() || 'Local Analyst'

export const NewFeaturePage = () => {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [ownerName, setOwnerName] = useState('')

  const createMutation = useMutation({
    mutationFn: api.createFeature,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['features'] })
      navigate(`/features/${result.feature.id}/overview`)
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate({
      title,
      summary,
      ownerName,
      actorName: getActorName(),
    })
  }

  return (
    <section className="panel max-w-3xl space-y-4">
      <p className="eyebrow">Create Workspace</p>
      <h1 className="font-display text-4xl uppercase tracking-[0.08em]">New Tracking Plan</h1>
      <p className="text-sm text-shell-ink/70">
        This creates a new Feature with an empty evolving Tracking Plan. You can add PRD sources, extract requirements,
        and publish full-plan releases from the workspace.
      </p>

      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="grid gap-2 text-sm">
          Feature title
          <input className="input-shell" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label className="grid gap-2 text-sm">
          Summary
          <textarea className="input-shell min-h-28" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>

        <label className="grid gap-2 text-sm">
          Owner
          <input className="input-shell" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </label>

        <button className="action-btn w-fit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create Feature Workspace'}
        </button>

        {createMutation.isError ? (
          <p className="text-sm text-red-300">{(createMutation.error as Error).message}</p>
        ) : null}
      </form>
    </section>
  )
}
