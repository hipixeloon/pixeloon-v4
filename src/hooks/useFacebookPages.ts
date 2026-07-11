import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FacebookPage {
  id: string;
  page_id: string;
  page_name: string;
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useFacebookPages(userId: string | undefined) {
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncDebug, setLastSyncDebug] = useState<FacebookSyncDebug | null>(null);

  const fetchPages = useCallback(async () => {
    if (!userId) return;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      setPages([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('facebook_pages')
        .select('id, page_id, page_name')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;
      setPages(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pages');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const connectFacebook = useCallback(async () => {
    if (!userId) {
      setError('Please log in to connect Facebook');
      return;
    }

    try {
      localStorage.setItem('fb_connect_user_id', userId);
      const redirectUri = `${window.location.origin}/facebook-callback`;

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/facebook-oauth?action=get-auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`,
        {
          method: 'GET',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Facebook connection');
    }
  }, [userId]);

  const handleOAuthCallback = useCallback(async (code: string) => {
    const storedUserId = localStorage.getItem('fb_connect_user_id');
    if (!storedUserId) {
      setError('Session expired. Please try again.');
      return null;
    }

    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/facebook-callback`;

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/facebook-oauth?action=exchange-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            code,
            redirectUri,
            userId: storedUserId,
          }),
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      localStorage.removeItem('fb_connect_user_id');

      if (data.debug) {
        setLastSyncDebug(data.debug);
      }

      if (data.pages) {
        setPages(data.pages);
        return data.pages;
      }

      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete Facebook connection');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync pages from Facebook (not just refetch from DB)
  const syncPages = useCallback(async () => {
    if (!userId) {
      setError('Please log in to sync pages');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('facebook-oauth', {
        body: { action: 'sync-pages', userId },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (data?.debug) {
        setLastSyncDebug(data.debug);
      }

      if (data?.pages) {
        setPages(data.pages);
      }

      return data?.pages || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync pages');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    pages,
    loading,
    error,
    connectFacebook,
    handleOAuthCallback,
    refetch: fetchPages,
    syncPages,
    lastSyncDebug,
  };
}
