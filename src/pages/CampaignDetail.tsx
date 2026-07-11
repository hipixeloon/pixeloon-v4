import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, XCircle, RefreshCw, Trash2, Loader2, Play, Zap, ExternalLink, Folder, FileVideo, Video, Filter, Calendar, ChevronLeft, ChevronRight, Settings2, Check, X, Pause, PlayCircle, BarChart3, Film, Globe } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { IOSButton } from '@/components/ui/IOSButton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CampaignStats } from '@/components/campaign/CampaignStats';

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'America/Chicago', label: 'Chicago (CST)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
];

const SUPABASE_URL = 'https://jtsopnmudnvyqvlaptof.supabase.co';
const POSTS_PER_PAGE = 20;

interface ScheduledPost {
  id: string;
  video_url: string;
  caption: string | null;
  hashtags: string[] | null;
  scheduled_time: string;
  status: string;
  error_message: string | null;
  actual_post_time: string | null;
  needs_ai_caption: boolean | null;
  facebook_post_id: string | null;
  facebook_page_id: string | null;
  instagram_account_id: string | null;
  youtube_channel_id: string | null;
  platform: string | null;
  post_type: string | null;
  permalink_url: string | null;
  instagram_media_id?: string | null;
  youtube_video_id?: string | null;
}

interface InstagramAccount {
  id: string;
  instagram_username: string;
}

interface YouTubeChannel {
  id: string;
  channel_name: string;
}

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  video_links: string[] | null;
  drive_folder_id: string | null;
  drive_folder_name: string | null;
  created_at: string;
  caption_length: string | null;
  hashtag_count: number | null;
  template_type: string | null;
  custom_caption: string | null;
  youtube_upload_type: string | null;
  youtube_title_language: string | null;
  fallback_captions_enabled: boolean | null;
  fallback_captions: string[] | null;
  logo_opacity: number | null;
  branding_lines: Record<string, unknown> | null;
  affiliate_links: Record<string, unknown> | null;
  watermark_settings: Record<string, unknown> | null;
  video_order_mode?: string | null;
  start_video_index?: number | null;
  sequence_step?: number | null;
  avoid_same_time_video_collisions?: boolean | null;
}

type WatermarkMode = 'fixed' | 'random' | 'fullscreen';
type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
type FrequencyMode = 'every' | 'every_n';

interface EditableBrand {
  id: string;
  name: string;
  logoUrl: string;
  caption: string;
  enabled: boolean;
  frequency: FrequencyMode;
  interval: number;
}

const MAX_BRANDS = 5;

const clampBrandInterval = (value: number | undefined): number =>
  Math.max(2, Math.min(5, Math.floor(value || 3)));

interface FacebookPage {
  id: string;
  page_id: string;
  page_name: string;
}

interface PostTime {
  id: string;
  post_time: string;
  randomize: boolean;
  random_range_minutes: number;
}

interface FolderSyncResult {
  videoCount: number;
  foldersScanned: number;
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [postTimes, setPostTimes] = useState<PostTime[]>([]);
  const [facebookPages, setFacebookPages] = useState<Record<string, FacebookPage>>({});
  const [instagramAccounts, setInstagramAccounts] = useState<Record<string, InstagramAccount>>({});
  const [youtubeChannels, setYoutubeChannels] = useState<Record<string, YouTubeChannel>>({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [postingNow, setPostingNow] = useState<string | null>(null);
  const [triggeringAutoPoster, setTriggeringAutoPoster] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'posted' | 'failed'>('pending');
  const [folderSync, setFolderSync] = useState<FolderSyncResult | null>(null);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [isSyncingFolder, setIsSyncingFolder] = useState(false);
  
  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Bulk selection
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkRescheduling, setBulkRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  
  // Schedule editing
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [newPostTime, setNewPostTime] = useState('09:00');
  const [newRandomize, setNewRandomize] = useState(true);
  const [newRandomRange, setNewRandomRange] = useState(30);
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  // Caption settings editing
  const [showCaptionSettings, setShowCaptionSettings] = useState(false);
  const [useAIGeneration, setUseAIGeneration] = useState(true);
  const [manualTemplate, setManualTemplate] = useState('');
  const [captionLength, setCaptionLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [hashtagCount, setHashtagCount] = useState(8);
  const [youtubeUploadType, setYoutubeUploadType] = useState<'auto' | 'shorts' | 'long_form'>('auto');
  const [youtubeTitleLanguage, setYoutubeTitleLanguage] = useState<'english' | 'hinglish' | 'hindi'>('english');
  const [fallbackCaptionsEnabled, setFallbackCaptionsEnabled] = useState(false);
  const [fallbackCaptionsInput, setFallbackCaptionsInput] = useState('');
  const [logoOpacity, setLogoOpacity] = useState(80);
  const [watermarkMode, setWatermarkMode] = useState<WatermarkMode>('fixed');
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottom-right');
  const [watermarkWidthPercent, setWatermarkWidthPercent] = useState(18);
  const [watermarkHeightPercent, setWatermarkHeightPercent] = useState(18);
  const [savingCaptionSettings, setSavingCaptionSettings] = useState(false);

  // Branding lines / affiliate links / brand watermark editing
  const [brandingLinesEnabled, setBrandingLinesEnabled] = useState(false);
  const [brandingFrequency, setBrandingFrequency] = useState<FrequencyMode>('every');
  const [brandingInterval, setBrandingInterval] = useState(3);
  const [brandingText, setBrandingText] = useState('');
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [affiliateFrequency, setAffiliateFrequency] = useState<FrequencyMode>('every');
  const [affiliateInterval, setAffiliateInterval] = useState(3);
  const [affiliateLinksInput, setAffiliateLinksInput] = useState('');
  const [watermarkBrands, setWatermarkBrands] = useState<EditableBrand[]>([]);
  
  // Pause/Resume & Stats
  const [togglingPause, setTogglingPause] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [reschedulingAll, setReschedulingAll] = useState(false);
  
  // Timezone
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Asia/Kolkata';
    }
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const parsedFallbackCaptions = fallbackCaptionsInput
    .split(/\n+/)
    .map((caption) => caption.trim())
    .filter((caption) => caption.length > 0)
    .slice(0, 3);

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedPosts(new Set());
  }, [activeTab, dateFrom, dateTo]);

