-- ============================================================================
-- Paroki UMKM Directory — Initial Schema Migration
-- ============================================================================
-- Creates: categories, profiles, businesses, business_images, admin_actions
-- Includes: triggers, RLS policies, storage bucket, seed data
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE business_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  icon        TEXT DEFAULT '📦',
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL DEFAULT '',
  phone       TEXT DEFAULT '',
  role        user_role NOT NULL DEFAULT 'owner',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT DEFAULT '',
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  whatsapp        TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  email           TEXT DEFAULT '',
  address         TEXT DEFAULT '',
  area            TEXT DEFAULT '',
  instagram       TEXT DEFAULT '',
  facebook        TEXT DEFAULT '',
  tiktok          TEXT DEFAULT '',
  operating_hours JSONB DEFAULT '{}',
  logo_url        TEXT DEFAULT '',
  status          business_status NOT NULL DEFAULT 'draft',
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_note  TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Business Images
CREATE TABLE IF NOT EXISTS business_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  caption       TEXT DEFAULT '',
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Admin Actions (audit log)
CREATE TABLE IF NOT EXISTS admin_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES profiles(id),
  business_id   UUID REFERENCES businesses(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  note          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_featured ON businesses(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_business_images_business ON business_images(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Full-text search on businesses
CREATE INDEX IF NOT EXISTS idx_businesses_search ON businesses
  USING gin(to_tsvector('indonesian', coalesce(name, '') || ' ' || coalesce(description, '')));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS businesses_updated_at ON businesses;
CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ---- Categories: public read, admin write ----
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (TRUE);

CREATE POLICY "categories_admin_write" ON categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- Profiles: user reads own, admin reads all ----
CREATE POLICY "profiles_read_own" ON profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ---- Businesses ----
-- Public can read approved businesses
CREATE POLICY "businesses_public_read_approved" ON businesses
  FOR SELECT USING (status = 'approved');

-- Owner can read own businesses (any status)
CREATE POLICY "businesses_owner_read" ON businesses
  FOR SELECT USING (owner_id = auth.uid());

-- Owner can insert own businesses
CREATE POLICY "businesses_owner_insert" ON businesses
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Owner can update own businesses (but NOT status field — handled separately)
CREATE POLICY "businesses_owner_update" ON businesses
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Admin full access
CREATE POLICY "businesses_admin_all" ON businesses
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- Business Images ----
-- Public can read images of approved businesses
CREATE POLICY "images_public_read" ON business_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = business_images.business_id
      AND status = 'approved'
    )
  );

-- Owner can read/upload images for own businesses
CREATE POLICY "images_owner_read" ON business_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = business_images.business_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "images_owner_insert" ON business_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = business_images.business_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "images_owner_update" ON business_images
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = business_images.business_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "images_owner_delete" ON business_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = business_images.business_id
      AND owner_id = auth.uid()
    )
  );

-- Admin full access on images
CREATE POLICY "images_admin_all" ON business_images
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- Admin Actions: admin only ----
CREATE POLICY "admin_actions_admin_only" ON admin_actions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Submit business for review (owner changes status from draft to pending)
-- This prevents owners from directly setting status to 'approved'
CREATE OR REPLACE FUNCTION public.submit_for_review(p_business_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.businesses
  SET status = 'pending'
  WHERE id = p_business_id AND owner_id = auth.uid() AND status IN ('draft', 'rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin: approve business
CREATE OR REPLACE FUNCTION public.approve_business(p_business_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.businesses SET status = 'approved', rejection_note = '' WHERE id = p_business_id;
  INSERT INTO public.admin_actions (admin_id, business_id, action)
  VALUES (auth.uid(), p_business_id, 'approve');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin: reject business
CREATE OR REPLACE FUNCTION public.reject_business(p_business_id UUID, p_note TEXT DEFAULT '')
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.businesses SET status = 'rejected', rejection_note = p_note WHERE id = p_business_id;
  INSERT INTO public.admin_actions (admin_id, business_id, action, note)
  VALUES (auth.uid(), p_business_id, 'reject', p_note);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-images', 'business-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: owner can upload to own folder, public can read
CREATE POLICY "storage_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'business-images');

CREATE POLICY "storage_owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'business-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'business-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'business-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- SEED DATA: Categories
-- ============================================================================
INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('Kuliner & Minuman', 'kuliner-minuman', '🍜', 1),
  ('Jasa & Service', 'jasa-service', '🔧', 2),
  ('Kerajinan Tangan', 'kerajinan-tangan', '✂️', 3),
  ('Fashion & Pakaian', 'fashion-pakaian', '👕', 4),
  ('Kecantikan & Kesehatan', 'kecantikan-kesehatan', '💄', 5),
  ('Elektronik & Gadget', 'elektronik-gadget', '📱', 6),
  ('Pendidikan & Les', 'pendidikan-les', '📚', 7),
  ('Pertanian & Peternakan', 'pertanian-peternakan', '🌱', 8),
  ('Otomotif', 'otomotif', '🚗', 9),
  ('Lainnya', 'lainnya', '📦', 10)
ON CONFLICT (slug) DO NOTHING;
