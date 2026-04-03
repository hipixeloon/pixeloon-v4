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
  
  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
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

  // Fetch existing Gemini API key
  useEffect(() => {
    if (user) {
      fetchGeminiKey();
    }
  }, [user]);

  const fetchGeminiKey = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('key_name', 'gemini')
      .single();
    
    if (data) {
      setHasGeminiKey(true);
      setGeminiKey('••••••••••••••••');
    }
  };

  const handleSaveGeminiKey = async () => {
    if (!user || !geminiKey || geminiKey === '••••••••••••••••') return;
    
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
      setGeminiKey('••••••••••••••••');
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
    } catch (err: any) {
      toast({ 
        title: 'Failed to update password', 
        description: err.message || 'Please try again',
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
                      if (geminiKey === '••••••••••••••••') {
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
                  disabled={savingKey || !geminiKey || geminiKey === '••••••••••••••••'}
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
                  onClick={connectFacebook}
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
                  <IOSButton variant="secondary" size="md" onClick={connectFacebook}>
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
                  onClick={connectYouTube}
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