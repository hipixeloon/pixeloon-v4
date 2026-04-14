import { Skeleton } from '@/components/ui/skeleton';

export function SettingsSkeleton() {
  return (
    <div className="p-4 space-y-6 animate-fade-in">
      {/* Appearance Section */}
      <section className="space-y-3">
        <Skeleton className="h-4 w-24 mx-1" />
        <div className="ios-section">
          <div className="ios-list-item">
            <div className="flex items-center gap-3">
              <Skeleton className="w-5 h-5" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="w-12 h-7 rounded-full" />
          </div>
        </div>
      </section>

      {/* API Keys Section */}
      <section className="space-y-3">
        <Skeleton className="h-4 w-20 mx-1" />
        <div className="ios-section p-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-4 w-full max-w-xs" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="flex gap-3">
              <Skeleton className="h-11 w-24 rounded-xl" />
              <Skeleton className="h-11 w-20 rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Connections Section */}
      <section className="space-y-3">
        <Skeleton className="h-4 w-24 mx-1" />
        <div className="ios-section">
          <div className="ios-list-item">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-11 h-11 rounded-xl" />
              <Skeleton className="h-11 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Preferences Section */}
      <section className="space-y-3">
        <Skeleton className="h-4 w-24 mx-1" />
        <div className="ios-section">
          {[1, 2].map((i) => (
            <div key={i} className="ios-list-item">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="w-11 h-6 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="space-y-3">
        <Skeleton className="h-4 w-16 mx-1" />
        <div className="ios-section">
          {[1, 2].map((i) => (
            <div key={i} className="ios-list-item">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </section>

      {/* Logout Button */}
      <div className="pt-4">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
