import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
}

export const features = sqliteTable(
  'features',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    productArea: text('productArea'),
    ownerName: text('ownerName'),
    targetRelease: text('targetRelease'),
    workflowStatus: text('workflowStatus').notNull().default('draft'),
    hasUnpublishedChanges: integer('hasUnpublishedChanges', { mode: 'boolean' }).notNull().default(false),
    lastPublishedReleaseNumber: integer('lastPublishedReleaseNumber'),
    ...timestamps,
  },
  (table) => ({
    slugIdx: uniqueIndex('features_slug_idx').on(table.slug),
  }),
)

export const featureSources = sqliteTable(
  'featureSources',
  {
    id: text('id').primaryKey(),
    featureId: text('featureId')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    sourceType: text('sourceType').notNull(),
    title: text('title').notNull(),
    originalFilename: text('originalFilename'),
    mimeType: text('mimeType'),
    storagePath: text('storagePath'),
    rawText: text('rawText'),
    extractedText: text('extractedText'),
    externalUrl: text('externalUrl'),
    parseStatus: text('parseStatus').notNull().default('pending'),
    createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    featureIdx: index('feature_sources_feature_idx').on(table.featureId),
  }),
)

export const featureRequirements = sqliteTable(
  'featureRequirements',
  {
    id: text('id').primaryKey(),
    featureId: text('featureId')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    sourceId: text('sourceId').references(() => featureSources.id, { onDelete: 'set null' }),
    ordinal: integer('ordinal').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: text('status').notNull().default('unmapped'),
    sourceExcerpt: text('sourceExcerpt'),
    sourceLocation: text('sourceLocation'),
    sourceMethod: text('sourceMethod').notNull().default('manual'),
    aiConfidence: text('aiConfidence'),
    ...timestamps,
  },
  (table) => ({
    featureOrdIdx: uniqueIndex('requirements_feature_ordinal_idx').on(table.featureId, table.ordinal),
  }),
)

export const trackingPlans = sqliteTable(
  'trackingPlans',
  {
    id: text('id').primaryKey(),
    featureId: text('featureId')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    summary: text('summary'),
    generationState: text('generationState').notNull().default('idle'),
    lastGeneratedAt: text('lastGeneratedAt'),
    ...timestamps,
  },
  (table) => ({
    featureUniqueIdx: uniqueIndex('tracking_plan_feature_unique_idx').on(table.featureId),
  }),
)

export const planEvents = sqliteTable(
  'planEvents',
  {
    id: text('id').primaryKey(),
    trackingPlanId: text('trackingPlanId')
      .notNull()
      .references(() => trackingPlans.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    name: text('name'),
    description: text('description'),
    trigger: text('trigger'),
    platformsJson: text('platformsJson').notNull().default('[]'),
    decisionType: text('decisionType').notNull().default('new'),
    workflowState: text('workflowState').notNull().default('draft'),
    linkedCatalogEventId: text('linkedCatalogEventId'),
    catalogBaseVersionNumber: integer('catalogBaseVersionNumber'),
    sourceMethod: text('sourceMethod').notNull().default('manual'),
    aiConfidence: text('aiConfidence'),
    ...timestamps,
  },
  (table) => ({
    planOrdIdx: uniqueIndex('plan_events_tracking_plan_ord_idx').on(table.trackingPlanId, table.ordinal),
  }),
)

export const planEventProperties = sqliteTable(
  'planEventProperties',
  {
    id: text('id').primaryKey(),
    planEventId: text('planEventId')
      .notNull()
      .references(() => planEvents.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    name: text('name').notNull(),
    scope: text('scope').notNull(),
    dataType: text('dataType').notNull(),
    description: text('description'),
    required: integer('required', { mode: 'boolean' }).notNull().default(false),
    exampleValue: text('exampleValue'),
    allowedValuesJson: text('allowedValuesJson'),
    sourceMethod: text('sourceMethod').notNull().default('manual'),
    aiConfidence: text('aiConfidence'),
  },
  (table) => ({
    eventOrdIdx: uniqueIndex('plan_event_properties_event_ord_idx').on(table.planEventId, table.ordinal),
  }),
)

export const planEventRequirementLinks = sqliteTable(
  'planEventRequirementLinks',
  {
    id: text('id').primaryKey(),
    planEventId: text('planEventId')
      .notNull()
      .references(() => planEvents.id, { onDelete: 'cascade' }),
    requirementId: text('requirementId')
      .notNull()
      .references(() => featureRequirements.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    uniqueLinkIdx: uniqueIndex('plan_event_requirement_links_unique').on(table.planEventId, table.requirementId),
  }),
)

export const validationIssues = sqliteTable(
  'validationIssues',
  {
    id: text('id').primaryKey(),
    featureId: text('featureId')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    trackingPlanId: text('trackingPlanId')
      .notNull()
      .references(() => trackingPlans.id, { onDelete: 'cascade' }),
    entityType: text('entityType').notNull(),
    entityId: text('entityId').notNull(),
    severity: text('severity').notNull(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    source: text('source').notNull(),
    isDismissed: integer('isDismissed', { mode: 'boolean' }).notNull().default(false),
    dismissedReason: text('dismissedReason'),
    createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    featureIdx: index('validation_issues_feature_idx').on(table.featureId),
  }),
)

export const commentThreads = sqliteTable(
  'commentThreads',
  {
    id: text('id').primaryKey(),
    featureId: text('featureId')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    entityType: text('entityType').notNull(),
    entityId: text('entityId').notNull(),
    status: text('status').notNull().default('open'),
    ...timestamps,
  },
  (table) => ({
    featureIdx: index('comment_threads_feature_idx').on(table.featureId),
  }),
)

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    threadId: text('threadId')
      .notNull()
      .references(() => commentThreads.id, { onDelete: 'cascade' }),
    authorName: text('authorName').notNull(),
    body: text('body').notNull(),
    createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    threadIdx: index('comments_thread_idx').on(table.threadId),
  }),
)

