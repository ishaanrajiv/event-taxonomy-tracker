export default function Changelog({ changelog }) {
  const getActionColor = (action) => {
    const colors = {
      'create': 'bg-green-100 text-green-800',
      'update': 'bg-blue-100 text-blue-800',
      'delete': 'bg-red-100 text-red-800',
    }
    return colors[action] || 'bg-gray-100 text-gray-800'
  }

  const formatValue = (value) => {
    if (!value) return '—'
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return value
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Changelog ({changelog.length})
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Audit trail of all changes to events and properties
      </p>

      {changelog.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No changes recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {changelog.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(entry.action)}`}>
                    {entry.action.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {entry.entity_type} #{entry.entity_id}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(entry.changed_at).toLocaleString()}
                </div>
              </div>

              {entry.changed_by && (
                <div className="text-sm text-gray-600 mb-2">
                  by {entry.changed_by}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-3">
                {entry.old_value && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Before</div>
                    <pre className="text-xs bg-red-50 p-2 rounded border border-red-200 overflow-x-auto">
                      {formatValue(entry.old_value)}
                    </pre>
                  </div>
                )}
                {entry.new_value && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">After</div>
                    <pre className="text-xs bg-green-50 p-2 rounded border border-green-200 overflow-x-auto">
                      {formatValue(entry.new_value)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
