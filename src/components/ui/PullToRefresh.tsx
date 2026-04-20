import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const {
    containerRef,
    pullDistance,
    isRefreshing,
    progress,
    shouldTrigger,
  } = usePullToRefresh({ onRefresh });

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-auto h-full', className)}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-10 transition-opacity"
        style={{
          top: Math.max(pullDistance - 40, -40),
          opacity: progress,
        }}
      >
        <div
          className={cn(
            'w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center transition-all',
            shouldTrigger && 'bg-primary/10 border-primary/30',
            isRefreshing && 'bg-primary/10 border-primary/30'
          )}
        >
          <RefreshCw
            className={cn(
              'w-5 h-5 text-muted-foreground transition-all',
              shouldTrigger && 'text-primary',
              isRefreshing && 'text-primary animate-spin'
            )}
            style={{
              transform: isRefreshing ? undefined : `rotate(${progress * 180}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? 'transform 0.3s ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