  const fetchCampaignData = useCallback(async () => {
    try {
      // Fetch campaign
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (campaignError) throw campaignError;
      if (!campaignData) {
        toast({ title: 'Campaign not found', variant: 'destructive' });
        navigate('/');
        return;
      }

      setCampaign(campaignData);
      
      // Sync caption settings from campaign
      setUseAIGeneration((campaignData.template_type || 'ai') !== 'manual');
      setManualTemplate(campaignData.custom_caption || '');
      setCaptionLength((campaignData.caption_length as 'short' | 'medium' | 'long') || 'medium');
      setHashtagCount(campaignData.hashtag_count || 8);
      setYoutubeUploadType((campaignData.youtube_upload_type as 'auto' | 'shorts' | 'long_form') || 'auto');
      setYoutubeTitleLanguage((campaignData.youtube_title_language as 'english' | 'hinglish' | 'hindi') || 'english');
      setFallbackCaptionsEnabled(campaignData.fallback_captions_enabled === true);
      setFallbackCaptionsInput(Array.isArray(campaignData.fallback_captions) ? campaignData.fallback_captions.join('\n') : '');
      setLogoOpacity(typeof campaignData.logo_opacity === 'number' ? campaignData.logo_opacity : 80);
      const watermarkSettings = (campaignData.watermark_settings || null) as {
        placement?: {
          mode?: WatermarkMode;
          position?: WatermarkPosition;
          widthPercent?: number;
          heightPercent?: number;
        };
      } | null;
      setWatermarkMode(watermarkSettings?.placement?.mode || 'fixed');
      setWatermarkPosition(watermarkSettings?.placement?.position || 'bottom-right');
      setWatermarkWidthPercent(
        typeof watermarkSettings?.placement?.widthPercent === 'number' ? watermarkSettings.placement.widthPercent : 18
      );
      setWatermarkHeightPercent(
        typeof watermarkSettings?.placement?.heightPercent === 'number' ? watermarkSettings.placement.heightPercent : 18
      );

      const brandingLines = (campaignData.branding_lines || null) as {
        enabled?: boolean; frequency?: string; interval?: number; text?: string;
      } | null;
      setBrandingLinesEnabled(brandingLines?.enabled === true);
      setBrandingFrequency(brandingLines?.frequency === 'every_n' ? 'every_n' : 'every');
      setBrandingInterval(clampBrandInterval(brandingLines?.interval));
      setBrandingText(brandingLines?.text || '');

      const affiliateLinks = (campaignData.affiliate_links || null) as {
        enabled?: boolean; frequency?: string; interval?: number; links?: string[];
      } | null;
      setAffiliateEnabled(affiliateLinks?.enabled === true);
      setAffiliateFrequency(affiliateLinks?.frequency === 'every_n' ? 'every_n' : 'every');
      setAffiliateInterval(clampBrandInterval(affiliateLinks?.interval));
      setAffiliateLinksInput(Array.isArray(affiliateLinks?.links) ? affiliateLinks.links.join('\n') : '');

      const storedBrands = (campaignData.watermark_settings as { brands?: Array<Record<string, unknown>> } | null)?.brands;
      setWatermarkBrands(
        (Array.isArray(storedBrands) ? storedBrands : []).slice(0, MAX_BRANDS).map((brand, index) => ({
          id: String(brand.id || `brand-${index}-${Date.now()}`),
          name: String(brand.name || ''),
          logoUrl: String(brand.logoUrl || ''),
          caption: String(brand.caption || ''),
          enabled: brand.enabled !== false,
          frequency: brand.frequency === 'every_n' ? 'every_n' : 'every',
          interval: clampBrandInterval(typeof brand.interval === 'number' ? brand.interval : undefined),
        }))
      );

      // Fetch post times
      const { data: timesData } = await supabase
        .from('campaign_post_times')
        .select('*')
        .eq('campaign_id', id)
        .order('post_time', { ascending: true });
      
      setPostTimes(timesData || []);

      // Fetch ALL scheduled posts with pagination
      let allPosts: ScheduledPost[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        const { data: postsData, error: postsError } = await supabase
          .from('scheduled_posts')
          .select('*')
          .eq('campaign_id', id)
          .order('scheduled_time', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (postsError) throw postsError;

        if (postsData && postsData.length > 0) {
          allPosts = [...allPosts, ...(postsData as ScheduledPost[])];
          offset += batchSize;
          hasMore = postsData.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setPosts(allPosts);

      // Fetch facebook pages for the user
      const { data: pagesData } = await supabase
        .from('facebook_pages')
        .select('id, page_id, page_name')
        .eq('user_id', user?.id);
      
      if (pagesData) {
        const pagesMap: Record<string, FacebookPage> = {};
        pagesData.forEach(page => {
          pagesMap[page.id] = page;
        });
        setFacebookPages(pagesMap);
      }

      // Fetch instagram accounts
      const { data: igData } = await supabase
        .from('instagram_accounts')
        .select('id, instagram_username')
        .eq('user_id', user?.id);
      
      if (igData) {
        const igMap: Record<string, InstagramAccount> = {};
        igData.forEach(acc => {
          igMap[acc.id] = acc;
        });
        setInstagramAccounts(igMap);
      }

      // Fetch youtube channels
      const { data: ytData } = await supabase
        .from('youtube_channels')
        .select('id, channel_name')
        .eq('user_id', user?.id);
      
      if (ytData) {
        const ytMap: Record<string, YouTubeChannel> = {};
        ytData.forEach(chan => {
          ytMap[chan.id] = chan;
        });
        setYoutubeChannels(ytMap);
      }
    } catch (err) {
      console.error('Error fetching campaign:', err);
      toast({ title: 'Error loading campaign', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, user?.id]);

  useEffect(() => {
    if (user && id) {
      fetchCampaignData();
    }
  }, [user, id, fetchCampaignData]);

  // Filter posts by date and status
  const filteredPosts = useMemo(() => {
    let filtered = posts;
    
    // Filter by status
    switch (activeTab) {
      case 'pending':
        filtered = filtered.filter(p => p.status === 'pending' || p.status === 'processing');
        break;
      case 'posted':
        filtered = filtered.filter(p => p.status === 'posted');
        break;
      case 'failed':
        filtered = filtered.filter(p => p.status === 'failed' || p.status === 'rejected');
        break;
    }
    
    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(p => new Date(p.scheduled_time) >= dateFrom);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(p => new Date(p.scheduled_time) <= endOfDay);
    }
    
    // Sort posted by actual post time descending
    if (activeTab === 'posted') {
      filtered.sort((a, b) => 
        new Date(b.actual_post_time || b.scheduled_time).getTime() - 
        new Date(a.actual_post_time || a.scheduled_time).getTime()
      );
    }
    
    return filtered;
  }, [posts, activeTab, dateFrom, dateTo]);

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const stats = {
    total: posts.length,
    pending: posts.filter(p => p.status === 'pending' || p.status === 'processing').length,
    posted: posts.filter(p => p.status === 'posted').length,
    failed: posts.filter(p => p.status === 'failed' || p.status === 'rejected').length,
  };

  // Sync folder videos
  const handleSyncFolder = async () => {
    if (!campaign?.drive_folder_id) return;
    
    setIsSyncingFolder(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/list-folder-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: campaign.drive_folder_id, recursive: true }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        toast({ title: 'Sync Failed', description: data.error, variant: 'destructive' });
        return;
      }

      setFolderSync({
        videoCount: data.totalCount,
        foldersScanned: data.foldersScanned,
      });

      toast({
        title: 'Folder Synced!',
        description: `Found ${data.totalCount} videos in ${data.foldersScanned} folder(s)`,
      });
    } catch (error) {
      console.error('Folder sync error:', error);
      toast({ title: 'Sync failed', variant: 'destructive' });
    } finally {
      setIsSyncingFolder(false);
    }
  };

  const updateWatermarkBrand = (brandId: string, patch: Partial<EditableBrand>) => {
    setWatermarkBrands((prev) => prev.map((b) => (b.id === brandId ? { ...b, ...patch } : b)));
  };

  // Schedule any videos in the campaign source that aren't scheduled yet.
  // The generate-schedule function skips already-scheduled videos, so this is
  // safe to run repeatedly (e.g. after adding new videos to the Drive folder).
  const handleGenerateSchedule = async () => {
    if (!campaign) return;

    setGeneratingSchedule(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          scheduleAllVideos: true,
          generateAI: (campaign.template_type || 'ai') !== 'manual',
          timezone,
          videoOrderMode: campaign.video_order_mode || 'sequential',
          startVideoIndex: Math.max(0, Math.floor(campaign.start_video_index || 0)),
          sequenceStep: Math.max(1, Math.floor(campaign.sequence_step || 1)),
          avoidSameTimeVideoCollisions: campaign.avoid_same_time_video_collisions !== false,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        toast({ title: 'Scheduling failed', description: result.error, variant: 'destructive' });
        return;
      }

      toast({
        title: result.postsCreated > 0 ? `${result.postsCreated} new posts scheduled` : 'Nothing new to schedule',
        description: result.message,
      });
      if (result.postsCreated > 0) {
        await fetchCampaignData();
      }
    } catch (err) {
      console.error('Error generating schedule:', err);
      toast({ title: 'Failed to generate schedule', variant: 'destructive' });
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!confirm('Delete this campaign and all scheduled posts?')) return;
    
    setDeleting(true);
    try {
      await supabase.from('scheduled_posts').delete().eq('campaign_id', id);
      await supabase.from('campaign_post_times').delete().eq('campaign_id', id);
      await supabase.from('campaign_pages').delete().eq('campaign_id', id);
      
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Campaign deleted' });
      navigate('/');
    } catch (err) {
      console.error('Error deleting campaign:', err);
      toast({ title: 'Failed to delete campaign', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleRetryPost = async (postId: string) => {
    try {
      // Conditional update: only a failed post can be requeued, so a retry can
      // never race a post that is currently publishing.
      const { data: requeued, error } = await supabase
        .from('scheduled_posts')
        .update({ status: 'pending', error_message: null, processing_started_at: null })
        .eq('id', postId)
        .eq('status', 'failed')
        .select('id');

      if (error) throw error;
      if (!requeued || requeued.length === 0) {
        toast({ title: 'Post is no longer in a failed state', description: 'Refresh to see its current status.' });
      } else {
        toast({ title: 'Post queued for retry', description: 'Platforms that already received this video will be skipped.' });
      }
      fetchCampaignData();
    } catch (err) {
      toast({ title: 'Failed to retry post', variant: 'destructive' });
    }
  };

  const handlePostNow = async (postId: string) => {
    setPostingNow(postId);
    try {
      // Atomic claim: only a pending post can move to processing. A double-click
      // or a second tab gets zero rows back and does nothing.
      const { data: claimed, error: claimError } = await supabase
        .from('scheduled_posts')
        .update({
          scheduled_time: new Date().toISOString(),
          status: 'processing',
          error_message: null,
          processing_started_at: null,
        })
        .eq('id', postId)
        .eq('status', 'pending')
        .select('id');

      if (claimError) throw claimError;
      if (!claimed || claimed.length === 0) {
        toast({ title: 'Post is already being processed', description: 'Refresh to see its current status.' });
        await fetchCampaignData();
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/auto-poster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, forcePublic: true }),
      });

      const result = await response.json();

      if (result.error) {
        toast({ title: 'Post failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Post published publicly!', description: 'Reel is now visible to everyone' });
      }

      await fetchCampaignData();
    } catch (err) {
      // IMPORTANT: never reset the post back to 'pending' here. The edge function
      // may still be uploading, and requeueing it would make the cron publish the
      // same video a second time. The auto-poster's stale-post recovery requeues
      // it automatically only if publishing never actually started.
      console.error('Error posting now:', err);
      toast({
        title: 'Could not confirm post status',
        description: 'The post may still be publishing. Its status will reconcile automatically within a few minutes.',
        variant: 'destructive',
      });
      await fetchCampaignData();
    } finally {
      setPostingNow(null);
    }
  };

  const handleTriggerAutoPoster = async () => {
    setTriggeringAutoPoster(true);
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
        toast({ title: `${result.processed} post(s) processed!` });
        // Refresh in the background so the button spinner doesn't look stuck on large campaigns
        void fetchCampaignData();
      } else {
        toast({ title: 'No pending posts' });
      }
    } catch (err) {
      console.error('Error triggering auto-poster:', err);
      toast({ title: 'Failed to trigger auto-poster', variant: 'destructive' });
    } finally {
      setTriggeringAutoPoster(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedPosts.size === 0) return;
    if (!confirm(`Delete ${selectedPosts.size} selected posts?`)) return;
    
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedPosts);
      
      // Delete in batches of 100
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await supabase.from('scheduled_posts').delete().in('id', batch);
      }
      
      toast({ title: `Deleted ${ids.length} posts` });
      setSelectedPosts(new Set());
      await fetchCampaignData();
    } catch (err) {
      console.error('Error bulk deleting:', err);
      toast({ title: 'Failed to delete posts', variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Bulk reschedule
  const handleBulkReschedule = async () => {
    if (selectedPosts.size === 0 || !rescheduleDate) return;

    setBulkRescheduling(true);
    try {
      const selected = posts
        .filter(p => selectedPosts.has(p.id))
        .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());

      // Distribute the selected posts across the campaign's post times starting
      // on the chosen date, one slot per post, rolling over to the next day.
      const updates: { id: string; scheduled_time: string }[] = [];
      if (postTimes.length > 0) {
        let day = new Date(rescheduleDate);
        day.setHours(0, 0, 0, 0);
        let timeIndex = 0;

        for (const post of selected) {
          const pt = postTimes[timeIndex % postTimes.length];
          const [hours, minutes] = pt.post_time.split(':').map(Number);

          let finalMinutes = minutes;
          if (pt.randomize && pt.random_range_minutes) {
            finalMinutes += Math.floor(Math.random() * (pt.random_range_minutes * 2 + 1)) - pt.random_range_minutes;
          }

          const slot = zonedWallTimeToUtc(day.getFullYear(), day.getMonth(), day.getDate(), hours, finalMinutes, timezone);
          updates.push({ id: post.id, scheduled_time: slot.toISOString() });
          timeIndex++;
          if (timeIndex % postTimes.length === 0) {
            day = addDays(day, 1);
          }
        }
      } else {
        const baseDate = new Date(rescheduleDate);
        for (const post of selected) {
          updates.push({ id: post.id, scheduled_time: baseDate.toISOString() });
        }
      }

      await applyScheduleUpdates(updates);

      toast({ title: `Rescheduled ${updates.length} posts`, description: postTimes.length > 0 ? `Spread across your campaign post times (${timezone})` : undefined });
      setSelectedPosts(new Set());
      setRescheduleDate(undefined);
      await fetchCampaignData();
    } catch (err) {
      console.error('Error bulk rescheduling:', err);
      toast({ title: 'Failed to reschedule posts', variant: 'destructive' });
    } finally {
      setBulkRescheduling(false);
    }
  };

  // Toggle post selection
  const togglePostSelection = (postId: string) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
  };

  // Select all on current page
  const toggleSelectAll = () => {
    if (selectedPosts.size === paginatedPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(paginatedPosts.map(p => p.id)));
    }
  };

