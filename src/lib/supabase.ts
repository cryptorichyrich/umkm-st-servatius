import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Runtime config: injected by the Worker (SSR) via window.__SUPABASE__
// Falls back to import.meta.env for local dev / static builds
declare global {
  interface Window {
    __SUPABASE__?: { url: string; key: string };
  }
}

function getConfig() {
  if (typeof window !== 'undefined' && window.__SUPABASE__) {
    return window.__SUPABASE__;
  }
  // SSR / local dev fallback
  return {
    url: import.meta.env.PUBLIC_SUPABASE_URL as string,
    key: import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

const config = getConfig();

export const isSupabaseConfigured = Boolean(config.url && config.key);

export const supabase: SupabaseClient = createClient(
  config.url || 'https://placeholder.supabase.co',
  config.key || 'public-anon-key-placeholder',
  { auth: { persistSession: true, autoRefreshToken: true } },
);

// Database types
export type BusinessStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type UserRole = 'owner' | 'member' | 'admin';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Wilayah {
  id: string;
  name: string;
  sort_order: number;
}

export interface Lingkungan {
  id: string;
  wilayah_id: string;
  name: string;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  created_at: string;
  verification_status: VerificationStatus;
  verification_type: string;
  verified_at: string | null;
  verified_by: string | null;
  verification_note: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  category_id: string | null;
  whatsapp: string;
  phone: string;
  email: string;
  address: string;
  area: string;
  lingkungan: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  operating_hours: Record<string, string>;
  logo_url: string;
  status: BusinessStatus;
  is_featured: boolean;
  view_count: number;
  rejection_note: string;
  created_at: string;
  updated_at: string;
  category?: Category;
  images?: BusinessImage[];
  owner?: Pick<Profile, 'id' | 'full_name' | 'verification_status' | 'verification_type'>;
}

export interface BusinessImage {
  id: string;
  business_id: string;
  image_url: string;
  caption: string;
  sort_order: number;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string;
  price: number | null;
  price_note: string;
  image_url: string;
  product_type: string;
  is_available: boolean;
  view_count: number;
  ecommerce_links: Record<string, string>;
  rich_description: string;
  seo_title: string;
  seo_description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  business?: Business;
  images?: ProductImage[];
}

export interface Review {
  id: string;
  business_id: string;
  reviewer_id: string;
  rating: number;
  title: string;
  content: string;
  is_visible: boolean;
  owner_reply: string;
  owner_reply_at: string | null;
  created_at: string;
  updated_at: string;
  reviewer?: Pick<Profile, 'id' | 'full_name' | 'verification_status'>;
  images?: ReviewImage[];
}

export interface ReviewImage {
  id: string;
  review_id: string;
  image_url: string;
  sort_order: number;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  caption: string;
  sort_order: number;
}

export type ReportTarget = 'business' | 'product' | 'review' | 'profile';
export type ReportReason = 'spam' | 'adult' | 'scam' | 'offensive' | 'false_info' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

export interface Report {
  id: string;
  reporter_id: string | null;
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  detail: string;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  business_id: string | null;
  product_id: string | null;
  created_at: string;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  request_type: 'member' | 'umkm';
  status: 'pending' | 'approved' | 'rejected';
  kk_gereja_url: string;
  ktp_url: string;
  catalog_url: string;
  owner_name: string;
  business_name: string;
  business_address: string;
  business_phone: string;
  category_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string;
  created_at: string;
  updated_at: string;
}

export const ECOMMERCE_PLATFORMS = [
  { key: 'tokopedia', label: 'Tokopedia', color: '#03A9F4', icon: '🛒', iconUrl: '/icons/tokopedia.webp' },
  { key: 'shopee', label: 'Shopee', color: '#EE4D2D', icon: '🛍️', iconUrl: '/icons/shopee.png' },
  { key: 'lazada', label: 'Lazada', color: '#0F146D', icon: '🏷️', iconUrl: '/icons/lazada.webp' },
  { key: 'blibli', label: 'Blibli', color: '#0095DA', icon: '📦', iconUrl: '/icons/blibli.png' },
  { key: 'bukalapak', label: 'Bukalapak', color: '#E31D33', icon: '📄' },
  { key: 'website', label: 'Website Sendiri', color: '#10B981', icon: '🌐' },
] as const;
