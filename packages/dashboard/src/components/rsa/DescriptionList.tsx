'use client';

import { cn } from '@/lib/utils';

interface Description {
  text: string;
  charCount?: number;
  pinPosition?: 1 | 2;
}

interface DescriptionListProps {
  descriptions: Description[];
  maxChars?: number;
  compact?: boolean;
}

export function DescriptionList({
  descriptions,
  maxChars = 90,
  compact = false,
}: DescriptionListProps) {
  if (!descriptions || descriptions.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No descriptions</p>;
  }

  return (
    <div className={cn('space-y-2', compact && 'space-y-1')}>
      {descriptions.map((description, index) => {
        const charCount = description.charCount || description.text.length;
        const isOverLimit = charCount > maxChars;
        const isNearLimit = charCount >= maxChars - 5 && charCount <= maxChars;

        return (
          <div
            key={index}
            className={cn(
              'text-sm',
              compact && 'text-xs'
            )}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-muted-foreground font-medium">
                Description {index + 1}
              </span>
              {description.pinPosition && (
                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1 rounded">
                  Pin {description.pinPosition}
                </span>
              )}
              <span
                className={cn(
                  'text-xs tabular-nums ml-auto',
                  isOverLimit && 'text-red-500 font-medium',
                  isNearLimit && !isOverLimit && 'text-yellow-600',
                  !isNearLimit && !isOverLimit && 'text-muted-foreground'
                )}
              >
                {charCount}/{maxChars}
              </span>
            </div>
            <p className="text-foreground leading-relaxed break-words">
              {description.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
