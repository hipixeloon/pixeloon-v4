import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FacebookPage, usePlatformConnections } from '@/hooks/usePlatformConnections';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { IOSButton } from '@/components/ui/IOSButton';

export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [connectedPages, setConnectedPages] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  const { handleFacebookCallback } = usePlatformConnections(userId || undefined);

  useEffect(() => {
    async function processCallback() {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        toast({
          title: 'Connection Failed',
          description: searchParams.get('error_description') || 'Failed to connect Facebook',
          variant: 'destructive',
        });
        return;
      }

      if (code) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not logged in');
          setUserId(user.id);
          
          const pages = await handleFacebookCallback(code);
          if (pages && pages.length > 0) {
            setStatus('success');
            setConnectedPages((pages as FacebookPage[]).map((p) => p.page_name));
            toast({
              title: 'Facebook Connected!',
              description: `Connected ${pages.length} page(s) successfully.`,
            });
          } else {
            throw new Error('No Facebook pages were found for your account.');
          }
        } catch (err) {
          console.error('FB Callback error:', err);
          setStatus('error');
          toast({
            title: 'Connection Error',
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          });
        }
      } else {
        setStatus('error');
      }
    }

    processCallback();
  }, [searchParams, handleFacebookCallback]);

  return (
    <AppLayout title="Facebook Connection">
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
            <h2 className="text-ios-title2 text-foreground mb-2">Connecting Facebook...</h2>
            <p className="text-ios-body text-muted-foreground">
              Please wait while we connect your Facebook pages.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-ios-green mb-4" />
            <h2 className="text-ios-title2 text-foreground mb-2">Successfully Connected!</h2>
            <p className="text-ios-body text-muted-foreground mb-4">
              {connectedPages.length} page(s) connected:
            </p>
            <div className="space-y-2 mb-6">
              {connectedPages.map((name, i) => (
                <div key={i} className="ios-card px-4 py-2 text-foreground">
                  {name}
                </div>
              ))}
            </div>
            <IOSButton onClick={() => navigate('/campaign/new')}>
              Create Campaign
            </IOSButton>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-ios-title2 text-foreground mb-2">Connection Failed</h2>
            <p className="text-ios-body text-muted-foreground mb-6">
              Something went wrong while connecting to Facebook.
            </p>
            <div className="space-y-3">
              <IOSButton onClick={() => navigate('/settings')}>
                Try Again in Settings
              </IOSButton>
              <IOSButton variant="secondary" onClick={() => navigate('/')}>
                Go to Dashboard
              </IOSButton>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
