import { safeParseJson } from '../lib/json.js'

type WithPlatforms = { platformsJson: string | null }
type WithAllowedValues = { allowedValuesJson: string | null }
type WithConfidence = { aiConfidence: string | null }

export const parsePlatforms = (row: WithPlatforms): string[] => safeParseJson<string[]>(row.platformsJson, [])

export const parseAllowedValues = (row: WithAllowedValues): unknown =>
  row.allowedValuesJson ? safeParseJson<unknown>(row.allowedValuesJson, null) : null

export const parseConfidence = (row: WithConfidence): number | null => {
  if (!row.aiConfidence) {
    return null
  }

  const parsed = Number(row.aiConfidence)
  if (Number.isNaN(parsed)) {
    return null
  }

  return parsed
}
