import { Property } from '../types/api';
import EmptyState from './EmptyState';

interface PropertyRegistryProps {
  properties: Property[];
}

export default function PropertyRegistry({ properties }: PropertyRegistryProps) {
  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
          Property Registry
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {properties.length} unique {properties.length === 1 ? 'property' : 'properties'} across your taxonomy
        </p>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Create events with properties to populate the registry."
          icon="properties"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">
                  Property
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">
                  Data Type
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">
                  By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {properties.map((property, index) => (
                <tr
                  key={property.id}
                  className="hover:bg-muted/20 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <td className="px-3 py-2.5 font-medium text-foreground font-mono">
                    {property.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <code className="px-1.5 py-0.5 bg-primary/8 text-primary rounded text-[10px] font-mono font-bold">
                      {property.data_type}
                    </code>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[280px] truncate">
                    {property.description || '\u2014'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {new Date(property.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {property.created_by || '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
