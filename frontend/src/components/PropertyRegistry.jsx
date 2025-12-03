import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function PropertyRegistry({ properties }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">
        Property Registry ({properties.length})
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        All unique properties across your event taxonomy
      </p>

      {properties.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No properties registered yet. Create events with properties to populate the registry.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property Name</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">
                    {property.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {property.data_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {property.description || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(property.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {property.created_by || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
