import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { queryClient } from '../app/query-client'
import { useFeatureWorkspace } from '../components/FeatureWorkspaceLayout'
import { api } from '../lib/api'

export const FeaturePrdPage = () => {
  const { featureId, actorName } = useFeatureWorkspace()
  const [title, setTitle] = useState('PRD Notes')
  const [text, setText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [runId, setRunId] = useState<string | null>(null)

  const sourcesQuery = useQuery({
    queryKey: ['sources', featureId],
    queryFn: () => api.listSources(featureId),
  })

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
  })

  const runQuery = useQuery({
    queryKey: ['ai-run', runId],
    queryFn: () => api.getAiRun(runId as string),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' || status === 'queued' ? 1500 : false
    },
  })

  const sourceMutation = useMutation({
    mutationFn: () =>
      api.createTextSource(featureId, {
        sourceType: 'pasted_text',
        title,
        rawText: text,
        actorName,
      }),
    onSuccess: () => {
      setText('')
      void queryClient.invalidateQueries({ queryKey: ['sources', featureId] })
    },
  })

  const fileMutation = useMutation({
    mutationFn: () => api.uploadFileSource(featureId, selectedFile as File, selectedFile?.name || 'upload', actorName),
    onSuccess: () => {
      setSelectedFile(null)
      void queryClient.invalidateQueries({ queryKey: ['sources', featureId] })
    },
  })

  const runMutation = useMutation({
    mutationFn: (runType: 'extract_requirements' | 'generate_plan' | 'match_catalog' | 'full_generate') =>
      api.createAiRun(featureId, { runType, actorName }),
    onSuccess: (run) => setRunId(run.id),
  })

  const onSubmitText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    sourceMutation.mutate()
  }

  const isAiEnabled = healthQuery.data?.aiEnabled ?? false

  const parseFailureCount = useMemo(
    () => (sourcesQuery.data ?? []).filter((source) => source.parseStatus === 'failed').length,
    [sourcesQuery.data],
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
      <section className="panel space-y-4">
        <h2 className="font-display text-3xl font-bold tracking-tight">PRD Sources</h2>

        <form className="grid gap-3" onSubmit={onSubmitText}>
          <label className="grid gap-1 text-xs uppercase tracking-[0.1em] text-shell-ink/65">
            Source title
            <input className="input-shell" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.1em] text-shell-ink/65">
            Paste text
            <textarea
              className="input-shell min-h-40"
              placeholder="Paste PRD content, release notes, or analyst context"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button className="action-btn w-fit" disabled={sourceMutation.isPending || !text.trim()}>
            Save pasted source
          </button>
        </form>

        <div className="border-t border-shell-stroke pt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-shell-ink/65">Upload file (.txt, .md, .pdf, .docx)</p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".txt,.md,.pdf,.docx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            <button
              className="action-btn alt"
              disabled={!selectedFile || fileMutation.isPending}
              onClick={() => fileMutation.mutate()}
              type="button"
            >
              Upload source file
            </button>
          </div>
        </div>

        <div className="space-y-2 border-t border-shell-stroke pt-4">
          <p className="text-xs uppercase tracking-[0.1em] text-shell-ink/65">Current source documents</p>
          {(sourcesQuery.data ?? []).map((source) => (
            <article key={source.id} className="rounded-xl border border-shell-stroke bg-shell-soft p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{source.title}</p>
                <span className="text-xs uppercase tracking-[0.1em] text-shell-ink/60">{source.parseStatus}</span>
              </div>
              <p className="mt-1 text-xs text-shell-ink/60">{source.sourceType}</p>
              <p className="mt-2 line-clamp-3 text-shell-ink/75">{source.extractedText ?? source.rawText ?? 'No extracted text.'}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="panel space-y-4">
        <h3 className="font-display text-2xl font-bold tracking-tight">AI Actions</h3>
        <p className="text-xs text-shell-ink/70">
          AI is explicit-trigger only. Nothing runs automatically on upload. Human review is still required before
          publish.
        </p>

        <div className="grid gap-2">
          <button className="action-btn" disabled={!isAiEnabled || runMutation.isPending} onClick={() => runMutation.mutate('extract_requirements')}>
            Extract Requirements
          </button>
          <button className="action-btn alt" disabled={!isAiEnabled || runMutation.isPending} onClick={() => runMutation.mutate('generate_plan')}>
            Generate Tracking Plan
          </button>
          <button className="action-btn alt" disabled={!isAiEnabled || runMutation.isPending} onClick={() => runMutation.mutate('match_catalog')}>
            Match Catalog
          </button>
          <button className="action-btn" disabled={!isAiEnabled || runMutation.isPending} onClick={() => runMutation.mutate('full_generate')}>
            Full Generate
          </button>
        </div>

        {!isAiEnabled ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">AI disabled: set `OPENAI_API_KEY` and `AI_MODEL` in API env.</p>
        ) : null}

        {runQuery.data ? (
          <div className="rounded-xl border border-shell-stroke bg-shell-soft p-3 text-xs">
            <p className="uppercase tracking-[0.1em] text-shell-ink/60">Last AI run</p>
            <p className="mt-1">Type: {runQuery.data.runType}</p>
            <p>Status: {runQuery.data.status}</p>
            {runQuery.data.errorMessage ? <p className="text-destructive">{runQuery.data.errorMessage}</p> : null}
          </div>
        ) : null}

        {parseFailureCount > 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {parseFailureCount} source(s) failed parsing. Add manual paste text before AI generation.
          </p>
        ) : null}
      </aside>
    </div>
  )
}
