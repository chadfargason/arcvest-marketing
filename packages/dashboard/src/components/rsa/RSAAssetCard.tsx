'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { HeadlineList } from './HeadlineList';
import { DescriptionList } from './DescriptionList';
import { RatingStars } from './RatingStars';
import { RSAStatusBadge } from './RSAStatusBadge';
import { ComplianceBadge } from './ComplianceBadge';
import { PersonaVoiceBadges } from './PersonaVoiceBadges';
import type { RSAAsset } from '@/lib/rsa/types';
import { cn } from '@/lib/utils';

interface RSAAssetCardProps {
  asset: RSAAsset;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onFavorite?: (isFavorite: boolean) => void;
  onRate?: (rating: number) => void;
  onStatusChange?: (status: string) => void;
  onViewDetails?: () => void;
  compact?: boolean;
}

export function RSAAssetCard({
  asset,
  selected = false,
  onSelect,
  onFavorite,
  onRate,
  onStatusChange,
  onViewDetails,
  compact = false,
}: RSAAssetCardProps) {
  const [expanded, setExpanded] = useState(false);

  const headlines = asset.content?.headlines || [];
  const descriptions = asset.content?.descriptions || [];

  return (
    <Card
      className={cn(
        'transition-shadow',
        selected && 'ring-2 ring-primary',
        asset.is_favorite && 'border-yellow-300 dark:border-yellow-700'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {onSelect && (
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className="mt-1"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-medium text-sm truncate">{asset.name}</h3>
              <RSAStatusBadge status={asset.status} />
              <ComplianceBadge
                passed={asset.compliance_passed}
                issues={asset.compliance_issues}
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <PersonaVoiceBadges
                personaId={asset.persona_id}
                voiceId={asset.voice_id}
              />
              {asset.variation_type && asset.variation_type !== 'master' && (
                <span className="text-xs text-muted-foreground">
                  Variation #{asset.variation_number}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {onFavorite && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onFavorite(!asset.is_favorite)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill={asset.is_favorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className={cn(
                    'w-5 h-5',
                    asset.is_favorite ? 'text-yellow-500' : 'text-muted-foreground'
                  )}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </Button>
            )}

            <RatingStars
              value={asset.rating}
              onChange={onRate}
              readonly={!onRate}
              size="sm"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn('pt-0', compact && 'pb-3')}>
        {/* Preview - first 3 headlines */}
        {!expanded && (
          <div className="mb-2">
            <HeadlineList
              headlines={headlines.slice(0, 3)}
              compact
              showType={false}
            />
            {headlines.length > 3 && (
              <p className="text-xs text-muted-foreground mt-1">
                +{headlines.length - 3} more headlines
              </p>
            )}
          </div>
        )}

        {/* Expanded view */}
        {expanded && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">
                Headlines ({headlines.length}/15)
              </h4>
              <HeadlineList headlines={headlines} showType />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">
                Descriptions ({descriptions.length}/4)
              </h4>
              <DescriptionList descriptions={descriptions} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : 'Show More'}
          </Button>

          <div className="flex items-center gap-2">
            {onStatusChange && asset.status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange('approved')}
              >
                Approve
              </Button>
            )}
            {onViewDetails && (
              <Button variant="outline" size="sm" onClick={onViewDetails}>
                Details
              </Button>
            )}
          </div>
        </div>

        {/* Metadata footer */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
          <span>
            Created {new Date(asset.created_at).toLocaleDateString()}
          </span>
          {asset.exported_at && (
            <span>
              Exported {new Date(asset.exported_at).toLocaleDateString()}
            </span>
          )}
          {(asset.impressions > 0 || asset.clicks > 0) && (
            <span>
              {asset.impressions.toLocaleString()} imp / {asset.clicks.toLocaleString()} clicks
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
