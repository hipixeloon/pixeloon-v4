import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AccessRequest {
  id: string;
  user_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user_email?: string;
}

export interface SystemStats {
  totalUsers: number;
  totalCampaigns: number;
  totalPosts: number;
  totalPages: number;
  successRate: number;
  pendingPosts: number;
  postedPosts: number;
  failedPosts: number;
  pendingRequests: number;
}

export type PermissionType = 'creator' | 'viewer';

export function useAdminPanel() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      // Fetch all stats in parallel using count queries to avoid 1000 row limit
      const [
        { count: usersCount },
        { count: campaignsCount },
        { count: totalPostsCount },
        { count: pendingPostsCount },
        { count: postedPostsCount },
        { count: failedPostsCount },
        { count: pagesCount },
        { count: pendingRequestsCount },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('scheduled_posts').select('*', { count: 'exact', head: true }),
        supabase.from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('status', 'posted'),
        supabase.from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('facebook_pages').select('*', { count: 'exact', head: true }),
        supabase.from('access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const totalPosts = totalPostsCount || 0;
      const postedPosts = postedPostsCount || 0;
      const failedPosts = failedPostsCount || 0;
      const pendingPosts = pendingPostsCount || 0;
      const successRate = (postedPosts + failedPosts) > 0 
        ? Math.round((postedPosts / (postedPosts + failedPosts)) * 100) 
        : 100;

      setStats({
        totalUsers: usersCount || 0,
        totalCampaigns: campaignsCount || 0,
        totalPosts,
        totalPages: pagesCount || 0,
        successRate,
        pendingPosts,
        postedPosts,
        failedPosts,
        pendingRequests: pendingRequestsCount || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const fetchAccessRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user emails for each request
      const userIds = [...new Set((data || []).map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      const requestsWithUsers = (data || []).map((r) => ({
        ...r,
        user_email: profileMap.get(r.user_id)?.email || 'Unknown',
        user_name: profileMap.get(r.user_id)?.full_name || '',
      }));

      setAccessRequests(requestsWithUsers as AccessRequest[]);
    } catch (err) {
      console.error('Error fetching access requests:', err);
    }
  }, []);

  const fetchActivityLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get user emails
      const userIds = [...new Set((data || []).filter((l) => l.user_id).map((l) => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.email]) || []);

      const logsWithUsers = (data || []).map((l) => ({
        ...l,
        user_email: l.user_id ? profileMap.get(l.user_id) || 'Unknown' : 'System',
      }));

      setActivityLogs(logsWithUsers as ActivityLog[]);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchAccessRequests(), fetchActivityLogs()]);
    setLoading(false);
  }, [fetchStats, fetchAccessRequests, fetchActivityLogs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const approveRequest = useCallback(async (requestId: string, userId: string, notes?: string) => {
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Grant creator permission
      const { error: permError } = await supabase
        .from('user_permissions')
        .upsert({ user_id: userId, permission: 'creator' }, { onConflict: 'user_id,permission' });

      if (permError) throw permError;

      toast.success('Request approved');
      await fetchAccessRequests();
      await fetchStats();
    } catch (err) {
      console.error('Error approving request:', err);
      toast.error('Failed to approve request');
    }
  }, [fetchAccessRequests, fetchStats]);

  const rejectRequest = useCallback(async (requestId: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('access_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request rejected');
      await fetchAccessRequests();
      await fetchStats();
    } catch (err) {
      console.error('Error rejecting request:', err);
      toast.error('Failed to reject request');
    }
  }, [fetchAccessRequests, fetchStats]);

  const grantPermission = useCallback(async (userId: string, permission: PermissionType) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .upsert({ user_id: userId, permission }, { onConflict: 'user_id,permission' });

      if (error) throw error;

      toast.success(`${permission} permission granted`);
    } catch (err) {
      console.error('Error granting permission:', err);
      toast.error('Failed to grant permission');
    }
  }, []);

  const revokePermission = useCallback(async (userId: string, permission: PermissionType) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission', permission);

      if (error) throw error;

      toast.success(`${permission} permission revoked`);
    } catch (err) {
      console.error('Error revoking permission:', err);
      toast.error('Failed to revoke permission');
    }
  }, []);

  const revokeAccess = useCallback(async (requestId: string, userId: string, notes?: string) => {
    try {
      // Update request status to revoked
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({
          status: 'revoked',
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Remove creator permission
      const { error: permError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission', 'creator');

      if (permError) throw permError;

      toast.success('Access revoked');
      await fetchAccessRequests();
      await fetchStats();
    } catch (err) {
      console.error('Error revoking access:', err);
      toast.error('Failed to revoke access');
    }
  }, [fetchAccessRequests, fetchStats]);

  const logActivity = useCallback(async (
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown>
  ) => {
    try {
      await supabase.from('activity_logs').insert([{
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
      }]);
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  }, []);

  return {
    stats,
    accessRequests,
    activityLogs,
    loading,
    refetch: fetchAll,
    approveRequest,
    rejectRequest,
    revokeAccess,
    grantPermission,
    revokePermission,
    logActivity,
  };
}
