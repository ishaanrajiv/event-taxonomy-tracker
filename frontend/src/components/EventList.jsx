import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function EventList({ events, loading, onCreateEvent, onEditEvent, onDeleteEvent }) {
  const [expandedEvent, setExpandedEvent] = useState(null)

  const toggleEvent = (eventId) => {
    setExpandedEvent(expandedEvent === eventId ? null : eventId)
  }

  const getCategoryVariant = (category) => {
    const variants = {
      'Engagement': 'default',
      'Navigation': 'secondary',
      'Transaction': 'default',
      'User': 'secondary',
    }
    return variants[category] || 'outline'
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading events...
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          Events ({events.length})
        </h2>
        <Button onClick={onCreateEvent}>
          <Plus className="mr-2 h-4 w-4" />
          New Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No events found. Create your first event to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden transition-all hover:shadow-md">
              {/* Event Header */}
              <div
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => toggleEvent(event.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {expandedEvent === event.id ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-lg font-medium">
                        {event.name}
                      </span>
                      {event.category && (
                        <Badge variant={getCategoryVariant(event.category)}>
                          {event.category}
                        </Badge>
                      )}
                    </div>
                    {event.description && (
                      <p className="mt-1 text-sm text-muted-foreground ml-7">{event.description}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground ml-7">
                      {event.properties.length} properties
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditEvent(event)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteEvent(event.id)
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              {/* Expanded Event Details */}
              {expandedEvent === event.id && (
                <CardContent className="pt-0 border-t">
                  <h3 className="text-sm font-semibold mb-3 mt-4">Properties</h3>
                  {event.properties.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No properties added yet</p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Data Type</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Example</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {event.properties.map((prop) => (
                            <TableRow key={prop.id}>
                              <TableCell className="font-medium">{prop.property_name}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  prop.property_type === 'event' ? 'default' :
                                    prop.property_type === 'user' ? 'secondary' :
                                      'outline'
                                }>
                                  {prop.property_type}
                                </Badge>
                              </TableCell>
                              <TableCell>{prop.data_type}</TableCell>
                              <TableCell>
                                {prop.is_required ? '✓' : '—'}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {prop.example_value || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {event.created_by && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Last modified: {new Date(event.updated_at).toLocaleString()} by {event.created_by}
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
