import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Loader2, Video, Calendar, Facebook, ChevronLeft, ChevronRight, ExternalLink, Clock, CheckCircle, XCircle, AlertCircle, Play, X } from 'lucide-react';
import { UserProfile } from '@/hooks/useAdminUsers';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface UserActivityDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Campaign {
  id: string;
  title: string;
  status: string;
  created_at: string;
  posts_count: number;
}

interface FacebookPage {
  id: string;
  page_name: string;
  page_id: string;
  created_at: string;
}

interface ScheduledPost {
  id: string;
  status: string;
  scheduled_time: string;
  actual_post_time: string | null;
  video_url: string;
  campaign_id: string;
  caption: string | null;
  permalink_url: string | null;
  error_message: string | null;
  platform: string | null;
  campaign?: {
    title: string;
  };
}

const POSTS_PER_PAGE = 20;

export function UserActivityDialog({ user, open, onOpenChange }: UserActivityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [postsLoading, setPostsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [campaignIds, setCampaignIds] = useState<string[]>([]);

  useEffect(() => {
    if (user && open) {
      setCurrentPage(1);
      setStatusFilter('all');
      setSelectedPost(null);
      fetchUserActivity();
    }
  }, [user, open]);

  useEffect(() => {
    if (campaignIds.length > 0 && open) {
      fetchPosts();
    }
  }, [currentPage, statusFilter, campaignIds]);

  const fetchUserActivity = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch campaigns
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('id, title, status, created_at, posts_count')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      setCampaigns(campaignsData || []);

      // Fetch Facebook pages
      const { data: pagesData } = await supabase
        .from('facebook_pages')
        .select('id, page_name, page_id, created_at')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      setPages(pagesData || []);

      // Store campaign IDs for posts fetching
      if (campaignsData && campaignsData.length > 0) {
        const ids = campaignsData.map((c) => c.id);
        setCampaignIds(ids);
        
        // Get total posts count
        const { count } = await supabase
          .from('scheduled_posts')
          .select('*', { count: 'exact', head: true })
          .in('campaign_id', ids);
        
        setTotalPosts(count || 0);
      } else {
        setCampaignIds([]);
        setPosts([]);
        setTotalPosts(0);
      }
    } catch (err) {
      console.error('Error fetching user activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = useCallback(async () => {
    if (campaignIds.length === 0) return;

    setPostsLoading(true);
    try {
      const from = (currentPage - 1) * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      let query = supabase
        .from('scheduled_posts')
        .select(`
          id, status, scheduled_time, actual_post_time, video_url, 
          campaign_id, caption, permalink_url, error_message, platform,
          campaign:campaigns(title)
        `, { count: 'exact' })
        .in('campaign_id', campaignIds)
        .order('scheduled_time', { ascending: false })
        .range(from, to);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      setPosts(data as ScheduledPost[] || []);
      if (count !== null) {
        setTotalPosts(count);
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setPostsLoading(false);
    }
  }, [campaignIds, currentPage, statusFilter]);

  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
      case 'posted':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'draft':
        return 'bg-secondary text-secondary-foreground';
      case 'failed':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'posted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPlatformBadgeClass = (platform: string | null) => {
    switch (platform) {
      case 'facebook':
        return 'text-blue-600 border-blue-300';
      case 'instagram':
        return 'text-pink-600 border-pink-300';
      case 'youtube':
        return 'text-red-600 border-red-300';
      default:
        return '';
    }
  };

  const extractVideoName = (url: string) => {
    try {
      const parts = url.split('/');
      const fileName = parts[parts.length - 1] || parts[parts.length - 2];
      return decodeURIComponent(fileName).substring(0, 30) + (fileName.length > 30 ? '...' : '');
    } catch {
      return 'Video';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-3 shrink-0">
          <DialogTitle className="text-base sm:text-lg">User Activity</DialogTitle>
          <DialogDescription className="flex flex-col sm:flex-row sm:items-center gap-1 text-xs sm:text-sm">
            <span className="font-medium truncate">{user?.full_name || 'User'}</span>
            <span className="hidden sm:inline text-muted-foreground">·</span>
            <span className="truncate text-muted-foreground">{user?.email}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="posts" className="flex-1 flex flex-col min-h-0 px-4 pb-4 sm:px-6 sm:pb-6">
            <TabsList className="grid w-full grid-cols-3 h-auto shrink-0">
              <TabsTrigger value="posts" className="gap-1 text-xs sm:text-sm py-2 px-1 sm:px-3">
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="hidden xs:inline">Posts</span>
                <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">
                  {totalPosts.toLocaleString()}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-1 text-xs sm:text-sm py-2 px-1 sm:px-3">
                <Video className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="hidden xs:inline">Campaigns</span>
                <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">
                  {campaigns.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pages" className="gap-1 text-xs sm:text-sm py-2 px-1 sm:px-3">
                <Facebook className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="hidden xs:inline">Pages</span>
                <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">
                  {pages.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="flex-1 flex flex-col min-h-0 mt-3 data-[state=inactive]:hidden">
              {/* Filters and Pagination Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 shrink-0">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs sm:text-sm">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                {totalPages > 1 && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-muted-foreground">
                      {currentPage}/{totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || postsLoading}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || postsLoading}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Posts List - Scrollable */}
              <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4 sm:-mx-6 sm:px-6">
                {postsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                        <Skeleton className="h-10 w-10 rounded shrink-0" />
                        <div className="flex-1 space-y-2 min-w-0">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-6 w-16 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : posts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No scheduled posts found</p>
                    {statusFilter !== 'all' && (
                      <Button variant="link" onClick={() => setStatusFilter('all')} className="mt-2">
                        Clear filter
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50 ${
                          selectedPost?.id === post.id ? 'bg-accent border-primary/50' : ''
                        }`}
                        onClick={() => setSelectedPost(selectedPost?.id === post.id ? null : post)}
                      >
                        <div className="flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded bg-muted shrink-0">
                          <Play className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <span className="font-medium text-xs sm:text-sm truncate">
                              {extractVideoName(post.video_url)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                            {getStatusIcon(post.status)}
                            <span className="truncate">{format(new Date(post.scheduled_time), 'MMM d, h:mm a')}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] sm:text-xs shrink-0 ${getStatusBadgeClass(post.status)}`}>
                          {post.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Post Preview Panel */}
              {selectedPost && (
                <div className="mt-3 p-3 sm:p-4 rounded-lg border bg-muted/30 space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Post Details</h4>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPost(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="mt-1">
                        <Badge variant="outline" className={getStatusBadgeClass(selectedPost.status)}>
                          {selectedPost.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Platform:</span>
                      <div className="mt-1">
                        <Badge variant="outline" className={getPlatformBadgeClass(selectedPost.platform)}>
                          {selectedPost.platform || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Scheduled:</span>
                      <div className="mt-1 font-mono text-[10px] sm:text-xs">
                        {format(new Date(selectedPost.scheduled_time), 'PPpp')}
                      </div>
                    </div>
                  </div>

                  {selectedPost.caption && (
                    <div>
                      <span className="text-muted-foreground text-xs sm:text-sm">Caption:</span>
                      <p className="mt-1 text-xs sm:text-sm bg-background p-2 rounded border max-h-20 overflow-y-auto">
                        {selectedPost.caption}
                      </p>
                    </div>
                  )}

                  {selectedPost.error_message && (
                    <div>
                      <span className="text-red-600 text-xs sm:text-sm">Error:</span>
                      <p className="mt-1 text-xs sm:text-sm text-red-600 bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900">
                        {selectedPost.error_message}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {selectedPost.video_url && (
                      <Button variant="outline" size="sm" className="text-xs h-7" asChild>
                        <a href={selectedPost.video_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Video
                        </a>
                      </Button>
                    )}
                    {selectedPost.permalink_url && (
                      <Button variant="outline" size="sm" className="text-xs h-7" asChild>
                        <a href={selectedPost.permalink_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Post
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t mt-3 gap-2 shrink-0">
                  <span className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                    {((currentPage - 1) * POSTS_PER_PAGE) + 1} - {Math.min(currentPage * POSTS_PER_PAGE, totalPosts)} of {totalPosts.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1 || postsLoading}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || postsLoading}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || postsLoading}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || postsLoading}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="campaigns" className="flex-1 min-h-0 mt-3 overflow-y-auto data-[state=inactive]:hidden">
              {campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Video className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No campaigns found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex items-center justify-between p-2 sm:p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded bg-primary/10 shrink-0">
                          <Video className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{campaign.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {campaign.posts_count || 0} posts
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-[10px] sm:text-xs ${getStatusBadgeClass(campaign.status || 'draft')}`}>
                          {campaign.status || 'draft'}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pages" className="flex-1 min-h-0 mt-3 overflow-y-auto data-[state=inactive]:hidden">
              {pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Facebook className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No Facebook pages connected</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pages.map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center justify-between p-2 sm:p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded bg-blue-500/10 shrink-0">
                          <Facebook className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{page.page_name}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            {page.page_id}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                        {format(new Date(page.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
