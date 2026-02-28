import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { api } from '../lib/api'

export const CatalogPage = () => {
  const catalogQuery = useQuery({
    queryKey: ['catalog-events'],
    queryFn: api.listCatalogEvents,
  })

  return (
    <section className="space-y-4">
      <header className="panel">
        <p className="eyebrow">Published Source of Truth</p>
        <h1 className="font-display text-4xl uppercase tracking-[0.08em]">Catalog Events</h1>
      </header>

      <div className="panel overflow-auto">
        {catalogQuery.isPending ? <p>Loading catalog...</p> : null}
        {catalogQuery.data ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-shell-stroke text-left text-xs uppercase tracking-[0.1em]">
                <th className="py-2 pr-2">Event</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Version</th>
                <th className="py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {catalogQuery.data.map((event) => (
                <tr key={event.id} className="border-b border-shell-stroke/60">
                  <td className="py-2 pr-2">
                    <Link to={`/catalog/events/${event.id}`} className="font-semibold hover:underline">
                      {event.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 uppercase">{event.status}</td>
                  <td className="py-2 pr-2">v{event.currentVersionNumber}</td>
                  <td className="py-2">{new Date(event.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  )
}
