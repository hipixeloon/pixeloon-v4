import { useState, useEffect, useMemo, useCallback } from 'react';
import { Activity, CheckCircle2, XCircle, Clock, RefreshCw, Zap, Play, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { ExecutionsSkeleton } from '@/components/skeletons/ExecutionsSkeleton';
import { toast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ITEMS_PER_PAGE = 10;

interface CronExecution {
  id: number;
  status_code: number;
  created: string;
  timed_out: boolean;
}

interface CronJob {
  jobname: string;
  schedule: string;
  active: boolean;
}

export default function Executions() {
  const [executions, setExecutions] = useState<CronExecution[]>([]);
  const [cronJob, setCronJob] = useState<CronJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchCronHealth = async () => {
    try {
      // Fetch recent cron executions
      const { data: execData, error: execError } = await supabase
        .rpc('get_cron_executions' as never);
      
      if (!execError && execData) {
        setExecutions(execData as CronExecution[]);
      }

      // Fetch cron job status
      const { data: jobData, error: jobError } = await supabase
        .rpc('get_cron_job_status' as never);
      
      if (!jobError && jobData && (jobData as CronJob[]).length > 0) {
        setCronJob((jobData as CronJob[])[0]);
      }
    } catch (err) {
      console.error('Error fetching cron health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCronHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCronHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCronHealth();
    setRefreshing(false);
  }, []);

  const handlePullRefresh = useCallback(async () => {
    await fetchCronHealth();
  }, []);

  const handleTriggerManually = async () => {
    setTriggering(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/auto-poster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else if (result.processed > 0) {
        toast({ title: 'Posts processed!', description: `${result.processed} post(s) were processed.` });
      } else {
        toast({ title: 'No pending posts', description: 'All posts are up to date.' });
      }

      // Refresh execution history
      await fetchCronHealth();
    } catch (err) {
      console.error('Error triggering auto-poster:', err);
      toast({ title: 'Failed to trigger', variant: 'destructive' });
    } finally {
      setTriggering(false);
    }
  };

  // Calculate health stats
  const recentExecutions = executions.slice(0, 20);
  const successCount = recentExecutions.filter(e => e.status_code === 200).length;
  const failCount = recentExecutions.filter(e => e.status_code !== 200 || e.timed_out).length;
  const healthPercent = recentExecutions.length > 0 ? Math.round((successCount / recentExecutions.length) * 100) : 100;
  
  // Pagination
  const totalPages = Math.ceil(executions.length / ITEMS_PER_PAGE);
  const paginatedExecutions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return executions.slice(start, start + ITEMS_PER_PAGE);
  }, [executions, currentPage]);
  
  const getHealthColor = () => {
    if (healthPercent >= 90) return 'text-green-500';
    if (healthPercent >= 70) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getHealthBg = () => {
    if (healthPercent >= 90) return 'bg-green-500/10';
    if (healthPercent >= 70) return 'bg-yellow-500/10';
    return 'bg-destructive/10';
  };

  if (loading) {
    return (
      <AppLayout title="Executions">
        <ExecutionsSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Cron Executions"
      rightAction={
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="w-11 h-11">
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      }
    >
      <PullToRefresh onRefresh={handlePullRefresh}>
        <div className="p-4 space-y-6">
        {/* Health Summary */}
        <div className={`ios-card p-6 ${getHealthBg()}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getHealthBg()} border-4 ${healthPercent >= 90 ? 'border-green-500' : healthPercent >= 70 ? 'border-yellow-500' : 'border-destructive'}`}>
                <Activity className={`w-8 h-8 ${getHealthColor()}`} />
              </div>
              <div>
                <p className={`text-4xl font-bold ${getHealthColor()}`}>{healthPercent}%</p>
                <p className="text-ios-subhead text-muted-foreground">Health Score</p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center justify-end gap-2 text-green-500">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-ios-headline font-semibold">{successCount}</span>
                <span className="text-ios-caption text-muted-foreground">success</span>
              </div>
              {failCount > 0 && (
                <div className="flex items-center justify-end gap-2 text-destructive">
                  <XCircle className="w-5 h-5" />
                  <span className="text-ios-headline font-semibold">{failCount}</span>
                  <span className="text-ios-caption text-muted-foreground">failed</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cron Job Status */}
        {cronJob && (
          <div className="ios-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-ios-headline text-foreground font-semibold">{cronJob.jobname}</p>
                  <p className="text-ios-caption text-muted-foreground">Schedule: {cronJob.schedule} (every minute)</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${cronJob.active ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'}`}>
                {cronJob.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        )}

        {/* Manual Trigger */}
        <div className="ios-card p-4">
          <button
            onClick={handleTriggerManually}
            disabled={triggering}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors min-h-[64px]"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-primary" />
              <div className="text-left">
                <p className="text-ios-body text-foreground font-medium">Trigger Manually</p>
                <p className="text-ios-footnote text-muted-foreground">Process all pending posts now</p>
              </div>
            </div>
            {triggering ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : (
              <Play className="w-6 h-6 text-primary" />
            )}
          </button>
        </div>

        {/* Execution History */}
        <section className="space-y-3">
          <h2 className="text-ios-title3 text-foreground px-1">Execution History</h2>
          
          {/* Visual Bar Chart */}
          <div className="ios-card p-4">
            <p className="text-ios-caption text-muted-foreground mb-3">Last 20 executions</p>
            <div className="flex gap-1 h-12">
              {recentExecutions.map((exec) => (
                <div
                  key={exec.id}
                  className={`flex-1 rounded transition-all hover:opacity-80 cursor-pointer ${
                    exec.status_code === 200 && !exec.timed_out 
                      ? 'bg-green-500' 
                      : 'bg-destructive'
                  }`}
                  title={`${new Date(exec.created).toLocaleString()} - ${exec.status_code === 200 && !exec.timed_out ? 'Success' : 'Failed'}`}
                />
              ))}
              {recentExecutions.length === 0 && (
                <p className="text-ios-caption text-muted-foreground">No executions yet</p>
              )}
            </div>
          </div>

          {/* Detailed List with Pagination */}
          <div className="ios-card divide-y divide-border">
            {paginatedExecutions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No execution history</p>
              </div>
            ) : (
              paginatedExecutions.map((exec) => (
                <div key={exec.id} className="p-4 flex items-center justify-between min-h-[64px]">
                  <div className="flex items-center gap-3">
                    {exec.status_code === 200 && !exec.timed_out ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-destructive" />
                    )}
                    <div>
                      <p className="text-ios-body text-foreground">
                        {new Date(exec.created).toLocaleString()}
                      </p>
                      <p className="text-ios-footnote text-muted-foreground">
                        ID: {exec.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      exec.status_code === 200 
                        ? 'bg-green-500/20 text-green-500' 
                        : 'bg-destructive/20 text-destructive'
                    }`}>
                      {exec.status_code}
                    </span>
                    {exec.timed_out && (
                      <p className="text-ios-footnote text-destructive mt-1">Timed out</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="text-ios-body text-muted-foreground min-w-[60px] text-center">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </section>
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
