import { sqlite } from './client.js'

export const ensureSchema = (): void => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT,
      productArea TEXT,
      ownerName TEXT,
      targetRelease TEXT,
      workflowStatus TEXT NOT NULL DEFAULT 'draft',
      hasUnpublishedChanges INTEGER NOT NULL DEFAULT 0,
      lastPublishedReleaseNumber INTEGER,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS featureSources (
      id TEXT PRIMARY KEY,
      featureId TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      title TEXT NOT NULL,
      originalFilename TEXT,
      mimeType TEXT,
      storagePath TEXT,
      rawText TEXT,
      extractedText TEXT,
      externalUrl TEXT,
      parseStatus TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS featureRequirements (
      id TEXT PRIMARY KEY,
      featureId TEXT NOT NULL,
      sourceId TEXT,
      ordinal INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unmapped',
      sourceExcerpt TEXT,
      sourceLocation TEXT,
      sourceMethod TEXT NOT NULL DEFAULT 'manual',
      aiConfidence TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE CASCADE,
      FOREIGN KEY (sourceId) REFERENCES featureSources(id) ON DELETE SET NULL,
      UNIQUE(featureId, ordinal)
    );

    CREATE TABLE IF NOT EXISTS trackingPlans (
      id TEXT PRIMARY KEY,
      featureId TEXT NOT NULL UNIQUE,
      summary TEXT,
      generationState TEXT NOT NULL DEFAULT 'idle',
      lastGeneratedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS planEvents (
      id TEXT PRIMARY KEY,
      trackingPlanId TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      name TEXT,
      description TEXT,
      trigger TEXT,
      platformsJson TEXT NOT NULL DEFAULT '[]',
      decisionType TEXT NOT NULL DEFAULT 'new',
      workflowState TEXT NOT NULL DEFAULT 'draft',
      linkedCatalogEventId TEXT,
      catalogBaseVersionNumber INTEGER,
      sourceMethod TEXT NOT NULL DEFAULT 'manual',
      aiConfidence TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trackingPlanId) REFERENCES trackingPlans(id) ON DELETE CASCADE,
      UNIQUE(trackingPlanId, ordinal)
    );

    CREATE TABLE IF NOT EXISTS planEventProperties (
      id TEXT PRIMARY KEY,
      planEventId TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      name TEXT NOT NULL,
      scope TEXT NOT NULL,
      dataType TEXT NOT NULL,
      description TEXT,
      required INTEGER NOT NULL DEFAULT 0,
      exampleValue TEXT,
      allowedValuesJson TEXT,
      sourceMethod TEXT NOT NULL DEFAULT 'manual',
      aiConfidence TEXT,
      FOREIGN KEY (planEventId) REFERENCES planEvents(id) ON DELETE CASCADE,
      UNIQUE(planEventId, ordinal)
    );

    CREATE TABLE IF NOT EXISTS planEventRequirementLinks (
      id TEXT PRIMARY KEY,
      planEventId TEXT NOT NULL,
      requirementId TEXT NOT NULL,
      FOREIGN KEY (planEventId) REFERENCES planEvents(id) ON DELETE CASCADE,
      FOREIGN KEY (requirementId) REFERENCES featureRequirements(id) ON DELETE CASCADE,
      UNIQUE(planEventId, requirementId)
    );

    CREATE TABLE IF NOT EXISTS validationIssues (
      id TEXT PRIMARY KEY,
      featureId TEXT NOT NULL,
      trackingPlanId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      severity TEXT NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT NOT NULL,
      isDismissed INTEGER NOT NULL DEFAULT 0,
      dismissedReason TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE CASCADE,
      FOREIGN KEY (trackingPlanId) REFERENCES trackingPlans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS commentThreads (
      id TEXT PRIMARY KEY,
      featureId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      threadId TEXT NOT NULL,
      authorName TEXT NOT NULL,
      body TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (threadId) REFERENCES commentThreads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS catalogEvents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      trigger TEXT,
      platformsJson TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      currentVersionNumber INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalogProperties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      normalizedName TEXT NOT NULL,
      dataType TEXT NOT NULL,
      description TEXT,
      allowedValuesJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(normalizedName, dataType)
    );

    CREATE TABLE IF NOT EXISTS catalogEventProperties (
      id TEXT PRIMARY KEY,
      catalogEventId TEXT NOT NULL,
      propertyId TEXT NOT NULL,
      scope TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      exampleValue TEXT,
      notes TEXT,
      FOREIGN KEY (catalogEventId) REFERENCES catalogEvents(id) ON DELETE CASCADE,
      FOREIGN KEY (propertyId) REFERENCES catalogProperties(id) ON DELETE CASCADE,
      UNIQUE(catalogEventId, propertyId, scope)
    );

    CREATE TABLE IF NOT EXISTS catalogEventVersions (
      id TEXT PRIMARY KEY,
      catalogEventId TEXT NOT NULL,
      versionNumber INTEGER NOT NULL,
      action TEXT NOT NULL,
      snapshotJson TEXT NOT NULL,
      diffJson TEXT NOT NULL,
      sourceFeatureId TEXT,
      sourceReleaseId TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (catalogEventId) REFERENCES catalogEvents(id) ON DELETE CASCADE,
      UNIQUE(catalogEventId, versionNumber)
    );

    CREATE TABLE IF NOT EXISTS trackingPlanReleases (
      id TEXT PRIMARY KEY,
      featureId TEXT,
      trackingPlanId TEXT,
      releaseNumber INTEGER NOT NULL,
      summary TEXT,
      publishedBy TEXT NOT NULL,
      publishedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resultSnapshotJson TEXT NOT NULL,
      resultDiffJson TEXT NOT NULL,
      publishMode TEXT NOT NULL,
      FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE SET NULL,
      FOREIGN KEY (trackingPlanId) REFERENCES trackingPlans(id) ON DELETE SET NULL,
      UNIQUE(featureId, releaseNumber)
    );

    CREATE TABLE IF NOT EXISTS aiRuns (
      id TEXT PRIMARY KEY,
      featureId TEXT NOT NULL,
      runType TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      startedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finishedAt TEXT,
      errorMessage TEXT,
      inputSnapshotJson TEXT,
      outputSnapshotJson TEXT,
      FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE CASCADE
    );
  `)
}
