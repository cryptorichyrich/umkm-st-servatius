-- Fix submit_blog_for_review: bypass is_admin() guard (same bug as handle_new_user)
-- + add email notification to admins
-- + add bazar payment resubmission trigger

CREATE OR REPLACE FUNCTION public.submit_blog_for_review(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $$
DECLARE
  v_owner_id UUID;
  v_title TEXT;
  v_owner_name TEXT;
BEGIN
  SELECT b.owner_id, bp.title INTO v_owner_id, v_title
  FROM blog_posts bp JOIN businesses b ON b.id = bp.business_id
  WHERE bp.id = p_post_id;

  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Blog post not found'; END IF;

  IF v_owner_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','blogger')
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE blog_posts SET status = 'pending', rejection_note = '', updated_at = now()
  WHERE id = p_post_id;

  SELECT full_name INTO v_owner_name FROM profiles WHERE id = v_owner_id;

  -- Direct insert (bypass notify_all_admins guard)
  INSERT INTO notifications (user_id, title, message, type, link)
  SELECT id, 'Artikel Menunggu Review',
    '"' || COALESCE(v_title, '?') || '" oleh ' || COALESCE(v_owner_name, '?') || ' menunggu persetujuan.',
    'info', '/admin/moderasi-blog'
  FROM profiles WHERE role = 'admin';

  PERFORM public.notify_admins_email('admin_new_blog', 'admin_new_blog',
    jsonb_build_object('title', COALESCE(v_title, '?'), 'author', COALESCE(v_owner_name, '?')));
END;
$$;

-- Trigger: notify admins when bazar payment re-uploaded
CREATE OR REPLACE FUNCTION public.notify_admin_bazar_payment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $$
DECLARE
  v_biz_name TEXT;
  v_owner_name TEXT;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status
      AND NEW.payment_status = 'pending_review') THEN

    SELECT COALESCE(b.name, '') INTO v_biz_name
    FROM bazar_assignments ba LEFT JOIN businesses b ON b.id = ba.business_id WHERE ba.id = NEW.id;

    SELECT COALESCE(p.full_name, '') INTO v_owner_name
    FROM bazar_assignments ba LEFT JOIN profiles p ON p.id = ba.user_id WHERE ba.id = NEW.id;

    INSERT INTO notifications (user_id, title, message, type, link)
    SELECT id, 'Pembayaran Bazar Baru',
      COALESCE(v_biz_name, 'UMKM') || ' mengunggah bukti pembayaran bazar.',
      'info', '/admin'
    FROM profiles WHERE role = 'admin';

    PERFORM public.notify_admins_email('admin_new_business', 'admin_generic',
      jsonb_build_object(
        'title', 'Pembayaran Bazar Menunggu Konfirmasi',
        'body', '<strong>' || COALESCE(v_owner_name, 'UMKM') || '</strong> mengunggah bukti pembayaran.',
        'ctaText', 'Tinjau Pembayaran',
        'ctaLink', 'https://umkm.servatius.id/admin'
      ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bazar_payment_update ON public.bazar_assignments;
CREATE TRIGGER trg_bazar_payment_update
  AFTER UPDATE ON public.bazar_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_bazar_payment_update();
