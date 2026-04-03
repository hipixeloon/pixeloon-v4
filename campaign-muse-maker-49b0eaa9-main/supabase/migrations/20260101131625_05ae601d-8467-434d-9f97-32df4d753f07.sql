-- Backfill profiles for existing users who don't have one
INSERT INTO public.profiles (user_id, email, full_name)
SELECT 
  id as user_id,
  email,
  COALESCE(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', '') as full_name
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;

-- Backfill default 'user' role for existing users who don't have any role
INSERT INTO public.user_roles (user_id, role)
SELECT id as user_id, 'user'::app_role as role
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id, role) DO NOTHING;

-- Make the first user (harshalchavan229@gmail.com) an admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('d0fbada7-5c68-4222-aabb-f882bf2987e5', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;