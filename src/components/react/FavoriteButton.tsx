import { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FavoriteButtonProps {
  targetType: 'business' | 'product';
  targetId: string;
  variant?: 'icon' | 'button' | 'badge';
}

export default function FavoriteButton({
  targetType,
  targetId,
  variant = 'icon',
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  // Column name to filter on in the favorites table
  const column = targetType === 'business' ? 'business_id' : 'product_id';

  // Check favorite status on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return; // not logged in => not favorited

        const { data, error } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', session.user.id)
          .eq(column, targetId)
          .maybeSingle();

        if (!cancelled && !error) {
          setFavorited(Boolean(data));
        }
      } catch {
        /* silent: default to not favorited */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId, column]);

  const toggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (loading) return;

      // Require login
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          window.location.href = '/masuk';
          return;
        }

        const userId = session.user.id;
        const wasFavorited = favorited;

        // Optimistic UI update
        setFavorited(!wasFavorited);
        setLoading(true);

        if (wasFavorited) {
          // DELETE
          const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', userId)
            .eq(column, targetId);
          if (error) {
            setFavorited(true); // revert
            console.error('Failed to remove favorite:', error);
          }
        } else {
          // INSERT
          const payload: Record<string, string> = {
            user_id: userId,
            [column]: targetId,
          };
          const { error } = await supabase.from('favorites').insert(payload);
          if (error) {
            setFavorited(false); // revert
            console.error('Failed to add favorite:', error);
          }
        }
      } catch (err) {
        // revert on any unexpected error
        setFavorited((prev) => !prev);
        console.error('Favorite toggle failed:', err);
      } finally {
        setLoading(false);
      }
    },
    [favorited, loading, column, targetId],
  );

  // ---- Variants ----
  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleFavorite}
        aria-pressed={favorited}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition active:translate-y-px ${
          favorited
            ? 'bg-paroki-600 text-white hover:bg-paroki-700'
            : 'border border-paroki-200 bg-white text-paroki-700 hover:bg-paroki-50'
        }`}
      >
        <Heart className={`h-4 w-4 ${favorited ? 'fill-current' : ''}`} />
        {favorited ? 'Tersimpan' : 'Simpan'}
      </button>
    );
  }

  if (variant === 'badge') {
    return (
      <button
        type="button"
        onClick={toggleFavorite}
        aria-pressed={favorited}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
          favorited
            ? 'bg-paroki-50 text-paroki-700 ring-1 ring-paroki-200'
            : 'bg-gray-50 text-gray-500 ring-1 ring-gray-200 hover:bg-gray-100'
        }`}
      >
        <Heart className={`h-3.5 w-3.5 ${favorited ? 'fill-paroki-600 text-paroki-600' : ''}`} />
        {favorited ? 'Tersimpan' : 'Simpan'}
      </button>
    );
  }

  // Default: icon (for use on cards)
  return (
    <button
      type="button"
      onClick={toggleFavorite}
      aria-pressed={favorited}
      aria-label={favorited ? 'Hapus dari favorit' : 'Tambah ke favorit'}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-400 shadow-sm ring-1 ring-gray-200 backdrop-blur transition hover:bg-white hover:text-paroki-600 active:scale-95"
    >
      <Heart className={`h-4 w-4 ${favorited ? 'fill-paroki-600 text-paroki-600' : ''}`} />
    </button>
  );
}