  // Add post time
  const handleAddPostTime = async () => {
    if (!id) return;
    
    setSavingSchedule(true);
    try {
      const { error } = await supabase.from('campaign_post_times').insert({
        campaign_id: id,
        post_time: newPostTime,
        randomize: newRandomize,
        random_range_minutes: newRandomRange,
      });
      
      if (error) throw error;
      
      // Only refresh post times, not all posts
      const { data: timesData } = await supabase
        .from('campaign_post_times')
        .select('*')
        .eq('campaign_id', id)
        .order('post_time', { ascending: true });
      
      setPostTimes(timesData || []);
      
      toast({ title: 'Post time added' });
      setNewPostTime('09:00');
    } catch (err) {
      console.error('Error adding post time:', err);
      toast({ title: 'Failed to add post time', variant: 'destructive' });
    } finally {
      setSavingSchedule(false);
    }
  };

  // Delete post time
  const handleDeletePostTime = async (timeId: string) => {
    try {
      await supabase.from('campaign_post_times').delete().eq('id', timeId);
      
      // Only refresh post times, not all posts
      const { data: timesData } = await supabase
        .from('campaign_post_times')
        .select('*')
        .eq('campaign_id', id)
        .order('post_time', { ascending: true });
      
      setPostTimes(timesData || []);
      
      toast({ title: 'Post time removed' });
    } catch (err) {
      toast({ title: 'Failed to remove post time', variant: 'destructive' });
    }
  };

