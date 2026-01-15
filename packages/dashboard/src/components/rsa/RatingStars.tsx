'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  value: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function RatingStars({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: RatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue ?? value ?? 0;

  const handleClick = (rating: number) => {
    if (readonly || !onChange) return;
    // Toggle off if clicking same rating
    if (rating === value) {
      onChange(0);
    } else {
      onChange(rating);
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5',
        !readonly && 'cursor-pointer'
      )}
      onMouseLeave={() => !readonly && setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => handleClick(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          className={cn(
            'transition-colors focus:outline-none disabled:cursor-default',
            SIZE_CLASSES[size]
          )}
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill={star <= displayValue ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.5}
            className={cn(
              'w-full h-full transition-colors',
              star <= displayValue
                ? 'text-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            )}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
