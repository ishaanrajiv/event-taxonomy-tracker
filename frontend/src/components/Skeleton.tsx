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
    <div className="p-5 space-y-2">
      <div className="flex justify-between items-center mb-5">
        <div>
          <Skeleton className="h-5 w-24 mb-1.5" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {[...Array(5)].map((_, i) => (
        <div key={i} className="border border-border/40 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <Skeleton className="h-3 w-64 mt-1.5" />
            </div>
            <Skeleton className="h-5 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-5">
      <div className="mb-5">
        <Skeleton className="h-5 w-32 mb-1.5" />
        <Skeleton className="h-3 w-48" />
      </div>

      <div className="border border-border/40 rounded-lg overflow-hidden">
        <div className="flex gap-4 p-3 bg-muted/40">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/6" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/6" />
          <Skeleton className="h-3 w-1/6" />
        </div>
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex gap-4 p-3 border-t border-border/30">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-1/6" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/6" />
            <Skeleton className="h-3 w-1/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChangelogSkeleton() {
  return (
    <div className="p-5 space-y-1.5">
      <div className="mb-5">
        <Skeleton className="h-5 w-24 mb-1.5" />
        <Skeleton className="h-3 w-56" />
      </div>

      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-border/40 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-3 w-32" />
            <div className="flex-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
