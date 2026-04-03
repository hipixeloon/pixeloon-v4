import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FacebookPage {
  id: string;
  page_id: string;
  page_name: string;
}

export interface InstagramAccount {
  id: string;
  instagram_account_id: string;
  instagram_username: string;
  facebook_page_id: string;
}

export interface YouTubeChannel {
  id: string;
  channel_id: string;
  channel_name: string;
}

export interface FacebookSyncDebug {
  meAccountsCount: number;
  meAccountsError: string | null;
  businessesCount: number;
  businessesError: string | null;
  ownedPagesCount: number;
  ownedPagesErrors: string[];
  totalBeforeDedup: number;
  totalAfterDedup: number;
}

export function usePlatformConnections(userId: string | undefined) {
  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  const [ytChannels, setYtChannels] = useState<YouTubeChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncDebug, setLastSyncDebug] = useState<FacebookSyncDebug | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const [fbRes, igRes, ytRes] = await Promise.all([
        supabase.from('facebook_pages').select('id, page_id, page_name').eq('user_id', userId),
        supabase.from('instagram_accounts').select('id, instagram_account_id, instagram_username, facebook_page_id').eq('user_id', userId),
        supabase.from('youtube_channels').select('id, channel_id, channel_name').eq('user_id', userId)
      ]);

      if (fbRes.error) throw fbRes.error;
      if (igRes.error) throw igRes.error;
      if (ytRes.error) throw ytRes.error;

      setFbPages(fbRes.data || []);
      setIgAccounts(igRes.data || []);
      setYtChannels(ytRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch platform connections');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const connectYouTube = useCallback(async () => {
    if (!userId) return;
    try {
      const redirectUri = `${window.location.origin}/youtube-callback`;
      const { data, error: fnError } = await supabase.functions.invoke('youtube-oauth', {
        body: { action: 'get-auth-url', redirect_uri: redirectUri, userId }
      });
      if (fnError || data.error) throw new Error(data?.error || fnError?.message);
      if (data.authUrl) window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start YouTube connection');
    }
  }, [userId]);

  const connectFacebook = useCallback(async () => {
    if (!userId) return;
    try {
      const redirectUri = `${window.location.origin}/facebook-callback`;
      const { data, error: fnError } = await supabase.functions.invoke('facebook-oauth', {
        body: { action: 'get-auth-url', redirect_uri: redirectUri, userId }
      });
      if (fnError || data.error) throw new Error(data?.error || fnError?.message);
      if (data.authUrl) window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Facebook connection');
    }
  }, [userId]);

  const handleFacebookCallback = useCallback(async (code: string) => {
    if (!userId) return null;
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/facebook-callback`;
      const { data, error: fnError } = await supabase.functions.invoke('facebook-oauth', {
        body: { action: 'exchange-token', code, redirectUri, userId }
      });

      if (fnError || data.error) throw new Error(data?.error || fnError?.message);
      
      if (data.debug) setLastSyncDebug(data.debug);
      
      if (data.pages) {
        const pages = data.pages.fbPages || [];
        setFbPages(pages);
        return pages;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete Facebook connection');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleYouTubeCallback = useCallback(async (code: string) => {
    if (!userId) return null;
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/youtube-callback`;
      const { data, error: fnError } = await supabase.functions.invoke('youtube-oauth', {
        body: { action: 'exchange-token', code, redirectUri, userId }
      });

      if (fnError || data.error) throw new Error(data?.error || fnError?.message);
      
      if (data.channels) {
        setYtChannels(data.channels);
        return data.channels;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete YouTube connection');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const syncFacebookPages = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('facebook-oauth', {
        body: { action: 'sync-pages', userId }
      });

      if (fnError || data.error) throw new Error(data?.error || fnError?.message);
      if (data.debug) setLastSyncDebug(data.debug);
      if (data.pages?.fbPages) setFbPages(data.pages.fbPages);
      
      return data.pages?.fbPages || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync Facebook pages');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    fbPages,
    igAccounts,
    ytChannels,
    loading,
    error,
    lastSyncDebug,
    refetch: fetchConnections,
    connectYouTube,
    connectFacebook,
    handleFacebookCallback,
    handleYouTubeCallback,
    syncFacebookPages
  };
}
