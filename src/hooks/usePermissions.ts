import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PermissionType = 'creator' | 'viewer';

export interface UserPermission {
  id: string;
  user_id: string;
  permission: PermissionType;
  granted_at: string;
}

export interface AccessRequest {
  id: string;
  user_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export function usePermissions(userId: string | undefined) {
  const [permissions, setPermissions] = useState<PermissionType[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!userId) {
      setPermissions([]);
      setCanCreate(false);
      setLoading(false);
      return;
    }

    try {
      // Fetch user permissions
      const { data: permData } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);

      const perms = (permData || []).map((p) => p.permission as PermissionType);
      setPermissions(perms);

      // Check if user has creator permission or is admin/moderator
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const userRoles = (roles || []).map((r) => r.role);
      const isAdminOrMod = userRoles.includes('admin') || userRoles.includes('moderator');
      const hasCreatorPerm = perms.includes('creator');

      setCanCreate(isAdminOrMod || hasCreatorPerm);

      // Check for pending access request
      const { data: requestData } = await supabase
        .from('access_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setAccessRequest(requestData as AccessRequest | null);
    } catch (err) {
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const requestAccess = useCallback(async (reason: string) => {
    if (!userId) return { error: 'Not logged in' };

    try {
      const { data, error } = await supabase
        .from('access_requests')
        .insert({
          user_id: userId,
          reason,
        })
        .select()
        .single();

      if (error) throw error;

      setAccessRequest(data as AccessRequest);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to submit request' };
    }
  }, [userId]);

  return {
    permissions,
    canCreate,
    loading,
    accessRequest,
    requestAccess,
    refetch: fetchPermissions,
  };
}
