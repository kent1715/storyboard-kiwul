'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS } from '@/types/storyboard';

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳',
  queued: '📥',
  running: '⚡',
  completed: '✅',
  failed: '❌',
  skipped: '⏭️',
  cancelled: '🚫',
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const displayLabel = label || status;
  const icon = STATUS_ICONS[status] || '';

  return (
    <Badge
      variant="outline"
      className={`${colorClass} text-[10px] px-1.5 py-0 ${className}`}
    >
      <span className="mr-0.5">{icon}</span>
      {displayLabel}
    </Badge>
  );
}
