import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { buildServer } from '../src/server.js'

describe('API smoke', () => {
  it('serves health and can create a feature', async () => {
    const app = await buildServer()

    const health = await app.inject({ method: 'GET', url: '/api/health' })
    expect(health.statusCode).toBe(200)

    const suffix = randomUUID().slice(0, 8)

    const create = await app.inject({
      method: 'POST',
      url: '/api/features',
      payload: {
        title: `Checkout Tracking ${suffix}`,
        slug: `checkout-tracking-${suffix}`,
        actorName: 'Smoke Test',
      },
    })

    expect(create.statusCode).toBe(201)
    const created = create.json()
    expect(created.feature.title).toContain('Checkout Tracking')

    await app.close()
  })
})
