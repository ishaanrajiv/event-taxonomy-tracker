import { describe, expect, it } from 'vitest'

import { getActorName, setActorName } from './profile'

describe('profile storage', () => {
  it('stores and reads display name', () => {
    setActorName('Jordan Analyst')
    expect(getActorName()).toBe('Jordan Analyst')
  })

  it('falls back to default actor', () => {
    localStorage.removeItem('tracker.profile.displayName')
    expect(getActorName()).toBe('Local Analyst')
  })
})
