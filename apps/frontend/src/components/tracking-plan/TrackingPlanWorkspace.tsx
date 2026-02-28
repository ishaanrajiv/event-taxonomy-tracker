import { useEffect, useState } from 'react';
import axios from 'axios';
import type { TrackingPlan, StatusTransition } from '../../types/api';
import PrdPanel from './PrdPanel';
import PlanEventList from './PlanEventList';
import { Skeleton } from '../Skeleton';

interface TrackingPlanWorkspaceProps {
  planId: number;
  apiBase: string;
  currentUser: string;
  onBack: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const STATUS_BADGES: Record<TrackingPlan['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  in_review: { label: 'In Review', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

export default function TrackingPlanWorkspace({
  planId,
  apiBase,
  currentUser,
  onBack,
  onSuccess,
  onError,
}: TrackingPlanWorkspaceProps) {
  const [plan, setPlan] = useState<TrackingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<TrackingPlan>(`${apiBase}/tracking-plans/${planId}`);
      setPlan(data);
      setEditedTitle(data.title);
    } catch (error) {
      console.error('Failed to fetch tracking plan:', error);
      onError('Failed to load tracking plan');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTitle = async () => {
    if (!plan || editedTitle.trim() === plan.title) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const { data } = await axios.put<TrackingPlan>(`${apiBase}/tracking-plans/${planId}`, {
        title: editedTitle.trim(),
      });
      setPlan(data);
      setIsEditingTitle(false);
      onSuccess('Title updated');
    } catch (error) {
      console.error('Failed to update title:', error);
      onError('Failed to update title');
    }
  };

  const handleUpdatePrd = async (prdContent: string) => {
    try {
      const { data } = await axios.put<TrackingPlan>(`${apiBase}/tracking-plans/${planId}`, {
        prd_content: prdContent,
      });
      setPlan(data);
      onSuccess('PRD updated');
    } catch (error) {
      console.error('Failed to update PRD:', error);
      onError('Failed to update PRD');
    }
  };

  const handleStatusTransition = async (status: TrackingPlan['status']) => {
    try {
      const transition: StatusTransition = {
        status,
        changed_by: currentUser,
      };
      const { data } = await axios.post<TrackingPlan>(
        `${apiBase}/tracking-plans/${planId}/status`,
        transition,
      );
      setPlan(data);
      onSuccess(`Status changed to ${STATUS_BADGES[status].label}`);

      // Refresh to get updated events (in case of publish)
      if (status === 'approved') {
        fetchPlan();
      }
    } catch (error: any) {
      console.error('Failed to transition status:', error);
      onError(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDeletePlan = async () => {
    if (!window.confirm('Are you sure you want to delete this tracking plan?')) {
      return;
    }

    try {
      await axios.delete(`${apiBase}/tracking-plans/${planId}`);
      onSuccess('Tracking plan deleted');
      onBack();
    } catch (error: any) {
      console.error('Failed to delete plan:', error);
      onError(error.response?.data?.detail || 'Failed to delete plan');
    }
  };

  if (loading || !plan) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const canEdit = plan.status === 'draft' || plan.status === 'in_review';
  const statusBadge = STATUS_BADGES[plan.status];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Plans
          </button>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-medium rounded ${statusBadge.className}`}>
              {statusBadge.label}
            </span>

            {/* Status Actions Dropdown */}
            <div className="relative group">
              <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M12 12v.01M12 18v.01" />
                </svg>
              </button>

              <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                {plan.status === 'draft' && (
                  <>
                    <button
                      onClick={() => handleStatusTransition('in_review')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
                    >
                      Submit for Review
                    </button>
                    <button
                      onClick={handleDeletePlan}
                      className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted transition-colors"
                    >
                      Delete Plan
                    </button>
                  </>
                )}
                {plan.status === 'in_review' && (
                  <>
                    <button
                      onClick={() => handleStatusTransition('approved')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
                    >
                      Approve & Publish
                    </button>
                    <button
                      onClick={() => handleStatusTransition('draft')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
                    >
                      Return to Draft
                    </button>
                  </>
                )}
                {plan.status === 'approved' && (
                  <button
                    onClick={() => handleStatusTransition('archived')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
                  >
                    Archive Plan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleUpdateTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateTitle();
                if (e.key === 'Escape') {
                  setEditedTitle(plan.title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="flex-1 text-2xl font-semibold bg-transparent border-b border-primary focus:outline-none"
            />
          </div>
        ) : (
          <h1
            onClick={() => canEdit && setIsEditingTitle(true)}
            className={`text-2xl font-semibold text-foreground ${canEdit ? 'cursor-pointer hover:text-primary' : ''}`}
          >
            {plan.title}
          </h1>
        )}

        {plan.description && (
          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <PrdPanel
          prdContent={plan.prd_content || ''}
          onUpdate={handleUpdatePrd}
          disabled={!canEdit}
        />

        <PlanEventList
          planId={planId}
          events={plan.events}
          apiBase={apiBase}
          currentUser={currentUser}
          disabled={!canEdit}
          onRefresh={fetchPlan}
          onSuccess={onSuccess}
          onError={onError}
        />
      </div>
    </div>
  );
}
