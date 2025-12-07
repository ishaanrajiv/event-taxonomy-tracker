import { ChangelogEntry } from '../types/api';

interface ChangelogProps {
  changelog: ChangelogEntry[];
}

type ActionType = 'create' | 'update' | 'delete';

export default function Changelog({ changelog }: ChangelogProps) {
  const getActionColor = (action: string): string => {
    const colors: Record<ActionType, string> = {
      'create': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'update': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'delete': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[action as ActionType] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const formatValue = (value: Record<string, unknown> | string | null | undefined): string => {
    if (!value) return '—';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return value;
  };

  const getEntityName = (entry: ChangelogEntry): string => {
    // For events, try to get the event name
    if (entry.entity_type === 'event') {
      const name = entry.new_value?.name || entry.old_value?.name;
      return name ? `"${name}"` : `#${entry.entity_id}`;
    }
    return `#${entry.entity_id}`;
  };

  const getChangeSummary = (entry: ChangelogEntry): string | null => {
    // For property add/remove actions
    if (entry.new_value?.action === 'property_added') {
      const prop = entry.new_value.property;
      return `Added property: ${prop.name} (${prop.type}, ${prop.data_type})`;
    }
    if (entry.old_value?.action === 'property_removed') {
      const prop = entry.old_value.property;
      return `Removed property: ${prop.name} (${prop.type}, ${prop.data_type})`;
    }

    // For event creation
    if (entry.action === 'create' && entry.entity_type === 'event' && entry.new_value?.properties) {
      const propCount = entry.new_value.properties.length;
      return `Created with ${propCount} ${propCount === 1 ? 'property' : 'properties'}`;
    }

    // For event deletion
    if (entry.action === 'delete' && entry.entity_type === 'event' && entry.old_value?.properties) {
      const propCount = entry.old_value.properties.length;
      return `Deleted (had ${propCount} ${propCount === 1 ? 'property' : 'properties'})`;
    }

    return null;
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Changelog ({changelog.length})
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Audit trail of all changes to events and properties
      </p>

      {changelog.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>No changes recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {changelog.map((entry) => {
            const summary = getChangeSummary(entry);
            return (
              <div key={entry.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(entry.action)}`}>
                      {entry.action.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {entry.entity_type} {getEntityName(entry)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(entry.changed_at).toLocaleString()}
                  </div>
                </div>

                {entry.changed_by && (
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    by {entry.changed_by}
                  </div>
                )}

                {summary && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 mb-3 italic">
                    {summary}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-3">
                  {entry.old_value && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Before</div>
                      <pre className="text-xs bg-red-50 dark:bg-red-900/20 text-gray-900 dark:text-gray-100 p-2 rounded border border-red-200 dark:border-red-800 overflow-x-auto">
                        {formatValue(entry.old_value)}
                      </pre>
                    </div>
                  )}
                  {entry.new_value && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">After</div>
                      <pre className="text-xs bg-green-50 dark:bg-green-900/20 text-gray-900 dark:text-gray-100 p-2 rounded border border-green-200 dark:border-green-800 overflow-x-auto">
                        {formatValue(entry.new_value)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
