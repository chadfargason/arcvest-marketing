'use client';

import { cn } from '@/lib/utils';

interface Headline {
  text: string;
  type?: string;
  charCount?: number;
  pinPosition?: 1 | 2 | 3;
}

interface HeadlineListProps {
  headlines: Headline[];
  maxChars?: number;
  showType?: boolean;
  compact?: boolean;
}

const HEADLINE_TYPE_COLORS: Record<string, string> = {
  brand: 'text-purple-600 dark:text-purple-400',
  service: 'text-blue-600 dark:text-blue-400',
  benefit: 'text-green-600 dark:text-green-400',
  cta: 'text-orange-600 dark:text-orange-400',
  differentiator: 'text-teal-600 dark:text-teal-400',
  keyword: 'text-indigo-600 dark:text-indigo-400',
  question: 'text-pink-600 dark:text-pink-400',
};

export function HeadlineList({
  headlines,
  maxChars = 30,
  showType = false,
  compact = false,
}: HeadlineListProps) {
  if (!headlines || headlines.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No headlines</p>;
  }

  return (
    <div className={cn('space-y-1', compact && 'space-y-0.5')}>
      {headlines.map((headline, index) => {
        const charCount = headline.charCount || headline.text.length;
        const isOverLimit = charCount > maxChars;
        const isNearLimit = charCount >= maxChars - 3 && charCount <= maxChars;

        return (
          <div
            key={index}
            className={cn(
              'flex items-start gap-2 text-sm',
              compact && 'text-xs'
            )}
          >
            <span className="text-muted-foreground w-5 flex-shrink-0">
              {index + 1}.
            </span>
            <span className="flex-1 break-words">{headline.text}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {showType && headline.type && (
                <span
                  className={cn(
                    'text-xs capitalize',
                    HEADLINE_TYPE_COLORS[headline.type] || 'text-gray-500'
                  )}
                >
                  {headline.type}
                </span>
              )}
              {headline.pinPosition && (
                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1 rounded">
                  Pin {headline.pinPosition}
                </span>
              )}
              <span
                className={cn(
                  'text-xs tabular-nums',
                  isOverLimit && 'text-red-500 font-medium',
                  isNearLimit && !isOverLimit && 'text-yellow-600',
                  !isNearLimit && !isOverLimit && 'text-muted-foreground'
                )}
              >
                {charCount}/{maxChars}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
