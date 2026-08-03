import { Eye } from 'lucide-react';

interface ViewCounterProps {
  count: number;
  label?: string; // default: 'kali dilihat'
  className?: string;
}

/**
 * Format a view count using Indonesian abbreviations.
 * - 0–999: plain number (e.g. "42")
 * - 1_000–999_999: e.g. "1,2rb" (using Indonesian thousands separator ",")
 * - 1_000_000+: e.g. "1,2jt"
 */
function formatViewCount(count: number): string {
  if (count < 1000) return new Intl.NumberFormat('id-ID').format(count);
  if (count < 1_000_000) {
    const val = count / 1000;
    // 1 decimal, trim trailing ,0
    const str = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(val);
    return `${str}rb`;
  }
  const val = count / 1_000_000;
  const str = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(val);
  return `${str}jt`;
}

export default function ViewCounter({
  count,
  label = 'kali dilihat',
  className = '',
}: ViewCounterProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-paroki-500 ${className}`}
      title={`${new Intl.NumberFormat('id-ID').format(count)} ${label}`}
    >
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{formatViewCount(count)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
