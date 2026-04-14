import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'moderator' | 'user';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export function useUserRoles(userId: string | undefined) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);

  const fetchRoles = useCallback(async () => {
    if (!userId) {
      setRoles([]);
      setIsAdmin(false);
      setIsModerator(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) throw error;

      const userRoles = (data || []).map((r) => r.role as AppRole);
      setRoles(userRoles);
      setIsAdmin(userRoles.includes('admin'));
      setIsModerator(userRoles.includes('moderator'));
    } catch (err) {
      console.error('Error fetching roles:', err);
      setRoles([]);
      setIsAdmin(false);
      setIsModerator(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return {
    roles,
    isAdmin,
    isModerator,
    isAdminOrModerator: isAdmin || isModerator,
    loading,
    refetch: fetchRoles,
  };
}