  // Save caption settings
  const handleSaveCaptionSettings = async () => {
    if (!campaign) return;

    if (fallbackCaptionsEnabled && (parsedFallbackCaptions.length < 2 || parsedFallbackCaptions.length > 3)) {
      toast({
        title: 'Fallback captions required',
        description: 'Add 2 or 3 fallback captions (one per line), or disable fallback captions.',
        variant: 'destructive',
      });
      return;
    }
    
    const normalizedBrands = watermarkBrands
      .map((brand) => ({
        ...brand,
        name: brand.name.trim(),
        logoUrl: brand.logoUrl.trim(),
        caption: brand.caption.trim(),
        interval: clampBrandInterval(brand.interval),
      }))
      .filter((brand) => brand.name || brand.logoUrl || brand.caption);

    if (normalizedBrands.some((brand) => brand.enabled && !brand.logoUrl)) {
      toast({
        title: 'Brand logo required',
        description: 'Each enabled brand entry needs a logo URL.',
        variant: 'destructive',
      });
      return;
    }

    const parsedAffiliateLinks = affiliateLinksInput
      .split(/\n+/)
      .map((link) => link.trim())
      .filter((link) => link.length > 0);

    setSavingCaptionSettings(true);
    try {
      const existingWatermarkSettings =
        campaign.watermark_settings && typeof campaign.watermark_settings === 'object'
          ? campaign.watermark_settings
          : {};
      const nextWatermarkSettings = {
        ...existingWatermarkSettings,
        enabled: normalizedBrands.some((brand) => brand.enabled && brand.logoUrl),
        placement: {
          mode: watermarkMode,
          position: watermarkPosition,
          widthPercent: Math.max(5, Math.min(100, Math.floor(watermarkWidthPercent || 18))),
          heightPercent: Math.max(5, Math.min(100, Math.floor(watermarkHeightPercent || 18))),
        },
        brands: normalizedBrands,
      };
      const nextBrandingLines = {
        enabled: brandingLinesEnabled,
        frequency: brandingFrequency,
        interval: clampBrandInterval(brandingInterval),
        text: brandingText.trim(),
      };
      const nextAffiliateLinks = {
        enabled: affiliateEnabled,
        frequency: affiliateFrequency,
        interval: clampBrandInterval(affiliateInterval),
        links: parsedAffiliateLinks,
      };

      const updatedFields = {
        template_type: useAIGeneration ? 'ai' : 'manual',
        custom_caption: useAIGeneration ? null : manualTemplate,
        caption_length: captionLength,
        hashtag_count: hashtagCount,
        youtube_upload_type: youtubeUploadType,
        youtube_title_language: youtubeTitleLanguage,
        fallback_captions_enabled: fallbackCaptionsEnabled,
        fallback_captions: fallbackCaptionsEnabled ? parsedFallbackCaptions : [],
        logo_opacity: logoOpacity,
        watermark_settings: nextWatermarkSettings,
        branding_lines: nextBrandingLines,
        affiliate_links: nextAffiliateLinks,
      };

      const { error } = await supabase
        .from('campaigns')
        .update(updatedFields)
        .eq('id', id);

      if (error) throw error;

      setCampaign({ ...campaign, ...updatedFields });
      setShowCaptionSettings(false);
      toast({ 
        title: 'Caption Settings Saved',
        description: 'Changes will apply to all future scheduled posts'
      });
    } catch (err) {
      console.error('Error saving caption settings:', err);
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSavingCaptionSettings(false);
    }
  };

  // Toggle pause/resume campaign
  const handleTogglePause = async () => {
    if (!campaign) return;
    
    setTogglingPause(true);
    try {
      const newStatus = campaign.status === 'paused' ? 'active' : 'paused';
      const { error } = await supabase
        .from('campaigns')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setCampaign({ ...campaign, status: newStatus });
      toast({ 
        title: newStatus === 'paused' ? 'Campaign Paused' : 'Campaign Resumed',
        description: newStatus === 'paused' 
          ? 'Pending posts will not be processed until resumed' 
          : 'Pending posts will now be processed'
      });
    } catch (err) {
      toast({ title: 'Failed to update campaign', variant: 'destructive' });
    } finally {
      setTogglingPause(false);
    }
  };

