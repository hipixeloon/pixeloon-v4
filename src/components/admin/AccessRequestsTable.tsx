import { useState } from 'react';
import { format } from 'date-fns';
import { Check, X, Clock, User, Ban } from 'lucide-react';
import { AccessRequest } from '@/hooks/useAdminPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface AccessRequestsTableProps {
  requests: AccessRequest[];
  onApprove: (requestId: string, userId: string, notes?: string) => Promise<void>;
  onReject: (requestId: string, notes?: string) => Promise<void>;
  onRevoke?: (requestId: string, userId: string, notes?: string) => Promise<void>;
}

export function AccessRequestsTable({ requests, onApprove, onReject, onRevoke }: AccessRequestsTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | 'revoke'>('approve');
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleAction = (request: AccessRequest, action: 'approve' | 'reject' | 'revoke') => {
    setSelectedRequest(request);
    setDialogAction(action);
    setNotes('');
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedRequest) return;
    
    setProcessing(true);
    try {
      if (dialogAction === 'approve') {
        await onApprove(selectedRequest.id, selectedRequest.user_id, notes || undefined);
      } else if (dialogAction === 'reject') {
        await onReject(selectedRequest.id, notes || undefined);
      } else if (dialogAction === 'revoke' && onRevoke) {
        await onRevoke(selectedRequest.id, selectedRequest.user_id, notes || undefined);
      }
      setDialogOpen(false);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-500"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'revoked':
        return <Badge variant="outline" className="border-orange-500 text-orange-500"><Ban className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const processedRequests = requests.filter((r) => r.status !== 'pending');

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No access requests yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">Pending Requests ({pendingRequests.length})</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.user_name || 'No name'}</div>
                          <div className="text-sm text-muted-foreground">{request.user_email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate">{request.reason}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAction(request, 'approve')}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(request, 'reject')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Processed Requests */}
        {processedRequests.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">History ({processedRequests.length})</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedRequests.slice(0, 10).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.user_name || 'No name'}</div>
                          <div className="text-sm text-muted-foreground">{request.user_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {request.reviewed_at
                          ? format(new Date(request.reviewed_at), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {request.review_notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {request.status === 'approved' && onRevoke && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-500 border-orange-500 hover:bg-orange-500/10"
                              onClick={() => handleAction(request, 'revoke')}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                          {request.status === 'revoked' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-500 border-green-500 hover:bg-green-500/10"
                              onClick={() => handleAction(request, 'approve')}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'approve' ? 'Approve Request' : dialogAction === 'reject' ? 'Reject Request' : 'Revoke Access'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'approve'
                ? `This will grant creator permissions to ${selectedRequest?.user_email}`
                : dialogAction === 'reject'
                ? `This will reject the access request from ${selectedRequest?.user_email}`
                : `This will revoke creator permissions from ${selectedRequest?.user_email}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Their reason:</p>
                <p className="text-sm text-muted-foreground">{selectedRequest.reason}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add a note for this decision..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              variant={dialogAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleConfirm}
              disabled={processing}
            >
              {processing ? 'Processing...' : dialogAction === 'approve' ? 'Approve' : dialogAction === 'reject' ? 'Reject' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
