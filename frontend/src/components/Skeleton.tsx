interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:1000px_100%] rounded ${className}`}
    />
  );
}

export function EventListSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>

      {[...Array(5)].map((_, i) => (
        <div key={i} className="border border-border rounded-lg overflow-hidden">
          <div className="p-4 bg-muted/30">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-64" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-6">
      <div className="space-y-3 mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="space-y-2">
        {/* Header */}
        <div className="flex gap-4 p-4 bg-muted/30 rounded-lg">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6" />
        </div>

        {/* Rows */}
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border border-border rounded-lg">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChangelogSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="space-y-3 mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />

          <div className="grid grid-cols-2 gap-4 mt-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
