import { Skeleton } from '@/components/ui/skeleton';

export function ExecutionsSkeleton() {
  return (
    <div className="p-4 space-y-6 animate-fade-in">
      {/* Health Summary Skeleton */}
      <div className="ios-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-5 w-24 ml-auto" />
            <Skeleton className="h-5 w-20 ml-auto" />
          </div>
        </div>
      </div>

      {/* Cron Job Status Skeleton */}
      <div className="ios-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>

      {/* Manual Trigger Skeleton */}
      <div className="ios-card p-4">
        <div className="p-4 rounded-xl bg-muted/50 flex items-center justify-between min-h-[64px]">
          <div className="flex items-center gap-3">
            <Skeleton className="w-6 h-6" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="w-6 h-6" />
        </div>
      </div>

      {/* Execution History Skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-36 mx-1" />
        
        {/* Bar Chart Skeleton */}
        <div className="ios-card p-4">
          <Skeleton className="h-4 w-28 mb-3" />
          <div className="flex gap-1 h-12">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 h-full" />
            ))}
          </div>
        </div>

        {/* Execution List Skeleton */}
        <div className="ios-card divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between min-h-[64px]">
              <div className="flex items-center gap-3">
                <Skeleton className="w-6 h-6 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <Skeleton className="h-7 w-12 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
