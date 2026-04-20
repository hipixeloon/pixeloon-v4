import { useState } from 'react';
import { ArrowLeft, Sparkles, Loader2, CheckCircle, XCircle, AlertTriangle, Folder, FileVideo, Lock, Info, Globe, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { IOSButton } from '@/components/ui/IOSButton';
import { IOSInput } from '@/components/ui/IOSInput';
import { IOSTextarea } from '@/components/ui/IOSTextarea';
import { IOSSwitch } from '@/components/ui/IOSSwitch';
import { FacebookPageSelect } from '@/components/campaign/FacebookPageSelect';
import { PlatformSelect } from '@/components/campaign/PlatformSelect';
import { ScheduleConfig, PostTime } from '@/components/campaign/ScheduleConfig';
import { BulkLinkExtractor } from '@/components/campaign/BulkLinkExtractor';
import { VideoPreviewGrid } from '@/components/campaign/VideoPreviewGrid';
import { usePlatformConnections } from '@/hooks/usePlatformConnections';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

// Common timezones
const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
];

// Default post times - natural looking schedule
const DEFAULT_POST_TIMES: PostTime[] = [
  { id: '1', time: '09:30', randomize: true, randomRange: 30 },
  { id: '2', time: '12:15', randomize: true, randomRange: 25 },
  { id: '3', time: '15:45', randomize: true, randomRange: 20 },
  { id: '4', time: '18:30', randomize: true, randomRange: 30 },
];

const SUPABASE_URL = 'https://jtsopnmudnvyqvlaptof.supabase.co';
const SERVICE_ACCOUNT_EMAIL = 'drive-downloader@elite-bird-483008-h2.iam.gserviceaccount.com';

// Helper to parse video links from bulk input - filters out folder links
function parseVideoLinks(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map(link => link.trim())
    .filter(link => {
      if (link.length === 0) return false;
      // Only accept direct file links, reject folder links
      if (link.includes('/folders/')) return false;
      return link.startsWith('http') && link.includes('drive.google.com/file/');
    });
}

// Extract folder ID from Google Drive folder URL
function extractFolderId(url: string): string | null {
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  if (/^[a-zA-Z0-9_-]+$/.test(url)) return url;
  return null;
}

interface FolderInfo {
  folderId: string;
  folderName: string;
  videoCount: number;
  videos: Array<{ id: string; name: string; size: number }>;
}

type VideoOrderMode = 'sequential' | 'random';
type FolderVideo = { id: string; name: string; size: number };
type FrequencyMode = 'every' | 'every_n';
type WatermarkMode = 'fixed' | 'random' | 'fullscreen';
type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

interface BrandWatermarkRule {
  id: string;
  name: string;
  logoUrl: string;
  caption: string;
  enabled: boolean;
  frequency: FrequencyMode;
  interval: number;
}

// Product requirement: allow configuring up to 5 rotating brand logos/captions per campaign.
const MAX_BRANDS = 5;
const MIN_FREQUENCY_INTERVAL = 2;
const MAX_FREQUENCY_INTERVAL = 5;
const DEFAULT_FREQUENCY_INTERVAL = 2;

const clampFrequencyInterval = (value: number) =>
  Math.max(MIN_FREQUENCY_INTERVAL, Math.min(MAX_FREQUENCY_INTERVAL, Math.floor(value || DEFAULT_FREQUENCY_INTERVAL)));

const createEmptyBrandRule = (): BrandWatermarkRule => ({
  id: crypto.randomUUID(),
  name: '',
  logoUrl: '',
  caption: '',
  enabled: true,
  frequency: 'every',
  interval: 2,
});

