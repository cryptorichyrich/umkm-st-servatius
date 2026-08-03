import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface PageViewTrackerProps {
  type: 'business' | 'product';
  slug: string;
}

/**
 * Invisible component that increments a view counter via Supabase RPC on mount.
 * Fires exactly once per mount and renders nothing.
 * Errors are swallowed silently.
 */
export default function PageViewTracker({ type, slug }: PageViewTrackerProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const rpcName = type === 'business' ? 'increment_business_views' : 'increment_product_views';
    // Fire and forget; silent failure
    (async () => {
      try {
        await supabase.rpc(rpcName, { p_slug: slug });
      } catch {
        /* swallow: view tracking must never break the page */
      }
    })();
  }, [type, slug]);

  return null;
}
