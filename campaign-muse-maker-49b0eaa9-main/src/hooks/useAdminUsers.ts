import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'moderator' | 'user';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_banned: boolean;
  banned_at: string | null;
  banned_reason: string | null;
  created_at: string;
  updated_at: string;
  roles: AppRole[];
  campaigns_count?: number;
  pages_count?: number;
  posts_count?: number;
}

export function useAdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch campaign counts per user
      const { data: campaignCounts, error: campaignsError } = await supabase
        .from('campaigns')
        .select('user_id');

      if (campaignsError) throw campaignsError;

      // Fetch page counts per user
      const { data: pageCounts, error: pagesError } = await supabase
        .from('facebook_pages')
        .select('user_id');

      if (pagesError) throw pagesError;

      // Count campaigns per user
      const campaignCountMap = new Map<string, number>();
      campaignCounts?.forEach((c) => {
        campaignCountMap.set(c.user_id, (campaignCountMap.get(c.user_id) || 0) + 1);
      });

      // Count pages per user
      const pageCountMap = new Map<string, number>();
      pageCounts?.forEach((p) => {
        pageCountMap.set(p.user_id, (pageCountMap.get(p.user_id) || 0) + 1);
      });

      // Group roles by user_id
      const rolesMap = new Map<string, AppRole[]>();
      allRoles?.forEach((r) => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role as AppRole);
        rolesMap.set(r.user_id, existing);
      });

      // Combine data
      const usersWithRoles: UserProfile[] = (profiles || []).map((profile) => ({
        ...profile,
        roles: rolesMap.get(profile.user_id) || ['user'],
        campaigns_count: campaignCountMap.get(profile.user_id) || 0,
        pages_count: pageCountMap.get(profile.user_id) || 0,
      }));

      setUsers(usersWithRoles);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const assignRole = useCallback(async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });

      if (error) throw error;

      toast.success(`Role "${role}" assigned successfully`);
      await fetchUsers();
    } catch (err) {
      console.error('Error assigning role:', err);
      toast.error('Failed to assign role');
    }
  }, [fetchUsers]);

  const removeRole = useCallback(async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      toast.success(`Role "${role}" removed successfully`);
      await fetchUsers();
    } catch (err) {
      console.error('Error removing role:', err);
      toast.error('Failed to remove role');
    }
  }, [fetchUsers]);

  const banUser = useCallback(async (userId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          banned_reason: reason,
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('User banned successfully');
      await fetchUsers();
    } catch (err) {
      console.error('Error banning user:', err);
      toast.error('Failed to ban user');
    }
  }, [fetchUsers]);

  const unbanUser = useCallback(async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_banned: false,
          banned_at: null,
          banned_reason: null,
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('User unbanned successfully');
      await fetchUsers();
    } catch (err) {
      console.error('Error unbanning user:', err);
      toast.error('Failed to unban user');
    }
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    assignRole,
    removeRole,
    banUser,
    unbanUser,
  };
}
