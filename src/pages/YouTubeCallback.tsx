import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionError';

export default function YouTubeCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function exchangeToken() {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        setStatus('error');
        setError(errorDescription || errorParam);
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        const { data, error: functionError } = await supabase.functions.invoke('youtube-oauth', {
          body: {
            action: 'exchange-token',
            code,
            redirectUri: window.location.origin + '/youtube-callback',
            userId: user.id
          }
        });

        if (functionError) {
          throw new Error(await getEdgeFunctionErrorMessage(functionError, 'Failed to exchange token'));
        }
        if (data?.error) {
          throw new Error(data.error);
        }

        setStatus('success');
        toast({
          title: 'YouTube Connected!',
          description: `Successfully linked ${data.channels?.length || 0} channels.`,
        });

        setTimeout(() => navigate('/settings'), 2000);
      } catch (err) {
        console.error('YouTube OAuth error:', err);
        setStatus('error');
        const friendlyError = await getEdgeFunctionErrorMessage(err, 'Unknown error');
        setError(friendlyError);
      }
    }

    exchangeToken();
  }, [searchParams, navigate]);

  return (
    <AppLayout title="YouTube Connection">
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <h1 className="text-2xl font-bold">Connecting YouTube...</h1>
            <p className="text-muted-foreground mt-2">Please wait while we link your account.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h1 className="text-2xl font-bold">Successfully Connected!</h1>
            <p className="text-muted-foreground mt-2">Your YouTube channels are now linked. Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold">Connection Failed</h1>
            <p className="text-destructive mt-2">{error}</p>
            <button 
              onClick={() => navigate('/settings')}
              className="mt-6 px-6 py-2 bg-primary text-white rounded-full font-medium"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </AppLayout>
  );
}
