import { useMemo } from 'react';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, CheckCircle2, XCircle, Clock, Film, Video } from 'lucide-react';

interface ScheduledPost {
  id: string;
  scheduled_time: string;
  actual_post_time: string | null;
  status: string;
  post_type: string | null;
}

interface CampaignStatsProps {
  posts: ScheduledPost[];
}

export function CampaignStats({ posts }: CampaignStatsProps) {
  // Calculate stats
  const stats = useMemo(() => {
    const total = posts.length;
    const posted = posts.filter(p => p.status === 'posted').length;
    const pending = posts.filter(p => p.status === 'pending' || p.status === 'processing').length;
    const failed = posts.filter(p => p.status === 'failed' || p.status === 'rejected').length;
    
    const reels = posts.filter(p => p.post_type === 'reel').length;
    const videos = posts.filter(p => p.post_type === 'video').length;
    
    const successRate = posted > 0 ? Math.round((posted / (posted + failed)) * 100) : 0;
    
    return { total, posted, pending, failed, reels, videos, successRate };
  }, [posts]);

  // Posts per day chart data (last 14 days)
  const postsPerDayData = useMemo(() => {
    const today = new Date();
    const twoWeeksAgo = subDays(today, 13);
    const days = eachDayOfInterval({ start: twoWeeksAgo, end: today });
    
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayPosts = posts.filter(p => {
        const postDate = startOfDay(new Date(p.actual_post_time || p.scheduled_time));
        return postDate.getTime() === dayStart.getTime();
      });
      
      return {
        date: format(day, 'MMM d'),
        posted: dayPosts.filter(p => p.status === 'posted').length,
        pending: dayPosts.filter(p => p.status === 'pending' || p.status === 'processing').length,
        failed: dayPosts.filter(p => p.status === 'failed' || p.status === 'rejected').length,
      };
    });
  }, [posts]);

  // Post type distribution
  const postTypeData = useMemo(() => {
    const data = [];
    if (stats.reels > 0) {
      data.push({ name: 'Reels', value: stats.reels, color: 'hsl(var(--primary))' });
    }
    if (stats.videos > 0) {
      data.push({ name: 'Videos', value: stats.videos, color: 'hsl(var(--muted-foreground))' });
    }
    return data;
  }, [stats]);

  // Status distribution
  const statusData = useMemo(() => [
    { name: 'Posted', value: stats.posted, color: '#22c55e' },
    { name: 'Pending', value: stats.pending, color: '#eab308' },
    { name: 'Failed', value: stats.failed, color: '#ef4444' },
  ].filter(d => d.value > 0), [stats]);

  return (
    <div className="space-y-4">
      {/* Success Rate Card */}
      <div className="ios-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Success Rate
          </h3>
          <span className={`text-2xl font-bold ${
            stats.successRate >= 90 ? 'text-green-500' : 
            stats.successRate >= 70 ? 'text-yellow-500' : 'text-destructive'
          }`}>
            {stats.successRate}%
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${
              stats.successRate >= 90 ? 'bg-green-500' : 
              stats.successRate >= 70 ? 'bg-yellow-500' : 'bg-destructive'
            }`}
            style={{ width: `${stats.successRate}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            {stats.posted} posted
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-destructive" />
            {stats.failed} failed
          </span>
        </div>
      </div>

      {/* Posts per Day Chart */}
      <div className="ios-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Posts per Day (Last 14 Days)</h3>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={postsPerDayData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="posted" stackId="a" fill="#22c55e" radius={[2, 2, 0, 0]} />
              <Bar dataKey="pending" stackId="a" fill="#eab308" radius={[0, 0, 0, 0]} />
              <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Post Type & Status Distribution */}
      <div className="grid grid-cols-2 gap-2">
        {/* Post Type */}
        <div className="ios-card p-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Post Type</h3>
          {postTypeData.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="h-16 w-16">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={postTypeData}
                      dataKey="value"
                      innerRadius={15}
                      outerRadius={28}
                      paddingAngle={2}
                    >
                      {postTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1">
                {stats.reels > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <Film className="w-3 h-3 text-primary" />
                    <span>{stats.reels} Reels</span>
                  </div>
                )}
                {stats.videos > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <Video className="w-3 h-3 text-muted-foreground" />
                    <span>{stats.videos} Videos</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No posts yet</p>
          )}
        </div>

        {/* Status */}
        <div className="ios-card p-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Status</h3>
          <div className="h-16 w-16 mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  innerRadius={15}
                  outerRadius={28}
                  paddingAngle={2}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