  // Convert a wall-clock time in a timezone to the corresponding UTC instant.
  // Two-pass adjustment handles minute-offset zones (e.g. IST, UTC+5:30) and DST.
  const zonedWallTimeToUtc = (
    year: number,
    monthIndex: number,
    day: number,
    hours: number,
    minutes: number,
    tz: string
  ): Date => {
    const target = Date.UTC(year, monthIndex, day, hours, minutes, 0);
    let utc = target;
    for (let i = 0; i < 2; i++) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(new Date(utc));
      const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
      const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
      utc += target - asUtc;
    }
    return new Date(utc);
  };

  // Apply scheduled_time updates in parallel chunks instead of one-by-one.
  const applyScheduleUpdates = async (updates: { id: string; scheduled_time: string }[]) => {
    const CHUNK = 25;
    for (let i = 0; i < updates.length; i += CHUNK) {
      await Promise.all(
        updates.slice(i, i + CHUNK).map((update) =>
          supabase
            .from('scheduled_posts')
            .update({ scheduled_time: update.scheduled_time })
            .eq('id', update.id)
        )
      );
    }
  };

  // Helper to get current time in timezone
  const getNowInTimezone = (tz: string): Date => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
    return new Date(
      parseInt(get('year')),
      parseInt(get('month')) - 1,
      parseInt(get('day')),
      parseInt(get('hour')),
      parseInt(get('minute')),
      parseInt(get('second'))
    );
  };

  // Reschedule all pending posts starting from tomorrow
  const handleRescheduleAll = async () => {
    const pendingPosts = posts.filter(p => p.status === 'pending' || p.status === 'processing');
    if (pendingPosts.length === 0 || postTimes.length === 0) {
      toast({ title: 'No pending posts to reschedule', variant: 'destructive' });
      return;
    }
    
    if (!confirm(`Reschedule all ${pendingPosts.length} pending posts starting from tomorrow in ${timezone}?`)) return;
    
    setReschedulingAll(true);
    try {
      const sortedPosts = [...pendingPosts].sort((a, b) => 
        new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
      );
      
      // Get tomorrow in the selected timezone
      const nowInTz = getNowInTimezone(timezone);
      let currentDay = addDays(nowInTz, 1);
      currentDay.setHours(0, 0, 0, 0);
      let timeIndex = 0;
      
      const updates: { id: string; scheduled_time: string }[] = [];
      
      for (const post of sortedPosts) {
        const postTime = postTimes[timeIndex % postTimes.length];
        const [hours, minutes] = postTime.post_time.split(':').map(Number);

        let finalMinutes = minutes;
        if (postTime.randomize && postTime.random_range_minutes) {
          finalMinutes += Math.floor(Math.random() * (postTime.random_range_minutes * 2 + 1)) - postTime.random_range_minutes;
        }

        const scheduledDate = zonedWallTimeToUtc(
          currentDay.getFullYear(),
          currentDay.getMonth(),
          currentDay.getDate(),
          hours,
          finalMinutes,
          timezone
        );

        updates.push({ id: post.id, scheduled_time: scheduledDate.toISOString() });

        timeIndex++;
        // Move to next day after using all time slots
        if (timeIndex % postTimes.length === 0) {
          currentDay = addDays(currentDay, 1);
        }
      }

      await applyScheduleUpdates(updates);

      toast({ title: `Rescheduled ${updates.length} posts`, description: `Starting from tomorrow (${timezone})` });
      // Refresh in the background so the button spinner doesn't look stuck on large campaigns
      void fetchCampaignData();
    } catch (err) {
      console.error('Error rescheduling:', err);
      toast({ title: 'Failed to reschedule posts', variant: 'destructive' });
    } finally {
      setReschedulingAll(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'posted':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getFacebookPostUrl = (post: ScheduledPost) => {
    // Use permalink_url if available (exact reel/video URL from Facebook)
    if (post.permalink_url) {
      return post.permalink_url;
    }
    
    // Fallback to constructing URL from facebook_post_id
    if (!post.facebook_post_id) return null;
    const page = post.facebook_page_id ? facebookPages[post.facebook_page_id] : null;
    if (page) {
      const postIdParts = post.facebook_post_id.split('_');
      if (postIdParts.length === 2) {
        return `https://www.facebook.com/${postIdParts[0]}/posts/${postIdParts[1]}`;
      }
    }
    return `https://www.facebook.com/${post.facebook_post_id}`;
  };

  const getPostPermalink = (post: ScheduledPost) => {
    if (post.permalink_url) {
      return post.permalink_url;
    }

    const platform = post.platform || 'facebook';
    if (platform === 'facebook') {
      return getFacebookPostUrl(post);
    }
    if (platform === 'instagram' && post.instagram_media_id) {
      return `https://www.instagram.com/reel/${post.instagram_media_id}/`;
    }
    if (platform === 'youtube' && post.youtube_video_id) {
      return `https://www.youtube.com/watch?v=${post.youtube_video_id}`;
    }
    return null;
  };

  const getGoogleDriveThumbnail = (url: string): string | null => {
    try {
      const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /id=([a-zA-Z0-9_-]+)/,
        /\/d\/([a-zA-Z0-9_-]+)/,
      ];
      
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  if (loading) {
    return (
      <AppLayout title="Campaign">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout title="Campaign">
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Campaign not found</p>
          <Link to="/" className="text-primary mt-4 inline-block">Go back</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={campaign.title}
      rightAction={
        <Link to="/">
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        </Link>
      }
    >
      <div className="p-4 space-y-3">
        {/* Campaign Status Badge */}
        {campaign.status === 'paused' && (
          <div className="ios-card p-3 bg-yellow-500/10 border-yellow-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pause className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Campaign Paused</span>
            </div>
            <Button size="sm" onClick={handleTogglePause} disabled={togglingPause}>
              {togglingPause ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resume'}
            </Button>
          </div>
        )}

        {/* Current Time & Timezone Info */}
        <div className="ios-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {currentTime.toLocaleTimeString('en-US', { 
                  timeZone: timezone,
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true 
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {currentTime.toLocaleDateString('en-US', { 
                  timeZone: timezone,
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <Globe className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz.value} value={tz.value} className="text-xs">
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Schedule year info */}
          {stats.pending > 0 && posts.filter(p => p.status === 'pending').length > 0 && (() => {
            const pendingPosts = posts.filter(p => p.status === 'pending');
            const firstPost = pendingPosts.reduce((min, p) => 
              new Date(p.scheduled_time) < new Date(min.scheduled_time) ? p : min
            );
            const lastPost = pendingPosts.reduce((max, p) => 
              new Date(p.scheduled_time) > new Date(max.scheduled_time) ? p : max
            );
            const firstYear = new Date(firstPost.scheduled_time).getFullYear();
            const lastYear = new Date(lastPost.scheduled_time).getFullYear();
            const currentYear = new Date().getFullYear();
            
            return (
              <div className={`text-xs p-2 rounded ${firstYear > currentYear + 1 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                <span className="font-medium">Scheduled:</span>{' '}
                {format(new Date(firstPost.scheduled_time), 'MMM d, yyyy')} → {format(new Date(lastPost.scheduled_time), 'MMM d, yyyy')}
                {firstYear > currentYear + 1 && (
                  <span className="ml-2">(Far future — consider rescheduling)</span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Stats Toggle & Quick Stats */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showStats ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            Stats
          </button>
          <div className="flex-1" />
          <div className="flex gap-1 text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{stats.total}</span> total •
            <span className="text-yellow-500">{stats.pending}</span> pending •
            <span className="text-green-500">{stats.posted}</span> posted •
            <span className="text-destructive">{stats.failed}</span> failed
          </div>
        </div>

        {/* Stats Dashboard */}
        {showStats && <CampaignStats posts={posts} />}

        {/* Actions Row */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleTriggerAutoPoster}
            disabled={triggeringAutoPoster || campaign.status === 'paused'}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {triggeringAutoPoster ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Zap className="w-4 h-4 text-primary" />
            )}
            <span className="text-xs font-medium text-primary">Auto-Post</span>
          </button>
          
          {/* Pause/Resume */}
          <button
            onClick={handleTogglePause}
            disabled={togglingPause}
            className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${
              campaign.status === 'paused' 
                ? 'bg-green-500/10 hover:bg-green-500/20' 
                : 'bg-yellow-500/10 hover:bg-yellow-500/20'
            }`}
          >
            {togglingPause ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : campaign.status === 'paused' ? (
              <PlayCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Pause className="w-4 h-4 text-yellow-500" />
            )}
          </button>
          
          {/* Reschedule All */}
          <button
            onClick={handleRescheduleAll}
            disabled={reschedulingAll || stats.pending === 0}
            className="flex items-center justify-center gap-2 p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50"
            title="Reschedule all pending posts starting tomorrow"
          >
            {reschedulingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-foreground" />
            )}
          </button>
          
          <Dialog open={showScheduleEditor} onOpenChange={setShowScheduleEditor}>
            <DialogTrigger asChild>
              <button className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                <Settings2 className="w-4 h-4 text-foreground" />
                <span className="text-xs font-medium text-foreground">Schedule</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Post Schedule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Existing post times */}
                <div className="space-y-2">
                  <Label className="text-sm">Daily Post Times</Label>
                  {postTimes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No post times configured</p>
                  ) : (
                    <div className="space-y-2">
                      {postTimes.map((time) => (
                        <div key={time.id} className="flex items-center justify-between p-2 bg-secondary rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{time.post_time}</p>
                            {time.randomize && (
                              <p className="text-xs text-muted-foreground">±{time.random_range_minutes}min</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePostTime(time.id)}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Add new post time */}
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm">Add Post Time</Label>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={newPostTime}
                      onChange={(e) => setNewPostTime(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleAddPostTime} disabled={savingSchedule} size="sm">
                      {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Randomize time</Label>
                    <Switch checked={newRandomize} onCheckedChange={setNewRandomize} />
                  </div>
                  
                  {newRandomize && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">±</Label>
                      <Input
                        type="number"
                        value={newRandomRange}
                        onChange={(e) => setNewRandomRange(Number(e.target.value))}
                        className="w-20"
                        min={0}
                        max={120}
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Caption Settings Dialog */}
          <Dialog open={showCaptionSettings} onOpenChange={setShowCaptionSettings}>
            <DialogTrigger asChild>
              <button className="flex items-center justify-center gap-2 p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                <Film className="w-4 h-4 text-foreground" />
                <span className="text-xs font-medium text-foreground">Caption</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Campaign Content & Watermark Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Changes will apply to all future scheduled posts in this campaign.
                </p>

                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">AI Caption Generator</Label>
                    <Switch checked={useAIGeneration} onCheckedChange={setUseAIGeneration} />
                  </div>
                  {!useAIGeneration && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Manual Caption Template</Label>
                      <textarea
                        value={manualTemplate}
                        onChange={(e) => setManualTemplate(e.target.value)}
                        rows={4}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder="Write your caption template..."
                      />
                    </div>
                  )}
                </div>
                
                {/* Caption Length */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Caption Length</Label>
                  <Select value={captionLength} onValueChange={(v) => setCaptionLength(v as 'short' | 'medium' | 'long')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select caption length" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="short">Short (1 sentence)</SelectItem>
                      <SelectItem value="medium">Medium (2-3 sentences)</SelectItem>
                      <SelectItem value="long">Long (4+ sentences)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Hashtag Count */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Number of Hashtags: {hashtagCount === 0 ? 'None' : hashtagCount}</Label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={hashtagCount}
                      onChange={(e) => setHashtagCount(parseInt(e.target.value))}
                      className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-sm text-muted-foreground w-8">{hashtagCount}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">YouTube Upload Type</Label>
                  <Select value={youtubeUploadType} onValueChange={(v) => setYoutubeUploadType(v as 'auto' | 'shorts' | 'long_form')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="shorts">Shorts</SelectItem>
                      <SelectItem value="long_form">Long-form</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">YouTube Title Language</Label>
                  <Select value={youtubeTitleLanguage} onValueChange={(v) => setYoutubeTitleLanguage(v as 'english' | 'hinglish' | 'hindi')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="hinglish">Hinglish</SelectItem>
                      <SelectItem value="hindi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Fallback captions if AI credits are exhausted</Label>
                    <Switch checked={fallbackCaptionsEnabled} onCheckedChange={setFallbackCaptionsEnabled} />
                  </div>
                  {fallbackCaptionsEnabled && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Fallback captions (2-3, one per line)</Label>
                      <textarea
                        value={fallbackCaptionsInput}
                        onChange={(e) => setFallbackCaptionsInput(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder={'Caption option 1\nCaption option 2\nCaption option 3 (optional)'}
                      />
                      <p className="text-xs text-muted-foreground">
                        {parsedFallbackCaptions.length}/3 captions added
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Logo Opacity: {logoOpacity}%</Label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={logoOpacity}
                    onChange={(e) => setLogoOpacity(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Watermark Layout</Label>
                    <Select value={watermarkMode} onValueChange={(v) => setWatermarkMode(v as WatermarkMode)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        <SelectItem value="fixed">Fixed position</SelectItem>
                        <SelectItem value="random">Random position</SelectItem>
                        <SelectItem value="fullscreen">Fullscreen logo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {watermarkMode === 'fixed' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Watermark Position</Label>
                      <Select value={watermarkPosition} onValueChange={(v) => setWatermarkPosition(v as WatermarkPosition)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50">
                          <SelectItem value="top-left">Top Left</SelectItem>
                          <SelectItem value="top-right">Top Right</SelectItem>
                          <SelectItem value="bottom-left">Bottom Left</SelectItem>
                          <SelectItem value="bottom-right">Bottom Right</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {watermarkMode !== 'fullscreen' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Width %</Label>
                      <Input
                        type="number"
                        min={5}
                        max={100}
                        value={watermarkWidthPercent}
                        onChange={(e) => setWatermarkWidthPercent(Math.max(5, Math.min(100, Number(e.target.value || 18))))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Height %</Label>
                      <Input
                        type="number"
                        min={5}
                        max={100}
                        value={watermarkHeightPercent}
                        onChange={(e) => setWatermarkHeightPercent(Math.max(5, Math.min(100, Number(e.target.value || 18))))}
                      />
                    </div>
                  </div>
                )}

                {/* Branding line in captions */}
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Branding line in captions</Label>
                    <Switch checked={brandingLinesEnabled} onCheckedChange={setBrandingLinesEnabled} />
                  </div>
                  {brandingLinesEnabled && (
                    <div className="space-y-2">
                      <Input
                        value={brandingText}
                        onChange={(e) => setBrandingText(e.target.value)}
                        placeholder="e.g. DM for credit/removal"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={brandingFrequency} onValueChange={(v) => setBrandingFrequency(v as FrequencyMode)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background border z-50">
                            <SelectItem value="every">Every post</SelectItem>
                            <SelectItem value="every_n">Every Nth post</SelectItem>
                          </SelectContent>
                        </Select>
                        {brandingFrequency === 'every_n' && (
                          <Input
                            type="number"
                            min={2}
                            max={5}
                            value={brandingInterval}
                            onChange={(e) => setBrandingInterval(clampBrandInterval(Number(e.target.value)))}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Affiliate links in captions */}
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Affiliate links in captions</Label>
                    <Switch checked={affiliateEnabled} onCheckedChange={setAffiliateEnabled} />
                  </div>
                  {affiliateEnabled && (
                    <div className="space-y-2">
                      <textarea
                        value={affiliateLinksInput}
                        onChange={(e) => setAffiliateLinksInput(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder={'https://link-one.example\nhttps://link-two.example'}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={affiliateFrequency} onValueChange={(v) => setAffiliateFrequency(v as FrequencyMode)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background border z-50">
                            <SelectItem value="every">Every post</SelectItem>
                            <SelectItem value="every_n">Every Nth post</SelectItem>
                          </SelectContent>
                        </Select>
                        {affiliateFrequency === 'every_n' && (
                          <Input
                            type="number"
                            min={2}
                            max={5}
                            value={affiliateInterval}
                            onChange={(e) => setAffiliateInterval(clampBrandInterval(Number(e.target.value)))}
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Links rotate one per post.</p>
                    </div>
                  )}
                </div>

                {/* Brand watermarks */}
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Brand watermarks</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={watermarkBrands.length >= MAX_BRANDS}
                      onClick={() =>
                        setWatermarkBrands((prev) => [
                          ...prev,
                          {
                            id: `brand-${Date.now()}-${prev.length}`,
                            name: '',
                            logoUrl: '',
                            caption: '',
                            enabled: true,
                            frequency: 'every',
                            interval: 3,
                          },
                        ])
                      }
                    >
                      Add ({watermarkBrands.length}/{MAX_BRANDS})
                    </Button>
                  </div>
                  {watermarkBrands.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No brands configured. Each brand can have its own logo, caption line, and frequency.
                    </p>
                  )}
                  {watermarkBrands.map((brand, index) => (
                    <div key={brand.id} className="space-y-2 rounded-md border p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Brand {index + 1}</span>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={brand.enabled}
                            onCheckedChange={(checked) => updateWatermarkBrand(brand.id, { enabled: checked })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setWatermarkBrands((prev) => prev.filter((b) => b.id !== brand.id))}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={brand.name}
                        onChange={(e) => updateWatermarkBrand(brand.id, { name: e.target.value })}
                        placeholder="Brand name"
                      />
                      <Input
                        value={brand.logoUrl}
                        onChange={(e) => updateWatermarkBrand(brand.id, { logoUrl: e.target.value })}
                        placeholder="Logo URL (required when enabled)"
                      />
                      <Input
                        value={brand.caption}
                        onChange={(e) => updateWatermarkBrand(brand.id, { caption: e.target.value })}
                        placeholder="Caption line appended for this brand (optional)"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={brand.frequency}
                          onValueChange={(v) => updateWatermarkBrand(brand.id, { frequency: v as FrequencyMode })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background border z-50">
                            <SelectItem value="every">Every reel</SelectItem>
                            <SelectItem value="every_n">Every Nth reel</SelectItem>
                          </SelectContent>
                        </Select>
                        {brand.frequency === 'every_n' && (
                          <Input
                            type="number"
                            min={2}
                            max={5}
                            value={brand.interval}
                            onChange={(e) => updateWatermarkBrand(brand.id, { interval: clampBrandInterval(Number(e.target.value)) })}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Current settings display */}
                <div className="p-3 rounded-lg bg-muted text-xs">
                  <p><strong>Current:</strong> {campaign?.caption_length || 'medium'} captions, {campaign?.hashtag_count || 8} hashtags</p>
                </div>
                
                <Button 
                  onClick={handleSaveCaptionSettings} 
                  disabled={savingCaptionSettings}
                  className="w-full"
                >
                  {savingCaptionSettings ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {campaign.drive_folder_id && (
            <button
              onClick={handleSyncFolder}
              disabled={isSyncingFolder}
              title="Sync folder video count"
              className="flex items-center justify-center gap-2 p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              {isSyncingFolder ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Folder sync result + schedule new videos */}
        {(campaign.drive_folder_id || (campaign.video_links?.length ?? 0) > 0) && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/50 text-sm">
            <span className="text-muted-foreground">
              {folderSync
                ? `${folderSync.videoCount} videos in ${folderSync.foldersScanned} folder(s). New videos can be scheduled below.`
                : 'Added new videos to this campaign? Schedule them without recreating the campaign.'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSchedule}
              disabled={generatingSchedule}
            >
              {generatingSchedule ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Schedule new videos
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setActiveTab('posted')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'posted'
                ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            Posted ({stats.posted})
          </button>
          <button
            onClick={() => setActiveTab('failed')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'failed'
                ? 'bg-destructive/20 text-destructive'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            Failed ({stats.failed})
          </button>
        </div>

        {/* Filters & Bulk Actions */}
        <div className="ios-card p-2 space-y-2">
          {/* Filter toggle & date pickers */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                showFilters || dateFrom || dateTo ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              }`}
            >
              <Filter className="w-3 h-3" />
              Filter
            </button>
            
            {(dateFrom || dateTo) && (
              <button
                onClick={clearFilters}
                className="text-xs text-destructive hover:underline"
              >
                Clear
              </button>
            )}
            
            <div className="flex-1" />
            
            <span className="text-xs text-muted-foreground">
              {filteredPosts.length} results
            </span>
          </div>
          
          {showFilters && (
            <div className="flex gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    {dateFrom ? format(dateFrom, 'MMM d') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background border z-50" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    {dateTo ? format(dateTo, 'MMM d') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background border z-50" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Bulk Actions */}
          {paginatedPosts.length > 0 && activeTab === 'pending' && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Checkbox
                checked={selectedPosts.size === paginatedPosts.length && paginatedPosts.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">
                {selectedPosts.size > 0 ? `${selectedPosts.size} selected` : 'Select all'}
              </span>
              
              {selectedPosts.size > 0 && (
                <>
                  <div className="flex-1" />
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        Reschedule
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background border z-50" align="end">
                      <div className="p-2 space-y-2">
                        <CalendarComponent
                          mode="single"
                          selected={rescheduleDate}
                          onSelect={setRescheduleDate}
                          className="pointer-events-auto"
                        />
                        <Button 
                          size="sm" 
                          className="w-full"
                          disabled={!rescheduleDate || bulkRescheduling}
                          onClick={handleBulkReschedule}
                        >
                          {bulkRescheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reschedule'}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Video Grid - 9:16 Reel Format */}
        {paginatedPosts.length === 0 ? (
          <div className="ios-card p-6 text-center">
            <p className="text-muted-foreground text-sm">No {activeTab} posts</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {paginatedPosts.map((post) => {
              const thumbnail = getGoogleDriveThumbnail(post.video_url);
              const postPermalink = getPostPermalink(post);
              const isSelected = selectedPosts.has(post.id);
              const platform = post.platform || 'facebook';
              
              const targetName = 
                platform === 'facebook' ? (post.facebook_page_id ? facebookPages[post.facebook_page_id]?.page_name : 'Unknown Page') :
                platform === 'instagram' ? (post.instagram_account_id ? instagramAccounts[post.instagram_account_id]?.instagram_username : 'Unknown Account') :
                platform === 'youtube' ? (post.youtube_channel_id ? youtubeChannels[post.youtube_channel_id]?.channel_name : 'Unknown Channel') :
                'Unknown';

              const PlatformIcon = 
                platform === 'facebook' ? Facebook :
                platform === 'instagram' ? Instagram :
                platform === 'youtube' ? Youtube :
                Video;

              return (
                <div 
                  key={post.id} 
                  className={`ios-card overflow-hidden ${isSelected ? 'ring-2 ring-primary' : ''}`}
                >
                  {/* Thumbnail - 9:16 Reel aspect ratio */}
                  <div className="aspect-[9/16] bg-secondary relative">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`absolute inset-0 flex items-center justify-center ${thumbnail ? 'hidden' : ''}`}>
                      <Video className="w-8 h-8 text-muted-foreground" />
                    </div>
                    
                    {/* Selection checkbox for pending */}
                    {activeTab === 'pending' && (
                      <div className="absolute top-1 left-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePostSelection(post.id)}
                          className="bg-background/80"
                        />
                      </div>
                    )}
                    
                    {/* Status badge */}
                    <div className="absolute top-1 right-2 flex flex-col gap-1 items-end text-right">
                      {getStatusIcon(post.status)}
                      <div className={cn(
                        "px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-tighter text-white shadow-sm flex items-center gap-0.5",
                        platform === 'facebook' ? "bg-[#1877F2]" :
                        platform === 'instagram' ? "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]" :
                        "bg-[#FF0000]"
                      )}>
                        <PlatformIcon className="w-2 h-2" />
                        {platform === 'facebook' ? 'FB' : platform === 'instagram' ? 'IG' : 'YT'}
                      </div>
                    </div>

                    {/* Post Now button for pending */}
                    {post.status === 'pending' && (
                      <button
                        onClick={() => handlePostNow(post.id)}
                        disabled={postingNow === post.id}
                        className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-xs px-2 py-1 rounded flex items-center gap-1"
                      >
                        {postingNow === post.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </button>
                    )}

                    {/* Retry button for failed (not rejected) */}
                    {post.status === 'failed' && (
                      <button
                        onClick={() => handleRetryPost(post.id)}
                        className="absolute bottom-1 right-1 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                    
                    {/* No retry for rejected - show badge */}
                    {post.status === 'rejected' && (
                      <div className="absolute bottom-1 right-1 bg-orange-500/80 text-white text-[10px] px-2 py-1 rounded">
                        No Retry
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-2 space-y-1">
                    {/* Date and Target */}
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                        {new Date(post.scheduled_time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 min-w-0">
                      <PlatformIcon className={cn(
                        "w-3 h-3 shrink-0",
                        platform === 'facebook' && "text-[#1877F2]",
                        platform === 'instagram' && "text-[#E4405F]",
                        platform === 'youtube' && "text-[#FF0000]"
                      )} />
                      <span className="text-[10px] font-semibold truncate text-muted-foreground">
                        {targetName}
                      </span>
                    </div>

                    {post.error_message && (
                      <p className="text-[10px] text-destructive truncate">{post.error_message}</p>
                    )}

                    {/* Links */}
                    <div className="flex gap-1 pt-1">
                      <a
                        href={post.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-[10px] bg-secondary hover:bg-secondary/80 text-foreground py-1 px-1.5 rounded text-center flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        Drive
                      </a>
                      
                      {post.status === 'posted' && postPermalink && (
                        <a
                          href={postPermalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "flex-1 text-[10px] py-1 px-1.5 rounded text-center flex items-center justify-center gap-1",
                            platform === 'facebook' ? 'bg-[#1877F2]/10 text-[#1877F2]' :
                            platform === 'instagram' ? 'bg-[#E4405F]/10 text-[#E4405F]' :
                            'bg-[#FF0000]/10 text-[#FF0000]'
                          )}
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {platform === 'facebook' ? 'FB' : platform === 'instagram' ? 'IG' : 'YT'}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Delete Button */}
        <div className="ios-card p-3 border-destructive/20 bg-destructive/5 mt-4">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDeleteCampaign}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Delete Campaign
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
