import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { queryClient } from '../app/query-client'
import { ValidationRail } from '../components/ValidationRail'
import { useFeatureWorkspace } from '../components/FeatureWorkspaceLayout'
import { api } from '../lib/api'

export const ReviewPage = () => {
  const { featureId, actorName } = useFeatureWorkspace()
  const [acknowledgement, setAcknowledgement] = useState('')
  const [comment, setComment] = useState('')

  const trackingPlanQuery = useQuery({
    queryKey: ['tracking-plan', featureId],
    queryFn: () => api.getTrackingPlan(featureId),
  })

  const validationQuery = useQuery({
    queryKey: ['validation', featureId],
    queryFn: () => api.getValidation(featureId),
  })

  const commentsQuery = useQuery({
    queryKey: ['comments', featureId],
    queryFn: () => api.getComments(featureId),
  })

  const publishMutation = useMutation({
    mutationFn: () => api.publishFeature(featureId, { actorName, warningAcknowledgement: acknowledgement }),
    onSuccess: () => {
      setAcknowledgement('')
      void queryClient.invalidateQueries({ queryKey: ['validation', featureId] })
      void queryClient.invalidateQueries({ queryKey: ['feature-releases', featureId] })
      void queryClient.invalidateQueries({ queryKey: ['catalog-events'] })
    },
  })

  const commentMutation = useMutation({
    mutationFn: async () => {
      const threads = commentsQuery.data?.threads ?? []
      const existingFeatureThread = threads.find((thread) => thread.entityType === 'feature' && thread.entityId === featureId)
      if (existingFeatureThread) {
        await api.addComment(existingFeatureThread.id, { body: comment, actorName })
      } else {
        await api.createCommentThread(featureId, {
          entityType: 'feature',
          entityId: featureId,
          initialComment: comment,
          actorName,
        })
      }
    },
    onSuccess: () => {
      setComment('')
      void queryClient.invalidateQueries({ queryKey: ['comments', featureId] })
    },
  })

  const publishGroups = useMemo(() => {
    const events = trackingPlanQuery.data?.events ?? []
    return {
      create: events.filter((event) => event.decisionType === 'new').length,
      update: events.filter((event) => event.decisionType === 'update').length,
      reuse: events.filter((event) => event.decisionType === 'reuse').length,
    }
  }, [trackingPlanQuery.data?.events])

  const warnings = validationQuery.data?.issues.filter((issue) => issue.severity === 'warning').length ?? 0
  const blockers = validationQuery.data?.issues.filter((issue) => issue.severity === 'blocker').length ?? 0

  const onSubmitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    commentMutation.mutate()
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
      <section className="panel space-y-4">
        <h2 className="font-display text-3xl font-bold tracking-tight">Review & Publish</h2>
        <p className="text-sm text-shell-ink/70">
          Publish is whole-plan and transactional. Blockers hard-stop release. Warnings require explicit acknowledgement.
        </p>

        <div className="grid gap-2 rounded-xl border border-shell-stroke bg-shell-soft p-3 text-sm">
          <div className="flex justify-between">
            <span>Create</span>
            <strong>{publishGroups.create}</strong>
          </div>
          <div className="flex justify-between">
            <span>Update</span>
            <strong>{publishGroups.update}</strong>
          </div>
          <div className="flex justify-between">
            <span>Reuse</span>
            <strong>{publishGroups.reuse}</strong>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="grid gap-1 text-xs uppercase tracking-[0.1em] text-shell-ink/65">
            Warning acknowledgement
            <textarea
              className="input-shell min-h-24"
              value={acknowledgement}
              onChange={(e) => setAcknowledgement(e.target.value)}
              placeholder="Required when warnings are present"
            />
          </label>
          <button className="action-btn w-fit" disabled={publishMutation.isPending || blockers > 0} onClick={() => publishMutation.mutate()}>
            Publish to Catalog
          </button>
          {blockers > 0 ? <p className="text-xs text-destructive">Resolve blockers before publish.</p> : null}
          {warnings > 0 ? <p className="text-xs text-amber-600 dark:text-amber-400">Warnings found. Add acknowledgement note before publish.</p> : null}
          {publishMutation.isError ? <p className="text-xs text-destructive">{(publishMutation.error as Error).message}</p> : null}
        </div>

        <div className="space-y-3 border-t border-shell-stroke pt-4">
          <h3 className="font-display text-xl uppercase tracking-[0.08em]">Comments</h3>
          <form className="grid gap-2" onSubmit={onSubmitComment}>
            <textarea
              className="input-shell min-h-24"
              placeholder="Add review note"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button className="action-btn alt w-fit" disabled={commentMutation.isPending || !comment.trim()}>
              Add Comment
            </button>
          </form>
          {(commentsQuery.data?.comments ?? []).map((item) => (
            <article key={item.id} className="rounded-xl border border-shell-stroke bg-shell-soft p-3 text-sm">
              <p className="font-semibold">{item.authorName}</p>
              <p className="mt-1 text-shell-ink/75">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <ValidationRail featureId={featureId} title="Release Checks" />
    </div>
  )
}
