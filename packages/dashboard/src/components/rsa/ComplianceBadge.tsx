'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ComplianceBadgeProps {
  passed: boolean;
  issues?: string[];
  showTooltip?: boolean;
}

export function ComplianceBadge({
  passed,
  issues = [],
  showTooltip = true,
}: ComplianceBadgeProps) {
  const badge = (
    <Badge
      variant={passed ? 'success' : 'destructive'}
      className={cn(
        'gap-1',
        showTooltip && issues.length > 0 && 'cursor-help'
      )}
    >
      {passed ? (
        <>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Compliant
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Issues ({issues.length})
        </>
      )}
    </Badge>
  );

  if (!showTooltip || issues.length === 0) {
    return badge;
  }

  return (
    <div className="group relative inline-block">
      {badge}
      <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50">
        <div className="bg-popover text-popover-foreground border rounded-md shadow-lg p-2 text-xs max-w-xs">
          <p className="font-medium mb-1">Compliance Issues:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
