import { AppLayout } from '@/components/layout/AppLayout';
import { IOSSwitch } from '@/components/ui/IOSSwitch';
import { IOSButton } from '@/components/ui/IOSButton';
import { IOSInput } from '@/components/ui/IOSInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Moon, Sun, Facebook, LogOut, RefreshCw, Bug, CheckCircle, XCircle, Key, Eye, EyeOff, Loader2, Lock, Youtube, Instagram, ExternalLink } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { usePlatformConnections } from '@/hooks/usePlatformConnections';
import { supabase } from '@/integrations/supabase/client';

const getSafeHttpUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const MASKED_CREDENTIAL = '••••••••••••••••';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [autoPost, setAutoPost] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
  // Gemini API key state
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [facebookAppId, setFacebookAppId] = useState('');
  const [facebookAppSecret, setFacebookAppSecret] = useState('');
  const [youtubeClientId, setYouTubeClientId] = useState('');
  const [youtubeClientSecret, setYouTubeClientSecret] = useState('');
  const [driveServiceEmail, setDriveServiceEmail] = useState('');
  const [driveServicePrivateKey, setDriveServicePrivateKey] = useState('');
  const [savingOAuthKeys, setSavingOAuthKeys] = useState(false);
  const [watermarkImageUrl, setWatermarkImageUrl] = useState('');
  const [savingWatermarkUrl, setSavingWatermarkUrl] = useState(false);
  
  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const safeWatermarkPreviewUrl = getSafeHttpUrl(watermarkImageUrl);
  
  const { 
    fbPages, 
    igAccounts, 
    ytChannels, 
    connectYouTube, 
    connectFacebook, 
    syncFacebookPages: syncPages, 
    lastSyncDebug, 
    error: fbError,
    loading: platformLoading 
  } = usePlatformConnections(user?.id);

  const fetchGeminiKey = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('key_name', 'gemini')
      .single();
    
    if (data) {
      setHasGeminiKey(true);
      setGeminiKey(MASKED_CREDENTIAL);
    } else {
      setHasGeminiKey(false);
      setGeminiKey('');
    }
  }, [user]);

  const fetchOAuthKeys = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_api_keys')
      .select('key_name, api_key')
      .eq('user_id', user.id)
      .in('key_name', ['facebook_app_id', 'facebook_app_secret', 'youtube_client_id', 'youtube_client_secret', 'google_service_account_email', 'google_service_account_private_key']);

    const map = new Map((data || []).map((item) => [item.key_name, item.api_key]));
    setFacebookAppId(map.get('facebook_app_id') ? MASKED_CREDENTIAL : '');
    setFacebookAppSecret(map.get('facebook_app_secret') ? MASKED_CREDENTIAL : '');
    setYouTubeClientId(map.get('youtube_client_id') ? MASKED_CREDENTIAL : '');
    setYouTubeClientSecret(map.get('youtube_client_secret') ? MASKED_CREDENTIAL : '');
    setDriveServiceEmail(map.get('google_service_account_email') || '');
    setDriveServicePrivateKey(map.get('google_service_account_private_key') ? MASKED_CREDENTIAL : '');
  }, [user]);

  const fetchWatermarkUrl = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('watermark_image_path')
      .eq('user_id', user.id)
      .single();

    setWatermarkImageUrl(data?.watermark_image_path || '');
  }, [user]);

  // Fetch existing settings
  useEffect(() => {
    if (user) {
      void fetchGeminiKey();
      void fetchOAuthKeys();
      void fetchWatermarkUrl();
    }
  }, [user, fetchGeminiKey, fetchOAuthKeys, fetchWatermarkUrl]);

  const handleSaveGeminiKey = async () => {
    if (!user || !geminiKey || geminiKey === MASKED_CREDENTIAL) return;
    
    setSavingKey(true);
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .upsert({
          user_id: user.id,
          key_name: 'gemini',
          api_key: geminiKey,
        }, { onConflict: 'user_id,key_name' });
      
      if (error) throw error;
      
      setHasGeminiKey(true);
      setGeminiKey(MASKED_CREDENTIAL);
      setShowGeminiKey(false);
      toast({ title: 'Gemini API key saved successfully' });
    } catch (err) {
      toast({ title: 'Failed to save API key', variant: 'destructive' });
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteGeminiKey = async () => {
    if (!user) return;
    
    setSavingKey(true);
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', user.id)
        .eq('key_name', 'gemini');
      
      if (error) throw error;
      
      setHasGeminiKey(false);
      setGeminiKey('');
      toast({ title: 'Gemini API key removed' });
    } catch (err) {
      toast({ title: 'Failed to remove API key', variant: 'destructive' });
    } finally {
      setSavingKey(false);
    }
  };

  const handleSaveOAuthKeys = async () => {
    if (!user) return;
    setSavingOAuthKeys(true);

    try {
      const updates: Array<{ key_name: string; api_key: string }> = [];
      const cleanFacebookAppId = facebookAppId.trim();
      const cleanFacebookAppSecret = facebookAppSecret.trim();
      const cleanYouTubeClientId = youtubeClientId.trim();
      const cleanYouTubeClientSecret = youtubeClientSecret.trim();

      if (cleanFacebookAppId && cleanFacebookAppId !== MASKED_CREDENTIAL) updates.push({ key_name: 'facebook_app_id', api_key: cleanFacebookAppId });
      if (cleanFacebookAppSecret && cleanFacebookAppSecret !== MASKED_CREDENTIAL) updates.push({ key_name: 'facebook_app_secret', api_key: cleanFacebookAppSecret });
      if (cleanYouTubeClientId && cleanYouTubeClientId !== MASKED_CREDENTIAL) updates.push({ key_name: 'youtube_client_id', api_key: cleanYouTubeClientId });
      if (cleanYouTubeClientSecret && cleanYouTubeClientSecret !== MASKED_CREDENTIAL) updates.push({ key_name: 'youtube_client_secret', api_key: cleanYouTubeClientSecret });

      const cleanDriveEmail = driveServiceEmail.trim();
      const cleanDrivePrivateKey = driveServicePrivateKey.trim();
      if (cleanDriveEmail && cleanDriveEmail !== MASKED_CREDENTIAL) updates.push({ key_name: 'google_service_account_email', api_key: cleanDriveEmail });
      if (cleanDrivePrivateKey && cleanDrivePrivateKey !== MASKED_CREDENTIAL) updates.push({ key_name: 'google_service_account_private_key', api_key: cleanDrivePrivateKey });

      if (updates.length === 0) {
        toast({ title: 'No new OAuth credentials to save' });
        return;
      }

      const rows = updates.map((item) => ({ user_id: user.id, key_name: item.key_name, api_key: item.api_key }));
      const { error } = await supabase.from('user_api_keys').upsert(rows, { onConflict: 'user_id,key_name' });
      if (error) throw error;

      toast({ title: 'OAuth credentials saved' });
      await fetchOAuthKeys();
    } catch {
      toast({ title: 'Failed to save OAuth credentials', variant: 'destructive' });
    } finally {
      setSavingOAuthKeys(false);
    }
  };

  const handleSaveWatermarkUrl = async () => {
    if (!user) return;
    const cleanUrl = watermarkImageUrl.trim();
    if (!cleanUrl) {
      toast({ title: 'Enter a watermark image URL', variant: 'destructive' });
      return;
    }
    const normalizedUrl = getSafeHttpUrl(cleanUrl);
    if (!normalizedUrl) {
      toast({ title: 'Invalid URL format', variant: 'destructive' });
      return;
    }

    setSavingWatermarkUrl(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ watermark_image_path: normalizedUrl })
        .eq('user_id', user.id);
      if (profileError) throw profileError;

      toast({ title: 'Watermark image URL saved' });
    } catch {
      toast({ title: 'Failed to save watermark URL', variant: 'destructive' });
    } finally {
      setSavingWatermarkUrl(false);
    }
  };

  const handleClearWatermarkUrl = async () => {
    if (!user) return;
    setSavingWatermarkUrl(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ watermark_image_path: null })
        .eq('user_id', user.id);
      if (error) throw error;
      setWatermarkImageUrl('');
      toast({ title: 'Watermark URL cleared' });
    } catch {
      toast({ title: 'Failed to clear watermark URL', variant: 'destructive' });
    } finally {
      setSavingWatermarkUrl(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
    toast({ title: 'Logged out successfully' });
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({ title: 'New passwords do not match', variant: 'destructive' });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated successfully' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Please try again';
      toast({ 
        title: 'Failed to update password', 
        description: errorMessage,
        variant: 'destructive' 
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRefreshPages = async () => {
    setRefreshing(true);
    try {
      await syncPages();
      toast({ title: 'Pages synced from Facebook successfully' });
    } catch {
      toast({ title: 'Failed to sync pages', variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  const isMaskedCredential = (value: string) => value.trim() === MASKED_CREDENTIAL;
  const hasFacebookOAuthConfigured =
    (!!facebookAppId.trim() && !!facebookAppSecret.trim()) ||
    (isMaskedCredential(facebookAppId) && isMaskedCredential(facebookAppSecret));
  const hasYouTubeOAuthConfigured =
    (!!youtubeClientId.trim() && !!youtubeClientSecret.trim()) ||
    (isMaskedCredential(youtubeClientId) && isMaskedCredential(youtubeClientSecret));

  const handleConnectFacebookClick = () => {
    if (!hasFacebookOAuthConfigured) {
      toast({
        title: 'Facebook setup required',
        description: 'Save Facebook App ID and Secret in OAuth App Credentials first, then tap Connect again.',
        variant: 'destructive',
      });
      return;
    }
    void connectFacebook();
  };

  const handleConnectYouTubeClick = () => {
    if (!hasYouTubeOAuthConfigured) {
      toast({
        title: 'YouTube setup required',
        description: 'Save YouTube Client ID and Client Secret in OAuth App Credentials first, then tap Connect again.',
        variant: 'destructive',
      });
      return;
    }
    void connectYouTube();
  };

  return (
    <AppLayout title="Settings">
      <div className="p-4 space-y-6">
        {/* Appearance */}
        <section className="space-y-3">
          <h2 className="text-ios-subhead text-muted-foreground uppercase tracking-wide px-1">
            Appearance
          </h2>
          <div className="ios-section">
            <div className="ios-list-item">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon className="w-5 h-5 text-primary" />
                ) : (
                  <Sun className="w-5 h-5 text-ios-orange" />
                )}
                <span className="text-ios-body text-foreground">Dark Mode</span>
              </div>
              <button
                onClick={toggleTheme}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  theme === 'dark' ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 bg-card rounded-full shadow transition-transform ${
                    theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* API Keys */}
        <section className="space-y-3">
          <h2 className="text-ios-subhead text-muted-foreground uppercase tracking-wide px-1">
            API Keys
          </h2>
          <div className="ios-section p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-primary" />
                <span className="text-ios-body text-foreground">Gemini API Key</span>
              </div>
              <p className="text-ios-caption text-muted-foreground mb-3">
                Your Gemini API key is required for AI caption generation. Get one free from{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Google AI Studio
                </a>
                . Without it, posts will use a basic fallback caption.
              </p>
              <div className="relative">
                  <IOSInput
                    type={showGeminiKey ? 'text' : 'password'}
                    placeholder="Enter your Gemini API key"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    onFocus={() => {
                      if (geminiKey === MASKED_CREDENTIAL) {
                        setGeminiKey('');
                      }
                    }}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-2 hover:bg-secondary rounded-lg transition-colors"
                  >
                    {showGeminiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              <div className="flex flex-wrap gap-3 mt-4">
                <IOSButton
                  onClick={handleSaveGeminiKey}
                  disabled={savingKey || !geminiKey || geminiKey === MASKED_CREDENTIAL}
                  size="md"
                >
                  {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Key'}
                </IOSButton>
                {hasGeminiKey && (
                  <IOSButton
                    variant="secondary"
                    onClick={handleDeleteGeminiKey}
                    disabled={savingKey}
                    size="md"
                  >
                    Remove
                  </IOSButton>
                )}
              </div>
              {hasGeminiKey && (
                <p className="text-ios-caption text-ios-green mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Your API key is configured
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-ios-subhead text-muted-foreground uppercase tracking-wide px-1">
            OAuth App Credentials
          </h2>
          <div className="ios-section p-4 space-y-4">
            <p className="text-ios-caption text-muted-foreground">
              These credentials are used by Facebook/Instagram and YouTube Edge Functions for your account only.
            </p>
            <IOSInput
              placeholder="Facebook App ID"
              value={facebookAppId}
              onChange={(e) => setFacebookAppId(e.target.value)}
              onFocus={() => facebookAppId === MASKED_CREDENTIAL && setFacebookAppId('')}
            />
            <IOSInput
              type="password"
              placeholder="Facebook App Secret"
              value={facebookAppSecret}
              onChange={(e) => setFacebookAppSecret(e.target.value)}
              onFocus={() => facebookAppSecret === MASKED_CREDENTIAL && setFacebookAppSecret('')}
            />
            <IOSInput
              placeholder="YouTube OAuth Client ID"
              value={youtubeClientId}
              onChange={(e) => setYouTubeClientId(e.target.value)}
              onFocus={() => youtubeClientId === MASKED_CREDENTIAL && setYouTubeClientId('')}
            />
            <IOSInput
              type="password"
              placeholder="YouTube OAuth Client Secret"
              value={youtubeClientSecret}
              onChange={(e) => setYouTubeClientSecret(e.target.value)}
              onFocus={() => youtubeClientSecret === MASKED_CREDENTIAL && setYouTubeClientSecret('')}
            />
            <p className="text-ios-caption text-muted-foreground pt-2">
              Google Drive service account — required for reading your campaign videos. Paste the
              client_email and private_key from the service account's JSON key file, and share your
              Drive folders with the service account email.
            </p>
            <IOSInput
              placeholder="Service Account Email (…@….iam.gserviceaccount.com)"
              value={driveServiceEmail}
              onChange={(e) => setDriveServiceEmail(e.target.value)}
            />
            <textarea
              placeholder={'Service Account Private Key\n-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
              value={driveServicePrivateKey}
              onChange={(e) => setDriveServicePrivateKey(e.target.value)}
              onFocus={() => driveServicePrivateKey === MASKED_CREDENTIAL && setDriveServicePrivateKey('')}
              rows={4}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            />
            <IOSButton onClick={handleSaveOAuthKeys} disabled={savingOAuthKeys}>
              {savingOAuthKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save OAuth Credentials'}
            </IOSButton>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-ios-subhead text-muted-foreground uppercase tracking-wide px-1">
            Watermark Image
          </h2>
          <div className="ios-section p-4 space-y-4">
            <p className="text-ios-caption text-muted-foreground">
              Use a direct JPG/PNG image URL (for example, Blogger-hosted). Auto-poster will load this URL directly.
            </p>
            <IOSInput
              type="url"
              placeholder="https://example.com/watermark.jpg"
              value={watermarkImageUrl}
              onChange={(e) => setWatermarkImageUrl(e.target.value)}
            />
            <div className="flex gap-3">
              <IOSButton size="md" onClick={handleSaveWatermarkUrl} disabled={savingWatermarkUrl}>
                {savingWatermarkUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save URL'}
              </IOSButton>
              <IOSButton size="md" variant="secondary" onClick={handleClearWatermarkUrl} disabled={savingWatermarkUrl || !watermarkImageUrl}>
                Clear
              </IOSButton>
            </div>
            {safeWatermarkPreviewUrl && (
              <img src={safeWatermarkPreviewUrl} alt="Watermark preview" className="w-full max-w-[220px] rounded-lg border border-border" />
            )}
          </div>
        </section>

        {/* Connections */}
        <section className="space-y-3">
          <h2 className="text-ios-subhead text-muted-foreground uppercase tracking-wide px-1">
            Connections
          </h2>
          <div className="ios-section">
            <div className="ios-list-item">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1877F2] rounded-lg flex items-center justify-center">
                  <Facebook className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-ios-body text-foreground">Facebook Pages</p>
                  <p className="text-ios-caption text-muted-foreground">
                    {fbPages.length > 0 ? `${fbPages.length} connected` : 'Not connected'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {fbPages.length > 0 && (
                  <button
                    onClick={handleRefreshPages}
                    disabled={refreshing}
                    className="p-2.5 rounded-xl hover:bg-secondary/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Sync pages"
                  >
                    <RefreshCw className={`w-5 h-5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <IOSButton
                  variant={fbPages.length > 0 ? 'secondary' : 'primary'}
                  size="md"
                  onClick={handleConnectFacebookClick}
                >
                  {fbPages.length > 0 ? 'Add More' : 'Connect'}
                </IOSButton>
              </div>
            </div>

            <div className="ios-list-item">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-ios-body text-foreground">Instagram Accounts</p>
                  <p className="text-ios-caption text-muted-foreground">
                    {igAccounts.length > 0 ? `${igAccounts.length} accounts found` : 'Connected via Facebook'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {igAccounts.length > 0 ? (
                  <span className="text-xs text-ios-green font-medium flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <IOSButton variant="secondary" size="md" onClick={handleConnectFacebookClick}>
                    Verify IG
                  </IOSButton>
                )}
              </div>
            </div>

            <div className="ios-list-item">
               <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#FF0000] rounded-lg flex items-center justify-center">
                  <Youtube className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-ios-body text-foreground">YouTube Channels</p>
                  <p className="text-ios-caption text-muted-foreground">
                    {ytChannels.length > 0 ? `${ytChannels.length} channels connected` : 'Not connected'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <IOSButton
                  variant={ytChannels.length > 0 ? 'secondary' : 'primary'}
                  size="md"
                  onClick={handleConnectYouTubeClick}
                  disabled={platformLoading}
                >
                  {platformLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (ytChannels.length > 0 ? 'Add More' : 'Connect')}
                </IOSButton>
              </div>
            </div>
            
            {/* Debug Toggle */}
            <div className="ios-list-item">
              <div className="flex items-center gap-3">
                <Bug className="w-5 h-5 text-muted-foreground" />
                <span className="text-ios-body text-foreground">Show Debug Info</span>
              </div>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  showDebug ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 bg-card rounded-full shadow transition-transform ${
                    showDebug ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
          
          {/* Debug Panel */}
          {showDebug && (
            <div className="ios-section p-4 space-y-3">
              <h3 className="text-ios-subhead text-foreground font-medium">Facebook Sync Debug</h3>
              
              {fbError && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-ios-caption text-destructive">{fbError}</p>
                </div>
              )}
              
              {lastSyncDebug ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      {lastSyncDebug.meAccountsError ? (
                        <XCircle className="w-4 h-4 text-destructive" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-ios-green" />
                      )}
                      <span className="text-ios-caption text-foreground">/me/accounts</span>
                    </div>
                    <span className="text-ios-caption font-mono text-muted-foreground">
                      {lastSyncDebug.meAccountsError || `${lastSyncDebug.meAccountsCount} pages`}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      {lastSyncDebug.businessesError ? (
                        <XCircle className="w-4 h-4 text-ios-orange" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-ios-green" />
                      )}
                      <span className="text-ios-caption text-foreground">/me/businesses</span>
                    </div>
                    <span className="text-ios-caption font-mono text-muted-foreground">
                      {lastSyncDebug.businessesError || `${lastSyncDebug.businessesCount} businesses`}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      {lastSyncDebug.ownedPagesErrors.length > 0 ? (
                        <XCircle className="w-4 h-4 text-ios-orange" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-ios-green" />
                      )}
                      <span className="text-ios-caption text-foreground">owned_pages</span>
                    </div>
                    <span className="text-ios-caption font-mono text-muted-foreground">
                      {lastSyncDebug.ownedPagesCount} pages
                    </span>
                  </div>
                  
                  {lastSyncDebug.ownedPagesErrors.length > 0 && (
                    <div className="p-2 bg-ios-orange/10 rounded-lg">
                      <p className="text-ios-caption text-ios-orange">
                        {lastSyncDebug.ownedPagesErrors.join(', ')}
                      </p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-border space-y-1">
                    <div className="flex justify-between text-ios-caption">
                      <span className="text-muted-foreground">Total before dedup:</span>
                      <span className="font-mono text-foreground">{lastSyncDebug.totalBeforeDedup}</span>
                    </div>
                    <div className="flex justify-between text-ios-caption">
                      <span className="text-muted-foreground">Total after dedup:</span>
                      <span className="font-mono text-foreground font-medium">{lastSyncDebug.totalAfterDedup}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-ios-caption text-muted-foreground">
                  No sync data yet. Click the sync button to fetch debug info.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Security */}
        <section className="space-y-3">
          <h2 className="text-ios-subhead text-muted-foreground uppercase tracking-wide px-1">
            Security
          </h2>
          <div className="ios-section p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-primary" />
                <span className="text-ios-body text-foreground">Change Password</span>
              </div>
              <p className="text-ios-caption text-muted-foreground mb-3">
                Update your account password
              </p>
              
              <div className="space-y-3">
                <div className="relative">
                  <IOSInput
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-2 hover:bg-secondary rounded-lg transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                <IOSInput
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              
              <div className="flex flex-wrap gap-3 mt-4">
                <IOSButton
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  size="md"
                >
                  {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
                </IOSButton>
              </div>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="space-y-3">
          <h2 className="text-ios-subhead text-muted-foreground uppercase tracking-wide px-1">
            Preferences
          </h2>
          <div className="ios-section">
            <IOSSwitch
              checked={notifications}
              onCheckedChange={setNotifications}
              label="Push Notifications"
              description="Get notified about scheduled posts"
            />
            <IOSSwitch
              checked={autoPost}
              onCheckedChange={setAutoPost}
              label="Auto-Post"
              description="Automatically post at scheduled times"
            />
          </div>
        </section>

        {/* About */}
        <section className="space-y-3">
          <h2 className="text-ios-subhead text-muted-foreground uppercase tracking-wide px-1">
            About
          </h2>
          <div className="ios-section">
            <div className="ios-list-item">
              <span className="text-ios-body text-foreground">Version</span>
              <span className="text-ios-body text-muted-foreground">1.0.0</span>
            </div>
            <div className="ios-list-item">
              <span className="text-ios-body text-foreground">Account</span>
              <span className="text-ios-body text-muted-foreground truncate max-w-[180px]">
                {user?.email}
              </span>
            </div>
          </div>
        </section>

        {/* Logout */}
        <section className="pt-4">
          <IOSButton variant="secondary" fullWidth onClick={handleLogout}>
            <LogOut className="w-5 h-5 mr-2" />
            Log Out
          </IOSButton>
        </section>
      </div>
    </AppLayout>
  );
}
