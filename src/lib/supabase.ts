import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'public-anon-key-placeholder',
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
  sort_order: number;
  created_at: string;
  updated_at: string;
  business?: Business;
}

export interface Review {
  id: string;
  business_id: string;
  reviewer_id: string;
  rating: number;
  title: string;
  content: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  reviewer?: Pick<Profile, 'id' | 'full_name' | 'verification_status'>;
}
