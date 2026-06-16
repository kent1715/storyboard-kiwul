'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS } from '@/types/storyboard';

interface SceneStatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function SceneStatusBadge({ status, label, className }: SceneStatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const displayLabel = label || status;

  return (
    <Badge
      variant="outline"
      className={`${colorClass} text-[9px] px-1.5 py-0 font-medium ${className}`}
    >
      {displayLabel}
    </Badge>
  );
}
