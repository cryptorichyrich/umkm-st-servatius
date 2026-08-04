import { useState } from "react";
import { Link2, Check, Share2 } from "lucide-react";

interface Props {
  title: string;
  className?: string;
}

export default function ShareButtons({ title, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      bg: "hover:bg-green-50 hover:text-green-600",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.18c-.24.68-1.42 1.31-1.96 1.36-.5.05-1.14.07-1.84-.11-.42-.13-.97-.31-1.66-.61-2.92-1.26-4.83-4.19-4.97-4.38-.15-.19-1.2-1.59-1.2-3.03s.76-2.15 1.02-2.44c.26-.29.57-.36.76-.36s.38 0 .54.01c.17.01.41-.06.64.49.24.55.81 1.91.88 2.05.07.14.12.31.02.49-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.29 1.41.29.14.45.12.62-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.64-.14.26.09 1.62.76 1.9.9.29.14.48.21.54.33.07.12.07.68-.17 1.36Z" />
        </svg>
      ),
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      bg: "hover:bg-blue-50 hover:text-blue-600",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.3-1.3 1.4-1.3h1.4V5.6c-.7-.1-1.4-.1-2.1-.1-2.1 0-3.5 1.2-3.5 3.6v2.1H8.3V14h2.3v7h2.9Z" />
        </svg>
      ),
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      bg: "hover:bg-sky-50 hover:text-sky-500",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42Z" />
        </svg>
      ),
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      bg: "hover:bg-gray-900 hover:text-white",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
  ];

  function handleCopy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleNativeShare() {
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      handleCopy();
    }
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="mr-0.5 flex items-center gap-1 text-xs font-medium text-gray-400">
        <Share2 className="h-3.5 w-3.5" />
        Bagikan
      </span>
      {shareLinks.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Bagikan ke ${s.label}`}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition ${s.bg}`}
        >
          {s.icon}
        </a>
      ))}
      {/* Copy link */}
      <button
        onClick={handleCopy}
        title="Salin tautan"
        className={`flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-paroki-50 hover:text-paroki-700 ${
          copied ? "bg-green-50 text-green-600 border-green-200" : ""
        }`}
      >
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      </button>
      {/* Native share (mobile) */}
      {typeof navigator !== "undefined" && "share" in navigator && (
        <button
          onClick={handleNativeShare}
          title="Bagikan..."
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-paroki-50 hover:text-paroki-700"
        >
          <Share2 className="h-4 w-4" />
        </button>
      )}
      {copied && (
        <span className="text-xs font-medium text-green-600">Tautan disalin!</span>
      )}
    </div>
  );
}
