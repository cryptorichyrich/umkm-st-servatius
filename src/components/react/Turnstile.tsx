import { useState, useEffect, useRef, useCallback } from 'react';

// ── Cloudflare Turnstile ──────────────────────────────────────────
// Free bot protection. Widget auto-solves for humans.
// Token is verified server-side via the verify-turnstile Edge Function.
// Graceful fallback: if the script is blocked (ad blocker, network),
// onTimeout fires so the parent can fall back to honeypot + rate limiter.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__turnstileReady';
const LOAD_TIMEOUT_MS = 8000;

let scriptPromise: Promise<void> | null = null;
let onloadResolve: (() => void) | null = null;

// Use Cloudflare's onload callback for reliable initialization
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    onloadResolve = resolve;
    // Cloudflare calls this when the API is ready
    (window as Record<string, unknown>).__turnstileReady = () => {
      onloadResolve?.();
    };

    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    // Fallback: if onload callback doesn't fire, check for window.turnstile
    s.onload = () => {
      // Check immediately — some browsers execute before onload fires
      if (window.turnstile) { onloadResolve?.(); return; }
      // Poll for up to 5s
      let tries = 0;
      const iv = setInterval(() => {
        if (window.turnstile || ++tries > 25) {
          clearInterval(iv);
          onloadResolve?.();
        }
      }, 200);
    };
    // If the script itself errors (blocked by ad blocker), resolve anyway
    // so the parent can fall back
    s.onerror = () => { onloadResolve?.(); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  siteKey: string;
  onToken: (token: string) => void;
  onTimeout?: () => void;
  className?: string;
}

export default function Turnstile({ siteKey, onToken, onTimeout, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>('');
  const [loaded, setLoaded] = useState(false);
  const timedOutRef = useRef(false);

  const cbRef = useRef(onToken);
  cbRef.current = onToken;
  const timeoutCbRef = useRef(onTimeout);
  timeoutCbRef.current = onTimeout;

  const render = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;
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
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled) return;
      setLoaded(true);
      render();
    });

    // Timeout: if no widget after 8s, notify parent so it can allow fallback
    const timeout = setTimeout(() => {
      if (!loaded && !timedOutRef.current) {
        timedOutRef.current = true;
        timeoutCbRef.current?.();
      }
    }, LOAD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render]);

  return <div ref={containerRef} className={className} style={{ minHeight: loaded ? 0 : 65 }} />;
}
