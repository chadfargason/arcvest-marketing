import { cn } from '@/lib/utils';

interface Stat {
  value: string;
  label: string;
}

interface StatCounterProps {
  variant: 'warm' | 'navy';
  stats: readonly Stat[];
}

export function StatCounter({ variant, stats }: StatCounterProps) {
  return (
    <section
      className={cn(
        'py-12 md:py-16',
        variant === 'warm' && 'bg-forest-600',
        variant === 'navy' && 'bg-navy-900'
      )}
    >
      <div className="container max-w-4xl">
        <div
          className={cn(
            'grid gap-8 text-center',
            stats.length === 3 && 'grid-cols-1 md:grid-cols-3',
            stats.length === 4 && 'grid-cols-2 md:grid-cols-4'
          )}
        >
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div
                className={cn(
                  'text-sm',
                  variant === 'warm' && 'text-green-200',
                  variant === 'navy' && 'text-neutral-400'
                )}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
