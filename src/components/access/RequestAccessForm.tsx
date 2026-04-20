import { useState } from 'react';
import { Send, Clock, CheckCircle, XCircle, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function RequestAccessForm() {
  const { user } = useAuth();
  const { accessRequest, requestAccess, refetch } = usePermissions(user?.id);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please provide a reason for your request');
      return;
    }

    setSubmitting(true);
    const { error } = await requestAccess(reason.trim());
    setSubmitting(false);

    if (error) {
      toast.error(error);
    } else {
      toast.success('Access request submitted successfully');
      setReason('');
      refetch();
    }
  };

  // Show existing request status
  if (accessRequest) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          {accessRequest.status === 'pending' && (
            <>
              <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
              <CardTitle>Request Pending</CardTitle>
              <CardDescription>
                Your access request is being reviewed by an administrator.
              </CardDescription>
            </>
          )}
          {accessRequest.status === 'approved' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <CardTitle>Request Approved</CardTitle>
              <CardDescription>
                Your request has been approved! Please refresh the page.
              </CardDescription>
            </>
          )}
          {accessRequest.status === 'rejected' && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
              <CardTitle>Request Rejected</CardTitle>
              <CardDescription>
                Unfortunately, your request was not approved.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={
                accessRequest.status === 'approved'
                  ? 'default'
                  : accessRequest.status === 'rejected'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {accessRequest.status}
            </Badge>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Your reason:</span>
            <p className="mt-1 p-2 bg-muted rounded-md">{accessRequest.reason}</p>
          </div>
          {accessRequest.review_notes && (
            <div className="text-sm">
              <span className="text-muted-foreground">Admin notes:</span>
              <p className="mt-1 p-2 bg-muted rounded-md">{accessRequest.review_notes}</p>
            </div>
          )}
          {accessRequest.status === 'rejected' && (
            <Button
              onClick={() => {
                // Allow resubmission after rejection
                setReason('');
              }}
              variant="outline"
              className="w-full"
            >
              Submit New Request
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
        <CardTitle>Request Creator Access</CardTitle>
        <CardDescription>
          You currently have view-only access. Request creator permissions to create campaigns and
          schedule posts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Why do you need creator access?</Label>
            <Textarea
              id="reason"
              placeholder="Describe your use case and why you need to create campaigns..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
          </div>
          <Button type="submit" className="w-full" disabled={submitting || !reason.trim()}>
            <Send className="w-4 h-4 mr-2" />
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