export const catalogEvents = sqliteTable(
  'catalogEvents',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    trigger: text('trigger'),
    platformsJson: text('platformsJson').notNull().default('[]'),
    status: text('status').notNull().default('active'),
    currentVersionNumber: integer('currentVersionNumber').notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    nameIdx: index('catalog_events_name_idx').on(table.name),
  }),
)

export const catalogProperties = sqliteTable(
  'catalogProperties',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    normalizedName: text('normalizedName').notNull(),
    dataType: text('dataType').notNull(),
    description: text('description'),
    allowedValuesJson: text('allowedValuesJson'),
    ...timestamps,
  },
  (table) => ({
    normalizedTypeIdx: uniqueIndex('catalog_properties_normalized_type_idx').on(table.normalizedName, table.dataType),
  }),
)

export const catalogEventProperties = sqliteTable(
  'catalogEventProperties',
  {
    id: text('id').primaryKey(),
    catalogEventId: text('catalogEventId')
      .notNull()
      .references(() => catalogEvents.id, { onDelete: 'cascade' }),
    propertyId: text('propertyId')
      .notNull()
      .references(() => catalogProperties.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    required: integer('required', { mode: 'boolean' }).notNull().default(false),
    exampleValue: text('exampleValue'),
    notes: text('notes'),
  },
  (table) => ({
    uniquePairIdx: uniqueIndex('catalog_event_property_pair_idx').on(table.catalogEventId, table.propertyId, table.scope),
  }),
)

export const catalogEventVersions = sqliteTable(
  'catalogEventVersions',
  {
    id: text('id').primaryKey(),
    catalogEventId: text('catalogEventId')
      .notNull()
      .references(() => catalogEvents.id, { onDelete: 'cascade' }),
    versionNumber: integer('versionNumber').notNull(),
    action: text('action').notNull(),
    snapshotJson: text('snapshotJson').notNull(),
    diffJson: text('diffJson').notNull(),
    sourceFeatureId: text('sourceFeatureId'),
    sourceReleaseId: text('sourceReleaseId'),
    createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    eventVersionIdx: uniqueIndex('catalog_event_versions_event_version_idx').on(table.catalogEventId, table.versionNumber),
  }),
)

export const trackingPlanReleases = sqliteTable(
  'trackingPlanReleases',
  {
    id: text('id').primaryKey(),
    featureId: text('featureId').references(() => features.id, { onDelete: 'set null' }),
    trackingPlanId: text('trackingPlanId').references(() => trackingPlans.id, { onDelete: 'set null' }),
    releaseNumber: integer('releaseNumber').notNull(),
    summary: text('summary'),
    publishedBy: text('publishedBy').notNull(),
    publishedAt: text('publishedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    resultSnapshotJson: text('resultSnapshotJson').notNull(),
    resultDiffJson: text('resultDiffJson').notNull(),
    publishMode: text('publishMode').notNull(),
  },
  (table) => ({
    featureReleaseIdx: uniqueIndex('tracking_releases_feature_release_idx').on(table.featureId, table.releaseNumber),
  }),
)

export const aiRuns = sqliteTable(
  'aiRuns',
  {
    id: text('id').primaryKey(),
    featureId: text('featureId')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    runType: text('runType').notNull(),
    status: text('status').notNull().default('queued'),
    startedAt: text('startedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    finishedAt: text('finishedAt'),
    errorMessage: text('errorMessage'),
    inputSnapshotJson: text('inputSnapshotJson'),
    outputSnapshotJson: text('outputSnapshotJson'),
  },
  (table) => ({
    featureIdx: index('ai_runs_feature_idx').on(table.featureId),
  }),
)
