import type {
  AiRun,
  CatalogEvent,
  CatalogProperty,
  CreateAiRunRequest,
  CreateFeatureRequest,
  CreatePlanEventRequest,
  CreateRequirementRequest,
  CreateSourceRequest,
  Feature,
  FeatureRequirement,
  FeatureSource,
  PlanEvent,
  PlanEventProperty,
  PlanEventRequirementLink,
  PublishFeatureRequest,
  TrackingPlan,
  TrackingPlanRelease,
  UpdateFeatureRequest,
  UpsertCatalogEventRequest,
  ValidationIssue,
  ValidationSummary,
} from '@tracker/contracts'
import {
  CreateAiRunRequestSchema,
  CreateFeatureRequestSchema,
  CreatePlanEventRequestSchema,
  CreateRequirementRequestSchema,
  CreateSourceRequestSchema,
  PublishFeatureRequestSchema,
  UpdateFeatureRequestSchema,
  UpsertCatalogEventRequestSchema,
} from '@tracker/contracts'

type FeatureDetail = {
  feature: Feature
  trackingPlan: TrackingPlan
}

type TrackingPlanDetail = {
  trackingPlan: TrackingPlan
  events: PlanEvent[]
  properties: PlanEventProperty[]
  requirementLinks: PlanEventRequirementLink[]
}

type ValidationResponse = {
  issues: ValidationIssue[]
  summary: ValidationSummary
}

type CommentsResponse = {
  threads: Array<{ id: string; featureId: string; entityType: string; entityId: string; status: 'open' | 'resolved'; createdAt: string; updatedAt: string }>
  comments: Array<{ id: string; threadId: string; authorName: string; body: string; createdAt: string }>
}

const apiRequest = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(payload || `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const api = {
  health: () => apiRequest<{ ok: boolean; version: string; aiEnabled: boolean }>('/api/health'),

  listFeatures: () => apiRequest<Feature[]>('/api/features'),
  getFeature: (featureId: string) => apiRequest<FeatureDetail>(`/api/features/${featureId}`),
  createFeature: (payload: CreateFeatureRequest) => {
    CreateFeatureRequestSchema.parse(payload)
    return apiRequest<FeatureDetail>('/api/features', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  updateFeature: (featureId: string, payload: UpdateFeatureRequest) => {
    UpdateFeatureRequestSchema.parse(payload)
    return apiRequest<Feature>(`/api/features/${featureId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  listSources: (featureId: string) => apiRequest<FeatureSource[]>(`/api/features/${featureId}/sources`),
  createTextSource: (featureId: string, payload: CreateSourceRequest) => {
    CreateSourceRequestSchema.parse(payload)
    return apiRequest<FeatureSource>(`/api/features/${featureId}/sources`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  uploadFileSource: async (featureId: string, file: File, title: string, actorName: string) => {
    const form = new FormData()
    form.set('file', file)
    form.set('title', title)
    form.set('actorName', actorName)

    const response = await fetch(`/api/features/${featureId}/sources`, {
      method: 'POST',
      body: form,
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    return (await response.json()) as FeatureSource
  },

  listRequirements: (featureId: string) => apiRequest<FeatureRequirement[]>(`/api/features/${featureId}/requirements`),
  createRequirement: (featureId: string, payload: CreateRequirementRequest) => {
    CreateRequirementRequestSchema.parse(payload)
    return apiRequest<FeatureRequirement>(`/api/features/${featureId}/requirements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getTrackingPlan: (featureId: string) => apiRequest<TrackingPlanDetail>(`/api/features/${featureId}/tracking-plan`),
  createPlanEvent: (featureId: string, payload: CreatePlanEventRequest) => {
    CreatePlanEventRequestSchema.parse(payload)
    return apiRequest<PlanEvent>(`/api/features/${featureId}/tracking-plan/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getValidation: (featureId: string) => apiRequest<ValidationResponse>(`/api/features/${featureId}/validation`),
  recomputeValidation: (featureId: string) => apiRequest<ValidationResponse>(`/api/features/${featureId}/validation/recompute`, {
    method: 'POST',
  }),

  getComments: (featureId: string) => apiRequest<CommentsResponse>(`/api/features/${featureId}/comments`),
  createCommentThread: (
    featureId: string,
    payload: { entityType: 'feature' | 'requirement' | 'plan_event' | 'validation_issue'; entityId: string; initialComment: string; actorName: string },
  ) =>
    apiRequest<{ threadId: string }>(`/api/features/${featureId}/comments/threads`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  addComment: (threadId: string, payload: { body: string; actorName: string }) =>
    apiRequest<{ id: string; threadId: string; authorName: string; body: string; createdAt: string }>(
      `/api/comment-threads/${threadId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  createAiRun: (featureId: string, payload: CreateAiRunRequest) => {
    CreateAiRunRequestSchema.parse(payload)
    return apiRequest<AiRun>(`/api/features/${featureId}/ai-runs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getAiRun: (runId: string) => apiRequest<AiRun>(`/api/ai-runs/${runId}`),

  publishFeature: (featureId: string, payload: PublishFeatureRequest) => {
    PublishFeatureRequestSchema.parse(payload)
    return apiRequest<{ releaseId: string; releaseNumber: number; created: number; updated: number; reused: number }>(
      `/api/features/${featureId}/publish`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  },
  listReleases: (featureId: string) => apiRequest<TrackingPlanRelease[]>(`/api/features/${featureId}/releases`),
  getRelease: (releaseId: string) =>
    apiRequest<{ release: TrackingPlanRelease; versions: Array<{ id: string; catalogEventId: string; versionNumber: number; action: string; snapshotJson: unknown; diffJson: unknown; sourceFeatureId: string | null; sourceReleaseId: string | null; createdAt: string }> }>(
      `/api/releases/${releaseId}`,
    ),

  listCatalogEvents: () => apiRequest<CatalogEvent[]>('/api/catalog/events'),
  createCatalogEvent: (payload: UpsertCatalogEventRequest) => {
    UpsertCatalogEventRequestSchema.parse(payload)
    return apiRequest<{ releaseId: string; eventId: string }>('/api/catalog/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getCatalogEvent: (eventId: string) =>
    apiRequest<{ event: CatalogEvent; properties: Array<{ property: CatalogProperty; scope: string; required: boolean; exampleValue: string | null; notes: string | null }> }>(
      `/api/catalog/events/${eventId}`,
    ),
  listCatalogEventVersions: (eventId: string) =>
    apiRequest<Array<{ id: string; catalogEventId: string; versionNumber: number; action: string; snapshotJson: unknown; diffJson: unknown; sourceFeatureId: string | null; sourceReleaseId: string | null; createdAt: string }>>(
      `/api/catalog/events/${eventId}/versions`,
    ),
  listCatalogProperties: () => apiRequest<CatalogProperty[]>('/api/catalog/properties'),
  searchCatalog: (query: string) =>
    apiRequest<{ events: CatalogEvent[]; properties: CatalogProperty[] }>(`/api/catalog/search?q=${encodeURIComponent(query)}`),
}
