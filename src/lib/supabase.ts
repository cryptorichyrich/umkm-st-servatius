import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Lazy-init: only create client when env vars exist.
// This allows `astro build` to work without Supabase configured.
let _client: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!isSupabaseConfigured) {
      // Return a no-op for any property access when not configured
      return () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
    }
    if (!_client) {
      _client = createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
    }
    return (_client as any)[prop];
  },
});

// Database types
export type BusinessStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type UserRole = 'owner' | 'admin';

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
  // Joined fields
  category?: Category;
  images?: BusinessImage[];
}

export interface BusinessImage {
  id: string;
  business_id: string;
  image_url: string;
  caption: string;
  sort_order: number;
}
