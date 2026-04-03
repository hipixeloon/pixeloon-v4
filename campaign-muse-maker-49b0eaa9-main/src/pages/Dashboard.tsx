import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { CampaignCard } from '@/components/campaign/CampaignCard';
import { IOSButton } from '@/components/ui/IOSButton';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { ConnectionSetupPopup } from '@/components/auth/ConnectionSetupPopup';
import { usePlatformConnections } from '@/hooks/usePlatformConnections';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Campaign {
  id: string;
  title: string;
  video_links: string[];
  status: string;
  created_at: string;
  scheduled_count?: number;
  video_count?: number;
  page_names?: string[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ campaigns: 0, videos: 0, scheduled: 0 });
  const [isSetupPopupOpen, setIsSetupPopupOpen] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  const {
    fbPages,
    igAccounts,
    ytChannels,
    loading: connectionsLoading,
    connectFacebook,
    connectYouTube,
  } = usePlatformConnections(user?.id);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      checkGeminiKey();
    }
  }, [user]);

  const checkGeminiKey = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('key_name', 'gemini')
      .maybeSingle();
    setHasGeminiKey(!!data);
  };

  const fetchCampaigns = async () => {
    // ... lines omitted ...
  };

  useEffect(() => {
    if (!loading && !connectionsLoading && user) {
      const hasConnections = fbPages.length > 0 || igAccounts.length > 0 || ytChannels.length > 0;
      const isSetupComplete = hasConnections && hasGeminiKey;
      
      if (!isSetupComplete) {
        // Show setup popup if not everything is connected
        const lastPrompt = localStorage.getItem('last_setup_prompt');
        const now = Date.now();
        // Only prompt once every 24 hours to avoid annoyance
        if (!lastPrompt || (now - parseInt(lastPrompt)) > 24 * 60 * 60 * 1000) {
          setIsSetupPopupOpen(true);
          localStorage.setItem('last_setup_prompt', now.toString());
        }
      }
    }
  }, [loading, connectionsLoading, user, fbPages, igAccounts, ytChannels, hasGeminiKey]);

  const handleRefresh = useCallback(async () => {
    await fetchCampaigns();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <AppLayout
        title="Campaigns"
        rightAction={
          <Link to="/campaign/new">
            <button className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-secondary active:bg-secondary/80 transition-colors">
              <Plus className="w-6 h-6 text-primary" />
            </button>
          </Link>
        }
      >
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Campaigns"
      rightAction={
        <Link to="/campaign/new">
          <button className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-secondary active:bg-secondary/80 transition-colors">
            <Plus className="w-6 h-6 text-primary" />
          </button>
        </Link>
      }
    >
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="p-4 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="ios-card p-4 text-center min-h-[80px] flex flex-col justify-center">
              <p className="text-ios-title2 text-primary">{stats.campaigns}</p>
              <p className="text-ios-footnote text-muted-foreground mt-1">Campaigns</p>
            </div>
            <div className="ios-card p-4 text-center min-h-[80px] flex flex-col justify-center">
              <p className="text-ios-title2 text-ios-green">{stats.videos}</p>
              <p className="text-ios-footnote text-muted-foreground mt-1">Videos</p>
            </div>
            <div className="ios-card p-4 text-center min-h-[80px] flex flex-col justify-center">
              <p className="text-ios-title2 text-ios-orange">{stats.scheduled}</p>
              <p className="text-ios-footnote text-muted-foreground mt-1">Scheduled</p>
            </div>
          </div>

          {/* AI Branding Wizard Promo */}
          <Link to="/profile-assistant">
            <div className="ios-card p-4 bg-gradient-to-br from-primary/10 via-background to-secondary/30 border-primary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                <Sparkles className="w-12 h-12 text-primary rotate-12" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <div className="bg-primary/20 p-1 rounded-lg">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">New Feature</span>
                </div>
                <h3 className="text-ios-headline font-bold">AI Branding Wizard</h3>
                <p className="text-ios-caption text-muted-foreground max-w-[200px] mt-1">
                  Generate the perfect handle, bio, and content strategy for your brand.
                </p>
                <div className="mt-3 flex items-center text-xs font-semibold text-primary">
                  Try it now <ChevronRight className="w-3 h-3 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Campaigns List */}
          <div className="space-y-3">
            <h2 className="text-ios-title3 text-foreground px-1">Your Campaigns</h2>
            
            {campaigns.length > 0 ? (
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    id={campaign.id}
                    name={campaign.title}
                    videosCount={campaign.video_count || 0}
                    scheduledPosts={campaign.scheduled_count || 0}
                    status={campaign.status as 'active' | 'draft' | 'completed'}
                    createdAt={formatDate(campaign.created_at)}
                    pageNames={campaign.page_names}
                  />
                ))}
              </div>
            ) : (
              <div className="ios-card p-8 text-center">
                <p className="text-ios-body text-muted-foreground mb-4">
                  No campaigns yet. Create your first one!
                </p>
                <Link to="/campaign/new">
                  <IOSButton>
                    <Plus className="w-5 h-5 mr-2 inline" />
                    New Campaign
                  </IOSButton>
                </Link>
              </div>
            )}
          </div>

          {/* Create New Campaign Button */}
          {campaigns.length > 0 && (
            <Link to="/campaign/new" className="block">
              <IOSButton fullWidth size="lg">
                <Plus className="w-5 h-5 mr-2 inline" />
                Create New Campaign
              </IOSButton>
            </Link>
          )}
        </div>
      </PullToRefresh>

      <ConnectionSetupPopup
        isOpen={isSetupPopupOpen}
        onClose={() => setIsSetupPopupOpen(false)}
        onConnectFacebook={connectFacebook}
        onConnectYouTube={connectYouTube}
        onConnectGemini={() => navigate('/settings')}
        hasFacebook={fbPages.length > 0}
        hasInstagram={igAccounts.length > 0}
        hasYouTube={ytChannels.length > 0}
        hasGeminiKey={hasGeminiKey}
      />
    </AppLayout>
  );
}
