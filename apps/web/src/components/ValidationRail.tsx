import { useQuery } from '@tanstack/react-query'
import type { ValidationIssue } from '@tracker/contracts'

import { api } from '../lib/api'

type ValidationRailProps = {
  featureId: string
  title?: string
}

const group = (issues: ValidationIssue[]) => ({
  blockers: issues.filter((issue) => issue.severity === 'blocker'),
  warnings: issues.filter((issue) => issue.severity === 'warning'),
  info: issues.filter((issue) => issue.severity === 'info'),
})

export const ValidationRail = ({ featureId, title = 'Validation' }: ValidationRailProps) => {
  const validationQuery = useQuery({
    queryKey: ['validation', featureId],
    queryFn: () => api.getValidation(featureId),
    enabled: Boolean(featureId),
  })

  if (validationQuery.isPending) {
    return <aside className="panel">Loading validation...</aside>
  }

  if (validationQuery.isError || !validationQuery.data) {
    return <aside className="panel text-sm text-red-300">Validation unavailable.</aside>
  }

  const grouped = group(validationQuery.data.issues)

  return (
    <aside className="panel space-y-3">
      <h3 className="font-display text-2xl uppercase tracking-[0.08em]">{title}</h3>
      <div className="grid gap-2 text-xs uppercase tracking-[0.1em]">
        <div className="flex items-center justify-between rounded-lg border border-red-300/40 bg-red-950/30 px-3 py-2">
          <span>Blockers</span>
          <strong>{grouped.blockers.length}</strong>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-amber-300/40 bg-amber-950/20 px-3 py-2">
          <span>Warnings</span>
          <strong>{grouped.warnings.length}</strong>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-cyan-300/40 bg-cyan-950/20 px-3 py-2">
          <span>Info</span>
          <strong>{grouped.info.length}</strong>
        </div>
      </div>
      <p className="text-xs text-shell-ink/65">
        Publish is blocked until blockers are cleared. Warnings require explicit acknowledgement in Review.
      </p>
    </aside>
  )
}
