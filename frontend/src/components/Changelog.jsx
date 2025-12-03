import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export default function Changelog({ changelog }) {
  const getActionVariant = (action) => {
    const variants = {
      'create': 'default',
      'update': 'secondary',
      'delete': 'destructive',
    }
    return variants[action] || 'outline'
  }

  const formatValue = (value) => {
    if (!value) return '—'
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return value
  }

  const getEntityName = (entry) => {
    // For events, try to get the event name
    if (entry.entity_type === 'event') {
      const name = entry.new_value?.name || entry.old_value?.name
      return name ? `"${name}"` : `#${entry.entity_id}`
    }
    return `#${entry.entity_id}`
  }

  const getChangeSummary = (entry) => {
    // For property add/remove actions
    if (entry.new_value?.action === 'property_added') {
      const prop = entry.new_value.property
      return `Added property: ${prop.name} (${prop.type}, ${prop.data_type})`
    }
    if (entry.old_value?.action === 'property_removed') {
      const prop = entry.old_value.property
      return `Removed property: ${prop.name} (${prop.type}, ${prop.data_type})`
    }

    // For event creation
    if (entry.action === 'create' && entry.entity_type === 'event' && entry.new_value?.properties) {
      const propCount = entry.new_value.properties.length
      return `Created with ${propCount} ${propCount === 1 ? 'property' : 'properties'}`
    }

    // For event deletion
    if (entry.action === 'delete' && entry.entity_type === 'event' && entry.old_value?.properties) {
      const propCount = entry.old_value.properties.length
      return `Deleted (had ${propCount} ${propCount === 1 ? 'property' : 'properties'})`
    }

    return null
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">
        Changelog ({changelog.length})
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Audit trail of all changes to events and properties
      </p>

      {changelog.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No changes recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {changelog.map((entry) => {
            const summary = getChangeSummary(entry)
            return (
              <Card key={entry.id} className="transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getActionVariant(entry.action)}>
                        {entry.action.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium">
                        {entry.entity_type} {getEntityName(entry)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.changed_at).toLocaleString()}
                    </div>
                  </div>

                  {entry.changed_by && (
                    <div className="text-sm text-muted-foreground mb-2">
                      by {entry.changed_by}
                    </div>
                  )}

                  {summary && (
                    <div className="text-sm mb-3 italic text-muted-foreground">
                      {summary}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mt-3">
                    {entry.old_value && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Before</div>
                        <pre className="text-xs bg-destructive/10 p-2 rounded border border-destructive/20 overflow-x-auto">
                          {formatValue(entry.old_value)}
                        </pre>
                      </div>
                    )}
                    {entry.new_value && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">After</div>
                        <pre className="text-xs bg-primary/10 p-2 rounded border border-primary/20 overflow-x-auto">
                          {formatValue(entry.new_value)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
