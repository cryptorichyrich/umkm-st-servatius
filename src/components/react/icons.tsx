/*
  UMKM St. Servatius — single-source icon set.
  Consistent stroke (1.75), 24x24 viewBox, currentColor. Zero emoji.
  Used across every React surface so the iconography never drifts.
*/

type IconProps = { className?: string };

const base = (className = 'h-5 w-5') => ({
  className,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const IconSearch = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconPin = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 21c4.5-4.2 7-7.6 7-11a7 7 0 1 0-14 0c0 3.4 2.5 6.8 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const IconStar = ({ className }: IconProps) => (
  <svg {...base(className)} fill="currentColor" stroke="none">
    <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85L12 3.5Z" />
  </svg>
);

export const IconPhone = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5 4h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 0-2Z" />
  </svg>
);

export const IconClock = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);

export const IconGlobe = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17" />
  </svg>
);

export const IconStore = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 9.5 5.5 5h13L20 9.5M4 9.5h16M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5M4 9.5a2.2 2.2 0 0 0 4 0 2.2 2.2 0 0 0 4 0 2.2 2.2 0 0 0 4 0 2.2 2.2 0 0 0 4 0" />
    <path d="M9.5 20v-4.5h5V20" />
  </svg>
);

export const IconPackage = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
    <path d="m4 7 8 4 8-4M12 11v10" />
  </svg>
);

export const IconWhatsapp = ({ className }: IconProps) => (
  <svg className={className ?? 'h-5 w-5'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88M20.5 3.49A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.42" />
  </svg>
);

export const IconChevronRight = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconArrowRight = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconArrowLeft = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const IconMenu = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

/* Church / parish mark — used in header, footer, auth cards */
export const IconChurch = ({ className }: IconProps) => (
  <svg className={className ?? 'h-6 w-6'} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.5v3M11 4h2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M12 5.5 6.5 9V20h11V9L12 5.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    <path d="M10 20v-4a2 2 0 0 1 4 0v4" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    <path d="M4 20h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export const IconPlus = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

/*
  Category icons — keyed by slug, not the DB emoji field.
  Ignores whatever emoji the DB stores so the UI never shows emoji.
*/
export function categoryIcon(slug: string, className = 'h-6 w-6') {
  const p = { ...base(className) };
  const icons: Record<string, JSX.Element> = {
    'kuliner-minuman': (
      <svg {...p}>
        <path d="M6 3v7a2.5 2.5 0 0 0 5 0V3M8.5 3v7M16 3c-1.5 0-2.5 2-2.5 5s1 3.5 2 3.5h.5v8" />
      </svg>
    ),
    'jasa-service': (
      <svg {...p}>
        <path d="M14.5 5.5a3.5 3.5 0 0 0-4.7 4.3L4 15.6V20h4.4l5.8-5.8a3.5 3.5 0 0 0 4.3-4.7l-2.2 2.2-2-2 2.2-2.2Z" />
      </svg>
    ),
    'kerajinan-tangan': (
      <svg {...p}>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <path d="M8 7.5 19 17M8 16.5 19 7" />
      </svg>
    ),
    'fashion-pakaian': (
      <svg {...p}>
        <path d="M8 3 4 6l2 3 1-.5V21h10V8.5L18 9l2-3-4-3-2 2a2 2 0 0 1-4 0L8 3Z" />
      </svg>
    ),
    'kecantikan-kesehatan': (
      <svg {...p}>
        <path d="M12 4 13.6 8.4 18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z" />
        <path d="M18 15.5l.7 1.8 1.8.7-1.8.7L18 20.5l-.7-1.8L15.5 18l1.8-.7.7-1.8Z" />
      </svg>
    ),
    'elektronik-gadget': (
      <svg {...p}>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 18h2" />
      </svg>
    ),
    'pendidikan-les': (
      <svg {...p}>
        <path d="M4 7.5 12 4l8 3.5L12 11 4 7.5Z" />
        <path d="M7 9.5V14c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V9.5M20 8v5" />
      </svg>
    ),
    'pertanian-peternakan': (
      <svg {...p}>
        <path d="M12 21v-8M12 13c0-3-2.5-5-6-5 0 3 2.5 5 6 5ZM12 11c0-2.5 2-4.5 5-4.5 0 2.5-2 4.5-5 4.5Z" />
      </svg>
    ),
    'otomotif': (
      <svg {...p}>
        <path d="M4 16v-3l2-5a2 2 0 0 1 1.9-1.3h8.2A2 2 0 0 1 18 8l2 5v3M4 16h16" />
        <circle cx="7.5" cy="16.5" r="1.5" />
        <circle cx="16.5" cy="16.5" r="1.5" />
      </svg>
    ),
    'lainnya': (
      <svg {...p}>
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </svg>
    ),
  };
  return icons[slug] ?? (
    <svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
