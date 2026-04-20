INSERT INTO public.user_roles (user_id, role)
VALUES ('d0fbada7-5c68-4222-aabb-f882bf2987e5', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;