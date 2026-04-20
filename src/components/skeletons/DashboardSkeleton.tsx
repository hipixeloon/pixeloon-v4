import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-6 animate-fade-in">
      {/* Stats Skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ios-card p-4 min-h-[80px] flex flex-col items-center justify-center gap-2">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* Title */}
      <div className="px-1">
        <Skeleton className="h-6 w-36" />
      </div>

      {/* Campaign Cards Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <CampaignCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function CampaignCardSkeleton() {
  return (
    <div className="ios-card p-4 min-h-[88px] flex items-center justify-between">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-6 w-6 rounded" />
    </div>
  );
}
