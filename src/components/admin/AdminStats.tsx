import { 
  Users, Video, Calendar, Facebook, TrendingUp, TrendingDown, 
  Clock, CheckCircle, XCircle, Inbox 
} from 'lucide-react';
import { SystemStats } from '@/hooks/useAdminPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface AdminStatsProps {
  stats: SystemStats | null;
  loading: boolean;
}

export function AdminStats({ stats, loading }: AdminStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="h-3 sm:h-4 bg-muted rounded w-16 sm:w-20" />
              <div className="h-6 sm:h-8 bg-muted rounded w-12 sm:w-16 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardDescription className="flex items-center gap-1 text-xs sm:text-sm">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">Total Users</span>
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{formatNumber(stats.totalUsers)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardDescription className="flex items-center gap-1 text-xs sm:text-sm">
              <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">Campaigns</span>
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{formatNumber(stats.totalCampaigns)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardDescription className="flex items-center gap-1 text-xs sm:text-sm">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">Total Posts</span>
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{formatNumber(stats.totalPosts)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardDescription className="flex items-center gap-1 text-xs sm:text-sm">
              <Facebook className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">FB Pages</span>
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{formatNumber(stats.totalPages)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Post Status & Success Rate */}
      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="flex items-center justify-between">
              <span className="text-3xl sm:text-4xl font-bold">{stats.successRate}%</span>
              {stats.successRate >= 90 ? (
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
              ) : stats.successRate >= 70 ? (
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
              ) : (
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
              )}
            </div>
            <Progress value={stats.successRate} className="h-2" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {formatNumber(stats.postedPosts)} successful / {formatNumber(stats.postedPosts + stats.failedPosts)} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Post Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
              <div className="space-y-1 p-2 rounded-lg bg-yellow-500/10">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 mx-auto text-yellow-500" />
                <p className="text-lg sm:text-2xl font-bold">{formatNumber(stats.pendingPosts)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="space-y-1 p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mx-auto text-green-500" />
                <p className="text-lg sm:text-2xl font-bold">{formatNumber(stats.postedPosts)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Posted</p>
              </div>
              <div className="space-y-1 p-2 rounded-lg bg-red-500/10">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 mx-auto text-destructive" />
                <p className="text-lg sm:text-2xl font-bold">{formatNumber(stats.failedPosts)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Alert */}
      {stats.pendingRequests > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 p-3 sm:py-4">
            <Inbox className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm sm:text-base">{stats.pendingRequests} pending request{stats.pendingRequests > 1 ? 's' : ''}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Review in Access Requests tab</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
