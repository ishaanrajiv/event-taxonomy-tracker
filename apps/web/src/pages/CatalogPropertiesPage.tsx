import { useQuery } from '@tanstack/react-query'

import { api } from '../lib/api'

export const CatalogPropertiesPage = () => {
  const query = useQuery({
    queryKey: ['catalog-properties'],
    queryFn: api.listCatalogProperties,
  })

  return (
    <section className="panel space-y-3">
      <h1 className="font-display text-4xl font-bold tracking-tight">Property Registry</h1>
      <p className="text-sm text-shell-ink/70">Global registry enforces normalized name + data type consistency.</p>

      {query.data?.map((property) => (
        <article key={property.id} className="rounded-xl border border-shell-stroke bg-shell-soft p-3">
          <p className="font-semibold">{property.name}</p>
          <p className="text-xs uppercase tracking-[0.1em] text-shell-ink/60">{property.dataType}</p>
          <p className="mt-1 text-sm text-shell-ink/70">{property.description ?? 'No description.'}</p>
        </article>
      ))}
    </section>
  )
}
