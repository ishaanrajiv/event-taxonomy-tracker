import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AppChrome } from '../components/AppChrome'
import { FeatureWorkspaceLayout } from '../components/FeatureWorkspaceLayout'
import { CatalogEventPage } from '../pages/CatalogEventPage'
import { CatalogPage } from '../pages/CatalogPage'
import { CatalogPropertiesPage } from '../pages/CatalogPropertiesPage'
import { CatalogReleasePage } from '../pages/CatalogReleasePage'
import { FeatureOverviewPage } from '../pages/FeatureOverviewPage'
import { FeaturePrdPage } from '../pages/FeaturePrdPage'
import { FeaturesListPage } from '../pages/FeaturesListPage'
import { NewFeaturePage } from '../pages/NewFeaturePage'
import { NewEventPage } from '../pages/NewEventPage'
import { RequirementsPage } from '../pages/RequirementsPage'
import { ReviewPage } from '../pages/ReviewPage'
import { TrackingPlanPage } from '../pages/TrackingPlanPage'
import { ValidationPage } from '../pages/ValidationPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppChrome />,
    children: [
      { index: true, element: <Navigate to="/features" replace /> },
      { path: 'features', element: <FeaturesListPage /> },
      { path: 'features/new', element: <NewFeaturePage /> },
      {
        path: 'features/:featureId',
        element: <FeatureWorkspaceLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <FeatureOverviewPage /> },
          { path: 'prd', element: <FeaturePrdPage /> },
          { path: 'requirements', element: <RequirementsPage /> },
          { path: 'tracking-plan', element: <TrackingPlanPage /> },
          { path: 'validation', element: <ValidationPage /> },
          { path: 'review', element: <ReviewPage /> },
        ],
      },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'catalog/events/:eventId', element: <CatalogEventPage /> },
      { path: 'catalog/properties', element: <CatalogPropertiesPage /> },
      { path: 'catalog/releases/:releaseId', element: <CatalogReleasePage /> },
      { path: 'events/new', element: <NewEventPage /> },
    ],
  },
])
