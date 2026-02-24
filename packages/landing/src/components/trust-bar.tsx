import { cn } from '@/lib/utils';

interface TrustItem {
  label: string;
}

interface TrustBarProps {
  variant: 'warm' | 'navy';
  items: readonly TrustItem[];
}

export function TrustBar({ variant, items }: TrustBarProps) {
  return (
    <section
      className={cn(
        'py-5 border-y',
        variant === 'warm' && 'bg-white border-warm-200',
        variant === 'navy' && 'bg-navy-800 border-navy-600'
      )}
    >
      <div className="container">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          {items.map((item) => (
            <span
              key={item.label}
              className={cn(
                'text-sm font-medium',
                variant === 'warm' && 'text-neutral-600',
                variant === 'navy' && 'text-neutral-300'
              )}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
