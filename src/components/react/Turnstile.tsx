import { useState, useEffect, useRef, useCallback } from 'react';

// ── Cloudflare Turnstile ──────────────────────────────────────────
// Free, invisible bot protection. Widget auto-solves for humans.
// Token is verified server-side via the verify-turnstile Edge Function.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  siteKey: string;
  onToken: (token: string) => void;
  className?: string;
}

export default function Turnstile({ siteKey, onToken, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>('');
  const [loaded, setLoaded] = useState(false);

  // Keep latest onToken in a ref so the render callback doesn't go stale
  const cbRef = useRef(onToken);
  cbRef.current = onToken;

  const render = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;
    // Clear previous widget if re-rendering
    if (widgetIdRef.current) {
      try { window.turnstile.remove(widgetIdRef.current); } catch {}
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: 'light',
      size: 'normal',
      callback: (token: string) => cbRef.current(token),
      'expired-callback': () => cbRef.current(''),
      'error-callback': () => cbRef.current(''),
    });
  }, [siteKey]);

  useEffect(() => {
    loadScript().then(() => {
      setLoaded(true);
      render();
    });
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
  }, [render]);

  // Expose reset via ref-like pattern using key remount from parent
  return <div ref={containerRef} className={className} style={{ minHeight: loaded ? 0 : 65 }} />;
}
