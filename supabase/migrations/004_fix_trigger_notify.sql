-- Fix handle_new_user trigger: notify_all_admins() has is_admin() guard
-- that fails during GoTrue user creation (no admin JWT context).
-- Insert notifications directly instead.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role, verification_status, verification_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    'member',
    'unverified',
    ''
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  -- Notify admins directly (bypass notify_all_admins which has is_admin() guard
  -- that fails when called from trigger context — no admin JWT session)
  INSERT INTO notifications (user_id, title, message, type, link)
  SELECT id,
    'Anggota Baru Mendaftar',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' telah mendaftar sebagai anggota baru.',
    'info',
    '/admin/users'
  FROM profiles WHERE role = 'admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
