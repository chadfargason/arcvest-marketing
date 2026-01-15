'use client';

import { Badge } from '@/components/ui/badge';
import type { AssetStatus } from '@/lib/rsa/types';

interface RSAStatusBadgeProps {
  status: AssetStatus;
}

const STATUS_CONFIG: Record<
  AssetStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'success' },
  active: { label: 'Active', variant: 'info' },
  paused: { label: 'Paused', variant: 'warning' },
  retired: { label: 'Retired', variant: 'destructive' },
};

export function RSAStatusBadge({ status }: RSAStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