export default function NewCampaign() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdminOrModerator, loading: rolesLoading } = useUserRoles(user?.id);
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [bulkVideoInput, setBulkVideoInput] = useState('');
  const [useAIGeneration, setUseAIGeneration] = useState(true);
  const [manualTemplate, setManualTemplate] = useState('');
  const [postTimes, setPostTimes] = useState<PostTime[]>(DEFAULT_POST_TIMES);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFacebookPageIds, setSelectedFacebookPageIds] = useState<string[]>([]);
  const [selectedInstagramAccountIds, setSelectedInstagramAccountIds] = useState<string[]>([]);
  const [selectedYouTubeChannelIds, setSelectedYouTubeChannelIds] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<{
    total: number;
    valid: number;
    invalid: number;
    results: Array<{ url: string; fileId: string; valid: boolean; error?: string }>;
  } | null>(null);

  // Folder-based source
  const [sourceType, setSourceType] = useState<'folder' | 'manual'>('folder');
  const [folderUrl, setFolderUrl] = useState('');
  const [folderInfo, setFolderInfo] = useState<FolderInfo | null>(null);
  const [isFolderLoading, setIsFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  
  // Quality control options
  const [skipLowQuality, setSkipLowQuality] = useState(true);
  
  // YouTube upload type
  const [youtubeUploadType, setYoutubeUploadType] = useState<'auto' | 'shorts' | 'long_form'>('auto');
  const [youtubeTitleLanguage, setYoutubeTitleLanguage] = useState<'english' | 'hinglish' | 'hindi'>('english');

  // Branding logo opacity (0-100)
  const [logoOpacity, setLogoOpacity] = useState(80);
  const [watermarkMode, setWatermarkMode] = useState<WatermarkMode>('fixed');
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottom-right');
  const [watermarkWidthPercent, setWatermarkWidthPercent] = useState(18);
  const [watermarkHeightPercent, setWatermarkHeightPercent] = useState(18);
  
  // AI Caption settings
  const [captionLength, setCaptionLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [hashtagCount, setHashtagCount] = useState(8);
  const [fallbackCaptionsEnabled, setFallbackCaptionsEnabled] = useState(false);
  const [fallbackCaptionsInput, setFallbackCaptionsInput] = useState('');
  const [copyrightText, setCopyrightText] = useState('');
  const [copyrightEnabled, setCopyrightEnabled] = useState(false);
  const [copyrightFrequency, setCopyrightFrequency] = useState<FrequencyMode>('every');
  const [copyrightInterval, setCopyrightInterval] = useState(2);
  const [affiliateLinksEnabled, setAffiliateLinksEnabled] = useState(false);
  const [affiliateFrequency, setAffiliateFrequency] = useState<FrequencyMode>('every');
  const [affiliateInterval, setAffiliateInterval] = useState(2);
  const [affiliateLinksInput, setAffiliateLinksInput] = useState('');
  const [brandWatermarks, setBrandWatermarks] = useState<BrandWatermarkRule[]>([createEmptyBrandRule()]);
  
  // Timezone for scheduling
  const [timezone, setTimezone] = useState(() => {
    // Try to detect user's timezone
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Asia/Kolkata';
    }
  });
  const [startFromTomorrow, setStartFromTomorrow] = useState(true);
  const [videoOrderMode, setVideoOrderMode] = useState<VideoOrderMode>('sequential');
  const [startVideoIndex, setStartVideoIndex] = useState(0);
  const [sequenceStep, setSequenceStep] = useState(1);
  const [avoidSameTimeVideoCollisions, setAvoidSameTimeVideoCollisions] = useState(true);

  const { 
    fbPages: facebookPages, 
    igAccounts: instagramAccounts,
    ytChannels: youtubeChannels,
    loading: connectionsLoading, 
    connectFacebook,
    connectYouTube,
    refetch: refetchConnections
  } = usePlatformConnections(user?.id);

  // Parse video links from bulk input
  const parsedVideoLinks = parseVideoLinks(bulkVideoInput);
  const parsedAffiliateLinks = affiliateLinksInput
    .split(/\n+/)
    .map((link) => link.trim())
    .filter((link) => link.length > 0);
  const parsedFallbackCaptions = fallbackCaptionsInput
    .split(/\n+/)
    .map((caption) => caption.trim())
    .filter((caption) => caption.length > 0)
    .slice(0, 3);
  const totalVideos = sourceType === 'folder' 
    ? (folderInfo?.videoCount || 0) 
    : parsedVideoLinks.length;

  // Validate folder access
  const handleValidateFolder = async () => {
    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      setFolderError('Invalid folder URL. Use format: https://drive.google.com/drive/folders/...');
      return;
    }

    setIsFolderLoading(true);
    setFolderError(null);
    setFolderInfo(null);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/list-folder-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setFolderError(data.error || 'Failed to access folder');
        return;
      }

      const videos: FolderVideo[] = Array.isArray(data.videos)
        ? data.videos
            .filter((v: unknown): v is FolderVideo =>
              typeof v === 'object' &&
              v !== null &&
              typeof (v as FolderVideo).id === 'string' &&
              typeof (v as FolderVideo).name === 'string' &&
              typeof (v as FolderVideo).size === 'number'
            )
            .map((v) => ({ id: v.id, name: v.name, size: v.size }))
        : [];

      setFolderInfo({
        folderId: data.folderId,
        folderName: data.folderName,
        videoCount: data.totalCount,
        videos,
      });

      toast({
        title: 'Folder Connected!',
        description: `Found ${data.totalCount} videos in "${data.folderName}"`,
      });
    } catch (error) {
      console.error('Folder validation error:', error);
      setFolderError('Failed to connect to folder. Make sure it\'s shared with the service account.');
    } finally {
      setIsFolderLoading(false);
    }
  };

  // Validate Google Drive links (manual mode)
  const handleValidateLinks = async () => {
    if (parsedVideoLinks.length === 0) {
      toast({
        title: 'No Links',
        description: 'Add some video links first.',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    setValidationResults(null);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/validate-drive-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: parsedVideoLinks }),
      });

      if (!response.ok) {
        throw new Error('Validation request failed');
      }

      const data = await response.json();
      setValidationResults(data);

      if (data.invalid === 0) {
        toast({
          title: 'All Links Valid',
          description: `${data.valid} videos are accessible and ready to post.`,
        });
      } else {
        toast({
          title: 'Some Links Invalid',
          description: `${data.valid} valid, ${data.invalid} need fixing. Check the details below.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        title: 'Validation Failed',
        description: 'Could not validate links. Try again.',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const addBrandWatermark = () => {
    setBrandWatermarks((prev) => {
      if (prev.length >= MAX_BRANDS) return prev;
      return [...prev, createEmptyBrandRule()];
    });
  };

  const removeBrandWatermark = (id: string) => {
    setBrandWatermarks((prev) => {
      const next = prev.filter((brand) => brand.id !== id);
      return next.length > 0 ? next : [createEmptyBrandRule()];
    });
  };

  const updateBrandWatermark = (id: string, patch: Partial<BrandWatermarkRule>) => {
    setBrandWatermarks((prev) =>
      prev.map((brand) => {
        if (brand.id !== id) return brand;
        return {
          ...brand,
          ...patch,
          interval: patch.interval ? clampFrequencyInterval(patch.interval) : brand.interval,
        };
      })
    );
  };

  const handleCreateCampaign = async () => {
    if (!user) {
      toast({
        title: 'Not Logged In',
        description: 'Please log in to create a campaign.',
        variant: 'destructive',
      });
      return;
    }

    if (!campaignName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a campaign name.',
        variant: 'destructive',
      });
      return;
    }

    // Validate video source
    if (sourceType === 'folder') {
      if (!folderInfo) {
        toast({
          title: 'Folder Required',
          description: 'Please connect a Google Drive folder first.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      if (parsedVideoLinks.length === 0) {
        toast({
          title: 'Videos Required',
          description: 'Please add at least one video link.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (selectedFacebookPageIds.length === 0 && selectedInstagramAccountIds.length === 0 && selectedYouTubeChannelIds.length === 0) {
      toast({
        title: 'Platform Required',
        description: 'Please select at least one platform (Facebook, Instagram, or YouTube) for posting.',
        variant: 'destructive',
      });
      return;
    }

    if (postTimes.length === 0) {
      toast({
        title: 'Schedule Required',
        description: 'Please add at least one posting time.',
        variant: 'destructive',
      });
      return;
    }

    if (copyrightEnabled && !copyrightText.trim()) {
      toast({
        title: 'Copyright Notice Required',
        description: 'Add copyright/removal text or disable the copyright notice option.',
        variant: 'destructive',
      });
      return;
    }

    if (affiliateLinksEnabled && parsedAffiliateLinks.length === 0) {
      toast({
        title: 'Affiliate Links Required',
        description: 'Add at least one affiliate URL or disable affiliate links.',
        variant: 'destructive',
      });
      return;
    }

    if (fallbackCaptionsEnabled && (parsedFallbackCaptions.length < 2 || parsedFallbackCaptions.length > 3)) {
      toast({
        title: 'Fallback Captions Required',
        description: 'Add 2 or 3 fallback captions (one per line) or disable fallback captions.',
        variant: 'destructive',
      });
      return;
    }

    const normalizedBrands = brandWatermarks
      .map((brand) => ({
        ...brand,
        name: brand.name.trim(),
        logoUrl: brand.logoUrl.trim(),
        caption: brand.caption.trim(),
        interval: clampFrequencyInterval(brand.interval),
      }))
      .filter((brand) => brand.name || brand.logoUrl || brand.caption);

    const hasInvalidBrand = normalizedBrands.some((brand) => brand.enabled && !brand.logoUrl);
    if (hasInvalidBrand) {
      toast({
        title: 'Brand Logo Required',
        description: 'Each enabled brand entry needs a logo URL.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      // 1. Create the campaign
      const campaignData: Record<string, unknown> = {
        user_id: user.id,
        title: campaignName.trim(),
        description: description.trim(),
        template_type: useAIGeneration ? 'ai' : 'manual',
        custom_caption: !useAIGeneration ? manualTemplate : null,
        status: 'active',
        platforms: {
          facebook: selectedFacebookPageIds.length > 0,
          instagram: selectedInstagramAccountIds.length > 0,
          youtube: selectedYouTubeChannelIds.length > 0
        }
      };

      // Set video source based on mode
      // Add caption settings
      campaignData.caption_length = captionLength;
      campaignData.hashtag_count = hashtagCount;
      campaignData.fallback_captions_enabled = fallbackCaptionsEnabled;
      campaignData.fallback_captions = fallbackCaptionsEnabled ? parsedFallbackCaptions : [];

      // YouTube upload type (only relevant if YouTube channels are selected)
      if (selectedYouTubeChannelIds.length > 0) {
        campaignData.youtube_upload_type = youtubeUploadType;
        campaignData.youtube_title_language = youtubeTitleLanguage;
      }

      // Logo opacity for watermarking
      campaignData.logo_opacity = logoOpacity;
      campaignData.branding_lines = {
        enabled: copyrightEnabled,
        frequency: copyrightFrequency,
        interval: clampFrequencyInterval(copyrightInterval),
        text: copyrightText.trim(),
      };
      campaignData.affiliate_links = {
        enabled: affiliateLinksEnabled,
        frequency: affiliateFrequency,
        interval: clampFrequencyInterval(affiliateInterval),
        links: parsedAffiliateLinks,
      };
      campaignData.watermark_settings = {
        enabled: normalizedBrands.some((brand) => brand.enabled && brand.logoUrl),
        placement: {
          mode: watermarkMode,
          position: watermarkPosition,
          widthPercent: Math.max(5, Math.min(100, Math.floor(watermarkWidthPercent || 18))),
          heightPercent: Math.max(5, Math.min(100, Math.floor(watermarkHeightPercent || 18))),
        },
        brands: normalizedBrands.map((brand) => ({
          id: brand.id,
          name: brand.name,
          logoUrl: brand.logoUrl,
          caption: brand.caption,
          enabled: brand.enabled,
          frequency: brand.frequency,
          interval: brand.interval,
        })),
      };
      campaignData.video_order_mode = videoOrderMode;
      campaignData.start_video_index = Math.max(0, Math.floor(startVideoIndex));
      campaignData.sequence_step = Math.max(1, Math.floor(sequenceStep));
      campaignData.avoid_same_time_video_collisions = avoidSameTimeVideoCollisions;

      // Set video source based on mode
      if (sourceType === 'folder' && folderInfo) {
        campaignData.drive_folder_id = folderInfo.folderId;
        campaignData.drive_folder_name = folderInfo.folderName;
        campaignData.video_links = []; // Empty for folder-based
      } else {
        campaignData.video_links = parsedVideoLinks;
        campaignData.drive_folder_id = null;
        campaignData.drive_folder_name = null;
      }

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select()
        .single();

      if (campaignError) throw campaignError;

      // 2. Link Facebook pages
      const pageLinks = selectedFacebookPageIds.map((pageId) => ({
        campaign_id: campaign.id,
        facebook_page_id: pageId,
      }));

      const { error: pagesError } = await supabase
        .from('campaign_pages')
        .insert(pageLinks);

      if (pagesError) throw pagesError;

      // 2b. Link Instagram accounts
      if (selectedInstagramAccountIds.length > 0) {
        const instagramLinks = selectedInstagramAccountIds.map((accId) => ({
          campaign_id: campaign.id,
          instagram_account_id: accId,
        }));
        const { error: igError } = await supabase.from('campaign_instagram_accounts').insert(instagramLinks);
        if (igError) throw igError;
      }

      // 2c. Link YouTube channels
      if (selectedYouTubeChannelIds.length > 0) {
        const youtubeLinks = selectedYouTubeChannelIds.map((chanId) => ({
          campaign_id: campaign.id,
          youtube_channel_id: chanId,
        }));
        const { error: ytError } = await supabase.from('campaign_youtube_channels').insert(youtubeLinks);
        if (ytError) throw ytError;
      }

      // 3. Save post times
      const postTimeRecords = postTimes.map((pt) => ({
        campaign_id: campaign.id,
        post_time: pt.time,
        randomize: pt.randomize,
        random_range_minutes: pt.randomRange,
      }));

      const { error: timesError } = await supabase
        .from('campaign_post_times')
        .insert(postTimeRecords);

      if (timesError) throw timesError;

      // 4. Generate scheduled posts - schedule ALL videos from folder
      const scheduleResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-schedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            campaignId: campaign.id, 
            scheduleAllVideos: true, // Schedule every video in the folder
            generateAI: useAIGeneration,
            skipLowQuality, // Auto-skip videos below 720p or with extreme aspect ratios
            timezone, // User's timezone for correct scheduling
            startFromTomorrow, // Start scheduling from tomorrow
            videoOrderMode,
            startVideoIndex: Math.max(0, Math.floor(startVideoIndex)),
            sequenceStep: Math.max(1, Math.floor(sequenceStep)),
            avoidSameTimeVideoCollisions,
          }),
        }
      );
      
      const scheduleResult = await scheduleResponse.json();
      console.log('Schedule generated:', scheduleResult);

      if (scheduleResult.error) {
        throw new Error(scheduleResult.error);
      }

      toast({
        title: 'Campaign Created!',
        description: `${scheduleResult.postsCreated} posts scheduled from ${totalVideos} videos.`,
      });
      
      navigate('/');
    } catch (err) {
      console.error('Error creating campaign:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create campaign. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Check if user has permission to create campaigns - only admins/moderators
  const hasAccess = isAdminOrModerator;
  const loadingAccess = rolesLoading;

  if (loadingAccess) {
    return (
      <AppLayout title="New Campaign">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasAccess) {
    return (
      <AppLayout title="New Campaign">
        <div className="p-4">
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <CardTitle>Access Restricted</CardTitle>
              <CardDescription>
                You don't have permission to create campaigns. Please request creator access from your administrator.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/">
                <Button className="w-full">Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="New Campaign"
      rightAction={
        <Link to="/">
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary active:bg-secondary/80 transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        </Link>
      }
    >
      <div className="p-4 space-y-6 pb-24">
        {/* Platform Selection */}
        <section className="space-y-4">
          <h2 className="text-ios-title3 text-foreground px-1">Publish To</h2>
          <div className="ios-card p-4">
            <PlatformSelect
              facebookPages={facebookPages}
              instagramAccounts={instagramAccounts}
              youtubeChannels={youtubeChannels}
              selectedFacebookPageIds={selectedFacebookPageIds}
              selectedInstagramAccountIds={selectedInstagramAccountIds}
              selectedYouTubeChannelIds={selectedYouTubeChannelIds}
              onFacebookSelect={setSelectedFacebookPageIds}
              onInstagramSelect={setSelectedInstagramAccountIds}
              onYouTubeSelect={setSelectedYouTubeChannelIds}
              onConnectFacebook={connectFacebook}
              onConnectYouTube={connectYouTube}
              onRefresh={refetchConnections}
              loading={connectionsLoading}
            />
          </div>
        </section>

        {/* Campaign Details */}
        <section className="space-y-4">
          <h2 className="text-ios-title3 text-foreground px-1">Campaign Details</h2>
          <div className="ios-card p-4 space-y-4">
            <IOSInput
              label="Campaign Name"
              placeholder="e.g., Summer Sale 2025"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
            <IOSTextarea
              label="Campaign Description (for AI captions)"
              placeholder="Describe your campaign theme, target audience, tone... AI will use this to generate unique captions for each post"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </section>

        {/* Video Source Selection */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-ios-title3 text-foreground">Video Source</h2>
            {totalVideos > 0 && (
              <span className="text-ios-caption text-primary font-medium">
                {totalVideos} videos
              </span>
            )}
          </div>
          
          {/* Setup Instructions Card */}
          <div className="ios-card p-4 bg-blue-500/10 border-blue-500/30 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              📋 Setup Instructions (One-Time)
            </h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Share your folder with our service account:</strong></p>
              <div className="bg-background/50 p-2 rounded border font-mono text-xs break-all select-all">
                {SERVICE_ACCOUNT_EMAIL}
              </div>
              <p className="text-xs">
                Right-click your folder → Share → Paste email → "Viewer" access → Done!
              </p>
            </div>
          </div>

          {/* Source Type Tabs */}
          <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as 'folder' | 'manual')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="folder" className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Folder (Recommended)
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <FileVideo className="h-4 w-4" />
                Manual Links
              </TabsTrigger>
            </TabsList>

            {/* Folder Mode */}
            <TabsContent value="folder" className="space-y-4 mt-4">
              <div className="ios-card p-4 space-y-4">
                <IOSInput
                  label="Google Drive Folder URL"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={folderUrl}
                  onChange={(e) => {
                    setFolderUrl(e.target.value);
                    setFolderInfo(null);
                    setFolderError(null);
                  }}
                />
                
                <Button
                  onClick={handleValidateFolder}
                  disabled={isFolderLoading || !folderUrl.trim()}
                  className="w-full"
                >
                  {isFolderLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Folder className="h-4 w-4 mr-2" />
                      Connect Folder
                    </>
                  )}
                </Button>

                {/* Folder Error */}
                {folderError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5" />
                      <span className="text-sm">{folderError}</span>
                    </div>
                  </div>
                )}

                {/* Folder Success */}
                {folderInfo && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-3">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Folder Connected!</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><strong>Folder:</strong> {folderInfo.folderName}</p>
                      <p><strong>Videos found:</strong> {folderInfo.videoCount}</p>
                    </div>
                    
                    {/* Video list preview */}
                    {folderInfo.videos.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-2">Video files:</p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {folderInfo.videos.slice(0, 20).map((video, i) => (
                            <div key={video.id} className="text-xs flex items-center gap-2 text-foreground/80">
                              <FileVideo className="h-3 w-3 shrink-0" />
                              <span className="truncate">{video.name}</span>
                            </div>
                          ))}
                          {folderInfo.videos.length > 20 && (
                            <p className="text-xs text-muted-foreground">
                              ...and {folderInfo.videos.length - 20} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="ios-card p-4 bg-primary/5 border-primary/20">
                <p className="text-ios-subhead text-foreground">
                  ✨ <strong>Folder Mode Benefits:</strong> Just add videos to your folder anytime - no need to update the campaign. New videos will be picked up automatically when posting.
                </p>
              </div>
            </TabsContent>

            {/* Manual Links Mode */}
            <TabsContent value="manual" className="space-y-4 mt-4">
              <BulkLinkExtractor 
                existingLinks={parsedVideoLinks}
                onLinksExtracted={(links) => {
                  const existingLinks = parseVideoLinks(bulkVideoInput);
                  const newLinks = [...existingLinks, ...links];
                  setBulkVideoInput(newLinks.join('\n'));
                }}
              />
              
              <div className="ios-card p-4">
                <IOSTextarea
                  label="Paste video links (one per line)"
                  placeholder="https://drive.google.com/file/d/abc123/view
https://drive.google.com/file/d/def456/view"
                  value={bulkVideoInput}
                  onChange={(e) => setBulkVideoInput(e.target.value)}
                  className="min-h-[150px] font-mono text-sm"
                />
                {parsedVideoLinks.length > 0 && (
                  <div className="mt-3 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-ios-caption text-primary font-medium">
                          ✓ {parsedVideoLinks.length} video links detected
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleValidateLinks}
                        disabled={isValidating}
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Validate
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Validation Results */}
                    {validationResults && (
                      <div className={`p-3 rounded-lg border ${
                        validationResults.invalid === 0 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-destructive/10 border-destructive/30'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {validationResults.invalid === 0 ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                          )}
                          <span className="font-medium">
                            {validationResults.invalid === 0 
                              ? `All ${validationResults.valid} links are accessible!`
                              : `${validationResults.invalid} of ${validationResults.total} links have issues`
                            }
                          </span>
                        </div>
                        
                        {validationResults.invalid > 0 && (
                          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {validationResults.results
                              .filter(r => !r.valid)
                              .map((r, i) => (
                                <div key={i} className="text-xs flex items-start gap-2 text-destructive">
                                  <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="font-mono">{r.fileId?.substring(0, 12)}...</span>
                                    <span className="text-muted-foreground ml-2">{r.error}</span>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    )}
                    
                    <VideoPreviewGrid 
                      videoLinks={parsedVideoLinks}
                      onRemove={(index) => {
                        const links = parseVideoLinks(bulkVideoInput);
                        links.splice(index, 1);
                        setBulkVideoInput(links.join('\n'));
                        setValidationResults(null);
                      }}
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* AI Generation Toggle */}
        <section className="space-y-4">
          <h2 className="text-ios-title3 text-foreground px-1">Content Generation</h2>
          <div className="ios-section">
            <IOSSwitch
              checked={useAIGeneration}
              onCheckedChange={setUseAIGeneration}
              label="AI-Generated Content"
              description="Unique captions & hashtags generated when posting"
            />
          </div>

          {useAIGeneration && (
            <div className="ios-card p-4 space-y-4">
              <p className="text-ios-subhead text-foreground">
                ✨ AI will generate unique captions and hashtags for each post at posting time.
              </p>
              
              {/* Caption Length */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Caption Length</Label>
                <Select value={captionLength} onValueChange={(v) => setCaptionLength(v as 'short' | 'medium' | 'long')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select caption length" />
                  </SelectTrigger>
                  <SelectContent>
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
                <p className="text-xs text-muted-foreground">
                  Set to 0 for no hashtags, or up to 20
                </p>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Use fallback captions if AI credits are exhausted</Label>
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
            </div>
          )}

          {!useAIGeneration && (
            <div className="ios-card p-4">
              <IOSTextarea
                label="Manual Caption Template"
                placeholder="Write your caption template..."
                value={manualTemplate}
                onChange={(e) => setManualTemplate(e.target.value)}
              />
            </div>
          )}
        </section>

        {/* YouTube Upload Type - shown only when YouTube channels are selected */}
        {selectedYouTubeChannelIds.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-ios-title3 text-foreground px-1">YouTube Upload Type</h2>
            <div className="ios-card p-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Upload Mode</Label>
                <Select value={youtubeUploadType} onValueChange={(v) => setYoutubeUploadType(v as 'auto' | 'shorts' | 'long_form')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select upload type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">🤖 Auto-detect (based on video duration)</SelectItem>
                    <SelectItem value="shorts">📱 YouTube Shorts (≤60s, vertical)</SelectItem>
                    <SelectItem value="long_form">🎬 Long-form Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Title Language</Label>
                <Select value={youtubeTitleLanguage} onValueChange={(v) => setYoutubeTitleLanguage(v as 'english' | 'hinglish' | 'hindi')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select title language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="hinglish">Hinglish</SelectItem>
                    <SelectItem value="hindi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    {youtubeUploadType === 'auto' && <p>Duration ≤60s → Shorts; &gt;60s → Long-form. <strong>#Shorts</strong> tag added automatically.</p>}
                    {youtubeUploadType === 'shorts' && <p>All videos uploaded as <strong>YouTube Shorts</strong>. <strong>#Shorts</strong> tag is added to every post automatically.</p>}
                    {youtubeUploadType === 'long_form' && <p>All videos uploaded as standard <strong>long-form YouTube videos</strong>. Use this for full-length content.</p>}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Logo Opacity (Branding) */}
        <section className="space-y-4">
          <h2 className="text-ios-title3 text-foreground px-1">Branding / Logo</h2>
          <div className="ios-card p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Logo Opacity: {logoOpacity}%</Label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={logoOpacity}
                  onChange={(e) => setLogoOpacity(parseInt(e.target.value))}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-sm text-muted-foreground w-10">{logoOpacity}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Controls the watermark logo opacity when Cloudinary branding is configured. 0% = invisible, 100% = fully opaque.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Watermark Layout</Label>
                <Select value={watermarkMode} onValueChange={(v) => setWatermarkMode(v as WatermarkMode)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                    <SelectContent>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <IOSInput
                  type="number"
                  min={5}
                  max={100}
                  label="Logo Width (%)"
                  value={String(watermarkWidthPercent)}
                  onChange={(e) => setWatermarkWidthPercent(Math.max(5, Math.min(100, Number(e.target.value || 18))))}
                />
                <IOSInput
                  type="number"
                  min={5}
                  max={100}
                  label="Logo Height (%)"
                  value={String(watermarkHeightPercent)}
                  onChange={(e) => setWatermarkHeightPercent(Math.max(5, Math.min(100, Number(e.target.value || 18))))}
                />
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-ios-title3 text-foreground px-1">Caption Compliance</h2>
          <div className="ios-card p-4 space-y-4">
            <IOSSwitch
              checked={copyrightEnabled}
              onCheckedChange={setCopyrightEnabled}
              label="Copyright / Removal Notice"
              description="Append your legal copyright/removal-contact text to captions."
            />
            <IOSTextarea
              label="Notice Text"
              placeholder="© Your Brand. For copyright/removal contact: you@example.com"
              value={copyrightText}
              onChange={(e) => setCopyrightText(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notice Frequency</Label>
                <Select value={copyrightFrequency} onValueChange={(v) => setCopyrightFrequency(v as FrequencyMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="every">Every reel</SelectItem>
                    <SelectItem value="every_n">Every Nth reel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {copyrightFrequency === 'every_n' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Every N reels (2-5)</Label>
                  <IOSInput
                    type="number"
                    min={2}
                    max={5}
                    value={String(copyrightInterval)}
                    onChange={(e) => setCopyrightInterval(clampFrequencyInterval(Number(e.target.value || DEFAULT_FREQUENCY_INTERVAL)))}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-ios-title3 text-foreground px-1">Affiliate Links</h2>
          <div className="ios-card p-4 space-y-4">
            <IOSSwitch
              checked={affiliateLinksEnabled}
              onCheckedChange={setAffiliateLinksEnabled}
              label="Include Affiliate Links"
              description="Rotate affiliate links in reel captions."
            />
            <IOSTextarea
              label="Affiliate URLs (one per line)"
              placeholder="https://brand.com/ref/yourcode"
              value={affiliateLinksInput}
              onChange={(e) => setAffiliateLinksInput(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Affiliate Frequency</Label>
                <Select value={affiliateFrequency} onValueChange={(v) => setAffiliateFrequency(v as FrequencyMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="every">Every reel</SelectItem>
                    <SelectItem value="every_n">Every Nth reel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {affiliateFrequency === 'every_n' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Every N reels (2-5)</Label>
                  <IOSInput
                    type="number"
                    min={2}
                    max={5}
                    value={String(affiliateInterval)}
                    onChange={(e) => setAffiliateInterval(clampFrequencyInterval(Number(e.target.value || DEFAULT_FREQUENCY_INTERVAL)))}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-ios-title3 text-foreground px-1">Multi-Brand Watermarks</h2>
          <div className="ios-card p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Add up to {MAX_BRANDS} brands. Each brand can have its own logo, caption line, and frequency (every reel or every 2nd-5th reel).
            </p>
            {brandWatermarks.map((brand, index) => (
              <div key={brand.id} className="rounded-xl border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Brand {index + 1}</p>
                  <div className="flex items-center gap-2">
                    <IOSSwitch
                      checked={brand.enabled}
                      onCheckedChange={(checked) => updateBrandWatermark(brand.id, { enabled: checked })}
                      label="Enabled"
                    />
                    {brandWatermarks.length > 1 && (
                      <button
                        type="button"
                        className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
                        onClick={() => removeBrandWatermark(brand.id)}
                        aria-label={`Remove brand ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <IOSInput
                  placeholder="Brand name (optional)"
                  value={brand.name}
                  onChange={(e) => updateBrandWatermark(brand.id, { name: e.target.value })}
                />
                <IOSInput
                  type="url"
                  placeholder="Logo URL (required if enabled)"
                  value={brand.logoUrl}
                  onChange={(e) => updateBrandWatermark(brand.id, { logoUrl: e.target.value })}
                />
                <IOSTextarea
                  label="Brand caption line"
                  placeholder="Powered by BrandX"
                  value={brand.caption}
                  onChange={(e) => updateBrandWatermark(brand.id, { caption: e.target.value })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Brand Frequency</Label>
                    <Select
                      value={brand.frequency}
                      onValueChange={(v) => updateBrandWatermark(brand.id, { frequency: v as FrequencyMode })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="every">Every reel</SelectItem>
                        <SelectItem value="every_n">Every Nth reel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {brand.frequency === 'every_n' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Every N reels (2-5)</Label>
                      <IOSInput
                        type="number"
                        min={2}
                        max={5}
                        value={String(brand.interval)}
                        onChange={(e) =>
                          updateBrandWatermark(brand.id, { interval: clampFrequencyInterval(Number(e.target.value || DEFAULT_FREQUENCY_INTERVAL)) })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            <IOSButton
              variant="secondary"
              onClick={addBrandWatermark}
              disabled={brandWatermarks.length >= MAX_BRANDS}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Brand ({brandWatermarks.length}/{MAX_BRANDS})
            </IOSButton>
          </div>
        </section>

        {/* Video Quality Settings */}
        <section className="space-y-4">
          <h2 className="text-ios-title3 text-foreground px-1">Quality Settings</h2>
          <div className="ios-card p-4 space-y-4">
            <div className="flex items-start gap-3">
              <IOSSwitch
                checked={skipLowQuality}
                onCheckedChange={setSkipLowQuality}
                label="Skip Low Quality Videos"
                description="Automatically exclude videos below 720p or with extreme aspect ratios"
              />
            </div>
            
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Quality Requirements for Facebook Reels:</strong></p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Minimum resolution: 720p (720 pixels on shortest side)</li>
                    <li>Ideal aspect ratio: 9:16 (vertical)</li>
                    <li>Acceptable: 4:5 to 9:16 (portrait to vertical)</li>
                    <li>Extreme ratios (wider than 5:2 or taller than 2:5) will be rejected</li>
                  </ul>
                  {skipLowQuality && (
                    <p className="text-primary mt-2">
                      ✓ Low quality videos will be skipped during scheduling - no failed posts!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scheduling */}
        <section className="space-y-4">
          <h2 className="text-ios-title3 text-foreground px-1">Daily Schedule</h2>

          <div className="ios-card p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Video Sequence Rule</Label>
              <Select value={videoOrderMode} onValueChange={(v) => setVideoOrderMode(v as VideoOrderMode)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select sequence mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential (folder order)</SelectItem>
                  <SelectItem value="random">Randomized order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Start from Video Index</Label>
                <IOSInput
                  type="number"
                  min={0}
                  value={String(startVideoIndex)}
                  onChange={(e) => setStartVideoIndex(Math.max(0, Number(e.target.value || 0)))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Use this to start from middle for large folders (e.g. 2500).</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Sequence Step</Label>
                <IOSInput
                  type="number"
                  min={1}
                  value={String(sequenceStep)}
                  onChange={(e) => setSequenceStep(Math.max(1, Number(e.target.value || 1)))}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">Set &gt;1 to alter sequence across pages/campaigns using the same folder.</p>
              </div>
            </div>

            <IOSSwitch
              checked={avoidSameTimeVideoCollisions}
              onCheckedChange={setAvoidSameTimeVideoCollisions}
              label="Avoid Same-Time Video Repeats"
              description="Prevents the same user from scheduling the same video at the same minute across campaigns."
            />
          </div>
          
          {/* Timezone Selector */}
          <div className="ios-card p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Timezone</Label>
            </div>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Posts will be scheduled according to this timezone.
            </p>
            
            <div className="pt-2 border-t">
              <IOSSwitch
                checked={startFromTomorrow}
                onCheckedChange={setStartFromTomorrow}
                label="Start from Tomorrow"
                description="Begin scheduling from tomorrow instead of today"
              />
            </div>
          </div>
          
          <ScheduleConfig postTimes={postTimes} onChange={setPostTimes} />
        </section>

        {/* Create Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <IOSButton 
            fullWidth 
            size="lg" 
            onClick={handleCreateCampaign}
            disabled={isSaving || totalVideos === 0}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating Campaign...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2 inline" />
                Create Campaign ({totalVideos} videos)
              </>
            )}
          </IOSButton>
        </div>
      </div>
    </AppLayout>
  );
}
