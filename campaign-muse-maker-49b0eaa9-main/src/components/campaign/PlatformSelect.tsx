import React, { useState } from 'react';
import { Facebook, Instagram, Youtube, Plus, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { FacebookPage, InstagramAccount, YouTubeChannel } from '@/hooks/usePlatformConnections';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface PlatformSelectProps {
  facebookPages: FacebookPage[];
  instagramAccounts: InstagramAccount[];
  youtubeChannels: YouTubeChannel[];
  selectedFacebookPageIds: string[];
  selectedInstagramAccountIds: string[];
  selectedYouTubeChannelIds: string[];
  onFacebookSelect: (ids: string[]) => void;
  onInstagramSelect: (ids: string[]) => void;
  onYouTubeSelect: (ids: string[]) => void;
  onConnectFacebook: () => void;
  onConnectYouTube: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function PlatformSelect({
  facebookPages,
  instagramAccounts,
  youtubeChannels,
  selectedFacebookPageIds,
  selectedInstagramAccountIds,
  selectedYouTubeChannelIds,
  onFacebookSelect,
  onInstagramSelect,
  onYouTubeSelect,
  onConnectFacebook,
  onConnectYouTube,
  onRefresh,
  loading,
}: PlatformSelectProps) {
  const [activeTab, setActiveTab] = useState('facebook');

  const toggleFacebook = (id: string) => {
    onFacebookSelect(
      selectedFacebookPageIds.includes(id)
        ? selectedFacebookPageIds.filter((i) => i !== id)
        : [...selectedFacebookPageIds, id]
    );
  };

  const toggleInstagram = (id: string) => {
    onInstagramSelect(
      selectedInstagramAccountIds.includes(id)
        ? selectedInstagramAccountIds.filter((i) => i !== id)
        : [...selectedInstagramAccountIds, id]
    );
  };

  const toggleYouTube = (id: string) => {
    onYouTubeSelect(
      selectedYouTubeChannelIds.includes(id)
        ? selectedYouTubeChannelIds.filter((i) => i !== id)
        : [...selectedYouTubeChannelIds, id]
    );
  };

  const totalSelected = selectedFacebookPageIds.length + selectedInstagramAccountIds.length + selectedYouTubeChannelIds.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <label className="text-ios-subhead text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
          Publishing Platforms
        </label>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-ios-caption text-primary flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            Sync All
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full bg-secondary/30 p-1 rounded-2xl h-12">
          <TabsTrigger value="facebook" className="rounded-xl flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Facebook className={cn('w-4 h-4', selectedFacebookPageIds.length > 0 ? 'text-[#1877F2]' : 'text-muted-foreground')} />
            <span className="text-xs font-medium">FB</span>
            {selectedFacebookPageIds.length > 0 && <span className="w-4 h-4 bg-primary text-[10px] text-white rounded-full flex items-center justify-center">{selectedFacebookPageIds.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="instagram" className="rounded-xl flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Instagram className={cn('w-4 h-4', selectedInstagramAccountIds.length > 0 ? 'text-[#E4405F]' : 'text-muted-foreground')} />
            <span className="text-xs font-medium">IG</span>
            {selectedInstagramAccountIds.length > 0 && <span className="w-4 h-4 bg-primary text-[10px] text-white rounded-full flex items-center justify-center">{selectedInstagramAccountIds.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="youtube" className="rounded-xl flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Youtube className={cn('w-4 h-4', selectedYouTubeChannelIds.length > 0 ? 'text-[#FF0000]' : 'text-muted-foreground')} />
            <span className="text-xs font-medium">YT</span>
            {selectedYouTubeChannelIds.length > 0 && <span className="w-4 h-4 bg-primary text-[10px] text-white rounded-full flex items-center justify-center">{selectedYouTubeChannelIds.length}</span>}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 min-h-[120px]">
          {/* Facebook */}
          <TabsContent value="facebook" className="mt-0 animate-in fade-in slide-in-from-left-2 duration-300">
            {facebookPages.length === 0 ? (
              <ConnectPlaceholder
                platform="Facebook"
                icon={<Facebook className="w-6 h-6 text-white" />}
                color="bg-[#1877F2]"
                onClick={onConnectFacebook}
                loading={loading}
              />
            ) : (
              <PlatformList
                items={facebookPages.map(p => ({ id: p.id, name: p.page_name, sub: `ID: ${p.page_id}` }))}
                selectedIds={selectedFacebookPageIds}
                onToggle={toggleFacebook}
                icon={<Facebook className="w-5 h-5 text-white" />}
                color="bg-[#1877F2]"
                onConnectMore={onConnectFacebook}
              />
            )}
          </TabsContent>

          {/* Instagram */}
          <TabsContent value="instagram" className="mt-0 animate-in fade-in slide-in-from-left-2 duration-300">
            {instagramAccounts.length === 0 ? (
              <ConnectPlaceholder
                platform="Instagram"
                icon={<Instagram className="w-6 h-6 text-white" />}
                color="bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]"
                onClick={onConnectFacebook} // Instagram is connected via Facebook
                description="Connect your Facebook page that has a linked Instagram business account."
                loading={loading}
              />
            ) : (
              <PlatformList
                items={instagramAccounts.map(a => ({ id: a.id, name: a.instagram_username, sub: `ID: ${a.instagram_account_id}` }))}
                selectedIds={selectedInstagramAccountIds}
                onToggle={toggleInstagram}
                icon={<Instagram className="w-5 h-5 text-white" />}
                color="bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]"
                onConnectMore={onConnectFacebook}
              />
            )}
          </TabsContent>

          {/* YouTube */}
          <TabsContent value="youtube" className="mt-0 animate-in fade-in slide-in-from-left-2 duration-300">
            {youtubeChannels.length === 0 ? (
              <ConnectPlaceholder
                platform="YouTube"
                icon={<Youtube className="w-6 h-6 text-white" />}
                color="bg-[#FF0000]"
                onClick={onConnectYouTube}
                loading={loading}
              />
            ) : (
              <PlatformList
                items={youtubeChannels.map(c => ({ id: c.id, name: c.channel_name, sub: `ID: ${c.channel_id}` }))}
                selectedIds={selectedYouTubeChannelIds}
                onToggle={toggleYouTube}
                icon={<Youtube className="w-5 h-5 text-white" />}
                color="bg-[#FF0000]"
                onConnectMore={onConnectYouTube}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
      
      {totalSelected === 0 && (
        <div className="flex items-center gap-2 p-3 bg-ios-orange/10 border border-ios-orange/20 rounded-2xl text-ios-orange">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-[11px] font-medium leading-tight">Please select at least one platform to publish your campaign.</p>
        </div>
      )}
    </div>
  );
}

function ConnectPlaceholder({ platform, icon, color, onClick, description, loading }: any) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="ios-card p-4 w-full flex items-center gap-4 hover:bg-secondary/40 transition-all active:scale-[0.98] duration-200"
    >
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg', color)}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className="text-ios-body font-semibold">Connect {platform}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          {description || `Add your ${platform} account to schedule and post videos.`}
        </p>
      </div>
      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
        <Plus className="w-4 h-4 text-primary" />
      </div>
    </button>
  );
}

function PlatformList({ items, selectedIds, onToggle, icon, color, onConnectMore }: any) {
  return (
    <div className="space-y-2">
      <div className="ios-card overflow-hidden divide-y divide-border/50">
        {items.map((item: any) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              className={cn(
                'p-3 w-full flex items-center gap-3 transition-all duration-200',
                isSelected ? 'bg-primary/5' : 'hover:bg-secondary/30'
              )}
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm', color)}>
                {icon}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{item.sub}</p>
              </div>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300',
                  isSelected
                    ? 'border-primary bg-primary shadow-sm shadow-primary/20 scale-110'
                    : 'border-muted-foreground/30'
                )}
              >
                {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>
      
      <button
        onClick={onConnectMore}
        className="text-[11px] font-bold text-primary flex items-center gap-1.5 px-1 py-1 hover:opacity-70 transition-opacity"
      >
        <Plus className="w-3 h-3" />
        Connect Another
      </button>
    </div>
  );
}
