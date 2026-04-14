-- Fix activity_logs unrestricted INSERT policy
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert activity logs" ON public.activity_logs;

-- Create a new policy that only allows authenticated users to insert their own activity logs
CREATE POLICY "Authenticated users can insert activity logs" 
ON public.activity_logs 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Users can only insert logs for themselves, or admins can insert for anyone
  auth.uid() = user_id OR user_id IS NULL OR is_admin_or_moderator(auth.uid())
);