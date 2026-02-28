import { useEffect, useState } from 'react';
import axios from 'axios';
import type { TrackingPlanSummary, TrackingPlanStatus } from '../../types/api';
import EmptyState from '../EmptyState';
import Skeleton from '../Skeleton';

interface TrackingPlanListProps {
  apiBase: string;
  onSelectPlan: (planId: number) => void;
  onRefresh?: () => void;
}

const STATUS_BADGES: Record<TrackingPlanStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  in_review: { label: 'In Review', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

export default function TrackingPlanList({ apiBase, onSelectPlan, onRefresh }: TrackingPlanListProps) {
  const [plans, setPlans] = useState<TrackingPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TrackingPlanStatus | 'all'>('all');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, [apiBase, statusFilter]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const { data } = await axios.get<TrackingPlanSummary[]>(`${apiBase}/tracking-plans`, { params });
      setPlans(data);
    } catch (error) {
      console.error('Failed to fetch tracking plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    try {
      setIsCreating(true);
      const { data } = await axios.post<TrackingPlanSummary>(`${apiBase}/tracking-plans`, {
        title: 'New Tracking Plan',
        description: null,
        prd_content: null,
        created_by: 'user@example.com',
      });
      onSelectPlan(data.id);
    } catch (error) {
      console.error('Failed to create tracking plan:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Tracking Plans</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage event specifications tied to PRDs and features
          </p>
        </div>
        <button
          onClick={handleCreatePlan}
          disabled={isCreating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Plan
        </button>
      </div>

      <div className="flex gap-2">
        {(['all', 'draft', 'in_review', 'approved', 'archived'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {status === 'all' ? 'All' : STATUS_BADGES[status].label}
          </button>
        ))}
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title="No tracking plans"
          message="Create your first tracking plan to get started"
          icon={
            <svg className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          action={{ label: 'Create Plan', onClick: handleCreatePlan }}
        />
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => onSelectPlan(plan.id)}
              className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-border/80 hover:shadow-soft transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-base font-semibold text-foreground truncate">{plan.title}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_BADGES[plan.status].className}`}>
                      {STATUS_BADGES[plan.status].label}
                    </span>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{plan.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{plan.event_count} events</span>
                    <span>•</span>
                    <span>Created {formatDate(plan.created_at)}</span>
                    {plan.created_by && (
                      <>
                        <span>•</span>
                        <span>{plan.created_by}</span>
                      </>
                    )}
                  </div>
                </div>
                <svg className="h-5 w-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
